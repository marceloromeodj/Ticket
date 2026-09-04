const router = require('express').Router();
const { Asset, Branch, User, Ticket, AuditLog } = require('../models');
const { authenticate, authorize, tenantMiddleware, companyScope, requireCompanySelected, requireModule } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');
const { Op } = require('sequelize');

// Campos que constituyen "movimientos" del activo (a quién/dónde está
// asignado), a diferencia de cualquier otro dato editable. El historial
// completo de auditoría ya existe en AuditLog; esto solo lo filtra y le
// da nombres legibles en vez de UUIDs sueltos.
const MOVEMENT_FIELDS = {
  owner_id:  'Asignado a',
  branch_id: 'Sucursal',
  location:  'Ubicación',
  status:    'Estado',
};

router.use(authenticate, tenantMiddleware, requireModule('assets'));

const includeRefs = [
  { model: Branch, as: 'branch', attributes: ['id', 'name'] },
  { model: User,   as: 'owner',  attributes: ['id', 'name', 'email'] },
];

// Listar activos
router.get('/', async (req, res, next) => {
  try {
    const { search, type, status, branch_id, owner_id } = req.query;
    const where = { ...companyScope(req) };
    if (type)      where.type = type;
    if (status)    where.status = status;
    if (branch_id) where.branch_id = branch_id;
    if (owner_id)  where.owner_id = owner_id;
    if (search) {
      where[Op.or] = [
        { name:           { [Op.iLike]: `%${search}%` } },
        { asset_tag:      { [Op.iLike]: `%${search}%` } },
        { serial_number:  { [Op.iLike]: `%${search}%` } },
        { ip_address:     { [Op.iLike]: `%${search}%` } },
      ];
    }

    const assets = await Asset.findAll({ where, include: includeRefs, order: [['name', 'ASC']] });
    res.json({ assets });
  } catch (err) { next(err); }
});

// Crear activo
router.post('/', authorize('super_admin', 'admin', 'supervisor', 'agent'), requireCompanySelected, async (req, res, next) => {
  try {
    const allowed = [
      'asset_tag', 'name', 'type', 'status', 'brand', 'model', 'serial_number',
      'ip_address', 'mac_address', 'os', 'owner_id', 'branch_id', 'location',
      'vendor', 'purchase_date', 'warranty_until', 'notes', 'custom_fields',
    ];
    const data = { company_id: req.companyId };
    allowed.forEach(f => { if (req.body[f] !== undefined) data[f] = req.body[f]; });

    const existing = await Asset.findOne({ where: { asset_tag: data.asset_tag, company_id: req.companyId } });
    if (existing) return res.status(400).json({ error: 'Ya existe un activo con ese código en esta empresa' });

    const asset = await Asset.create(data);
    await logAudit(req, { action: 'create', entity_type: 'Asset', entity_id: asset.id, after: asset.toJSON() });

    const fullAsset = await Asset.findByPk(asset.id, { include: includeRefs });
    res.status(201).json(fullAsset);
  } catch (err) { next(err); }
});

// Obtener activo (con historial de tickets relacionados)
router.get('/:id', async (req, res, next) => {
  try {
    const asset = await Asset.findOne({
      where: { id: req.params.id, ...companyScope(req) },
      include: [
        ...includeRefs,
        {
          model: Ticket, as: 'tickets', through: { attributes: [] },
          attributes: ['id', 'ticket_number', 'subject', 'status', 'priority', 'created_at'],
        },
      ],
    });
    if (!asset) return res.status(404).json({ error: 'Activo no encontrado' });
    res.json(asset);
  } catch (err) { next(err); }
});

// Historial de movimientos del activo (asignación, sucursal, ubicación,
// estado) -- reutiliza AuditLog en vez de llevar su propia tabla.
router.get('/:id/history', async (req, res, next) => {
  try {
    const asset = await Asset.findOne({ where: { id: req.params.id, ...companyScope(req) } });
    if (!asset) return res.status(404).json({ error: 'Activo no encontrado' });

    const logs = await AuditLog.findAll({
      where: { entity_type: 'Asset', entity_id: req.params.id },
      order: [['created_at', 'DESC']],
    });

    // Junta todos los owner_id/branch_id mencionados en el historial (antes
    // y después) para resolverlos a nombre en un solo par de queries, en
    // vez de una por cada valor de cada evento.
    const userIds = new Set();
    const branchIds = new Set();
    logs.forEach(log => {
      [log.before, log.after].forEach(snap => {
        if (snap?.owner_id) userIds.add(snap.owner_id);
        if (snap?.branch_id) branchIds.add(snap.branch_id);
      });
    });
    const [users, branches] = await Promise.all([
      userIds.size ? User.findAll({ where: { id: { [Op.in]: [...userIds] } }, attributes: ['id', 'name'] }) : [],
      branchIds.size ? Branch.findAll({ where: { id: { [Op.in]: [...branchIds] } }, attributes: ['id', 'name'] }) : [],
    ]);
    const userName = (id) => users.find(u => u.id === id)?.name || null;
    const branchName = (id) => branches.find(b => b.id === id)?.name || null;
    const displayValue = (field, value) => {
      if (value === null || value === undefined || value === '') return null;
      if (field === 'owner_id') return userName(value) || 'Usuario eliminado';
      if (field === 'branch_id') return branchName(value) || 'Sucursal eliminada';
      return value;
    };

    const events = [];
    for (const log of logs) {
      if (log.action === 'create') {
        events.push({ id: log.id, created_at: log.created_at, user_name: log.user_name, type: 'create', changes: [] });
        continue;
      }
      if (log.action !== 'update') continue;

      const changes = Object.entries(MOVEMENT_FIELDS)
        .map(([field, label]) => {
          const from = log.before?.[field] ?? null;
          const to = log.after?.[field] ?? null;
          if (from === to) return null;
          return { field, label, from: displayValue(field, from), to: displayValue(field, to) };
        })
        .filter(Boolean);

      if (changes.length > 0) {
        events.push({ id: log.id, created_at: log.created_at, user_name: log.user_name, type: 'update', changes });
      }
    }

    res.json({ events });
  } catch (err) { next(err); }
});

// Actualizar activo
router.put('/:id', authorize('super_admin', 'admin', 'supervisor', 'agent'), async (req, res, next) => {
  try {
    const asset = await Asset.findOne({ where: { id: req.params.id, ...companyScope(req) } });
    if (!asset) return res.status(404).json({ error: 'Activo no encontrado' });
    const before = asset.toJSON();

    const allowed = [
      'asset_tag', 'name', 'type', 'status', 'brand', 'model', 'serial_number',
      'ip_address', 'mac_address', 'os', 'owner_id', 'branch_id', 'location',
      'vendor', 'purchase_date', 'warranty_until', 'notes', 'custom_fields',
    ];
    const updates = {};
    allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

    await asset.update(updates);
    await logAudit(req, { action: 'update', entity_type: 'Asset', entity_id: asset.id, before, after: asset.toJSON() });

    const fullAsset = await Asset.findByPk(asset.id, { include: includeRefs });
    res.json(fullAsset);
  } catch (err) { next(err); }
});

// Eliminar activo
router.delete('/:id', authorize('super_admin', 'admin'), async (req, res, next) => {
  try {
    const asset = await Asset.findOne({ where: { id: req.params.id, ...companyScope(req) } });
    if (!asset) return res.status(404).json({ error: 'Activo no encontrado' });
    const before = asset.toJSON();
    await asset.destroy();
    await logAudit(req, { action: 'delete', entity_type: 'Asset', entity_id: req.params.id, before });
    res.json({ message: 'Activo eliminado' });
  } catch (err) { next(err); }
});

// Vincular / desvincular un activo a un ticket
router.post('/:id/tickets/:ticketId', async (req, res, next) => {
  try {
    const asset = await Asset.findOne({ where: { id: req.params.id, ...companyScope(req) } });
    if (!asset) return res.status(404).json({ error: 'Activo no encontrado' });
    const ticket = await Ticket.findOne({ where: { id: req.params.ticketId, ...companyScope(req) } });
    if (!ticket) return res.status(404).json({ error: 'Ticket no encontrado' });

    await asset.addTicket(ticket);
    res.status(201).json({ message: 'Activo vinculado al ticket' });
  } catch (err) { next(err); }
});

router.delete('/:id/tickets/:ticketId', async (req, res, next) => {
  try {
    const asset = await Asset.findOne({ where: { id: req.params.id, ...companyScope(req) } });
    if (!asset) return res.status(404).json({ error: 'Activo no encontrado' });
    await asset.removeTicket(req.params.ticketId);
    res.json({ message: 'Activo desvinculado del ticket' });
  } catch (err) { next(err); }
});

module.exports = router;
