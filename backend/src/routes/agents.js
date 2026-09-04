const router = require('express').Router();
const multer = require('multer');
const crypto = require('crypto');
const { parse } = require('csv-parse/sync');
const { User, Branch } = require('../models');
const { authenticate, authorize, tenantMiddleware, companyScope, requireCompanySelected } = require('../middleware/auth');
const { Op } = require('sequelize');

router.use(authenticate, tenantMiddleware);

const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const isCsv = /\.csv$/i.test(file.originalname) ||
      ['text/csv', 'application/vnd.ms-excel', 'application/csv'].includes(file.mimetype);
    cb(isCsv ? null : new Error('El archivo debe ser un .csv'), isCsv);
  },
});

const CSV_ROLES = ['admin', 'supervisor', 'agent'];
// Encabezados aceptados por columna (sin mayúsculas/acentos) — para que la
// plantilla en español y variantes razonables (ej. sin tilde) funcionen igual.
const HEADER_SYNONYMS = {
  name:     ['nombre', 'name'],
  email:    ['email', 'correo', 'mail'],
  password: ['contrasena', 'password', 'clave'],
  role:     ['rol', 'role'],
  branch:   ['sucursal', 'branch', 'sede'],
  phone:    ['telefono', 'phone', 'celular'],
};

// Rango Unicode de marcas diacríticas combinantes (U+0300–U+036F), construido
// desde los códigos numéricos para evitar caracteres combinantes literales
// en el fuente (que algunos editores/consolas corrompen al guardar).
const DIACRITICS_RE = new RegExp('[' + String.fromCharCode(0x0300) + '-' + String.fromCharCode(0x036f) + ']', 'g');
function normalizeHeader(h) {
  return String(h || '')
    .normalize('NFD').replace(DIACRITICS_RE, '') // sin acentos
    .trim().toLowerCase();
}

function mapCsvRow(rawRow) {
  const normalized = {};
  Object.keys(rawRow).forEach(key => { normalized[normalizeHeader(key)] = rawRow[key]; });

  const row = {};
  for (const [field, synonyms] of Object.entries(HEADER_SYNONYMS)) {
    const matchKey = synonyms.find(s => normalized[s] !== undefined);
    row[field] = matchKey ? String(normalized[matchKey] || '').trim() : '';
  }
  return row;
}

function generateTempPassword() {
  return crypto.randomBytes(9).toString('base64').replace(/[+/=]/g, '').slice(0, 12);
}

// ─── Plantilla CSV para importación masiva ───────────────────────
router.get('/csv-template', authorize('super_admin', 'admin'), (req, res) => {
  const rows = [
    ['nombre', 'email', 'contraseña', 'rol', 'sucursal', 'telefono'],
    ['Juan Pérez', 'juan.perez@empresa.com', '', 'agent', 'Casa Central', '+54 11 1234-5678'],
  ];
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\r\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="plantilla_agentes.csv"');
  res.send('﻿' + csv); // BOM: para que Excel detecte UTF-8 y muestre bien los acentos
});

// ─── Importar agentes desde CSV ───────────────────────────────────
// Dejar "contraseña" vacía genera una temporal aleatoria, devuelta en la
// respuesta para que el admin se la pase al agente. "rol" acepta admin,
// supervisor o agent (default: agent); "sucursal" se busca por nombre
// dentro de la misma empresa.
router.post('/import', authorize('super_admin', 'admin'), requireCompanySelected, csvUpload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Archivo CSV requerido' });

    let records;
    try {
      records = parse(req.file.buffer, { columns: true, skip_empty_lines: true, trim: true, bom: true });
    } catch (e) {
      return res.status(400).json({ error: `No se pudo leer el CSV: ${e.message}` });
    }

    if (records.length === 0) return res.status(400).json({ error: 'El CSV no tiene filas' });
    if (records.length > 500) return res.status(400).json({ error: 'Máximo 500 filas por importación' });

    const branches = await Branch.findAll({ where: { company_id: req.companyId }, attributes: ['id', 'name'] });
    const branchByName = new Map(branches.map(b => [b.name.trim().toLowerCase(), b.id]));

    const created = [];
    const errors = [];

    for (let i = 0; i < records.length; i++) {
      const rowNum = i + 2; // +1 por índice base 1, +1 por la fila de encabezado
      const row = mapCsvRow(records[i]);

      if (!row.name || !row.email) {
        errors.push({ row: rowNum, email: row.email || null, message: 'Nombre y email son requeridos' });
        continue;
      }

      const email = row.email.toLowerCase();
      const role = row.role ? row.role.toLowerCase() : 'agent';
      if (!CSV_ROLES.includes(role)) {
        errors.push({ row: rowNum, email, message: `Rol inválido "${row.role}" (admin, supervisor o agent)` });
        continue;
      }

      let branch_id = null;
      if (row.branch) {
        branch_id = branchByName.get(row.branch.trim().toLowerCase());
        if (!branch_id) {
          errors.push({ row: rowNum, email, message: `Sucursal "${row.branch}" no existe en esta empresa` });
          continue;
        }
      }

      const existing = await User.findOne({ where: { email, company_id: req.companyId } });
      if (existing) {
        errors.push({ row: rowNum, email, message: 'Ya existe un usuario con ese email en esta empresa' });
        continue;
      }

      const tempPassword = row.password || generateTempPassword();
      try {
        const agent = await User.create({
          name: row.name, email, password: tempPassword, role,
          company_id: req.companyId, branch_id, phone: row.phone || null,
        });
        created.push({
          row: rowNum, id: agent.id, name: agent.name, email: agent.email, role: agent.role,
          temp_password: row.password ? null : tempPassword,
        });
      } catch (e) {
        errors.push({ row: rowNum, email, message: e.message });
      }
    }

    res.json({ total: records.length, created, errors });
  } catch (err) { next(err); }
});

// Listar agentes de la empresa
router.get('/', async (req, res, next) => {
  try {
    const { search, role, branch_id, active = true } = req.query;
    const where = {
      ...companyScope(req),
      role: { [Op.in]: ['admin', 'supervisor', 'agent'] },
    };
    if (active !== 'all') where.active = active === 'true';
    if (role)      where.role      = role;
    if (branch_id) where.branch_id = branch_id;
    if (search) {
      where[Op.or] = [
        { name:  { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const agents = await User.findAll({
      where,
      attributes: ['id','name','email','role','avatar_url','availability','branch_id','groups','active'],
      order: [['name', 'ASC']],
    });
    res.json({ agents });
  } catch (err) { next(err); }
});

// Crear agente
router.post('/', authorize('super_admin','admin'), requireCompanySelected, async (req, res, next) => {
  try {
    const { name, email, password, role = 'agent', branch_id, groups = [] } = req.body;
    const existing = await User.findOne({ where: { email: email.toLowerCase(), company_id: req.companyId } });
    if (existing) return res.status(400).json({ error: 'El email ya existe en esta empresa' });

    const agent = await User.create({
      name, email: email.toLowerCase(), password, role,
      company_id: req.companyId, branch_id: branch_id || null, groups,
    });
    res.status(201).json(agent);
  } catch (err) { next(err); }
});

// Obtener agente
router.get('/:id', async (req, res, next) => {
  try {
    const agent = await User.findOne({ where: { id: req.params.id, ...companyScope(req) } });
    if (!agent) return res.status(404).json({ error: 'Agente no encontrado' });
    res.json(agent);
  } catch (err) { next(err); }
});

// Actualizar agente
router.put('/:id', authorize('super_admin','admin'), async (req, res, next) => {
  try {
    const agent = await User.findOne({ where: { id: req.params.id, ...companyScope(req) } });
    if (!agent) return res.status(404).json({ error: 'Agente no encontrado' });

    const allowed = ['name','role','branch_id','groups','active','phone','notification_preferences'];
    const updates = {};
    allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
    if (updates.branch_id === '') updates.branch_id = null; // "Todas" en el select manda ""; la columna es UUID
    if (req.body.password) updates.password = req.body.password;

    await agent.update(updates);
    res.json(agent);
  } catch (err) { next(err); }
});

// Eliminar (desactivar) agente
router.delete('/:id', authorize('super_admin','admin'), async (req, res, next) => {
  try {
    const agent = await User.findOne({ where: { id: req.params.id, ...companyScope(req) } });
    if (!agent) return res.status(404).json({ error: 'Agente no encontrado' });
    await agent.update({ active: false });
    res.json({ message: 'Agente desactivado' });
  } catch (err) { next(err); }
});

// Cambiar disponibilidad (propio)
router.patch('/me/availability', async (req, res, next) => {
  try {
    const { availability } = req.body;
    await req.user.update({ availability });
    res.json({ availability });
  } catch (err) { next(err); }
});

module.exports = router;
