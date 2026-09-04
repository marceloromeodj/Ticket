const router = require('express').Router();
const { AssetType, Asset } = require('../models');
const { authenticate, authorize, tenantMiddleware, companyScope, requireCompanySelected } = require('../middleware/auth');

router.use(authenticate, tenantMiddleware);

// Lista fija que existía como ENUM antes de este módulo -- se usa para
// poblar una empresa la primera vez que pide sus tipos de activo, así
// las instalaciones existentes no pierden continuidad con los activos
// que ya tenían cargados.
const DEFAULT_TYPES = [
  { key: 'pc', label: 'PC' }, { key: 'notebook', label: 'Notebook' },
  { key: 'server', label: 'Servidor' }, { key: 'vm', label: 'Máquina virtual' },
  { key: 'printer', label: 'Impresora' }, { key: 'switch', label: 'Switch' },
  { key: 'router', label: 'Router' }, { key: 'firewall', label: 'Firewall' },
  { key: 'ap', label: 'Access Point' }, { key: 'ups', label: 'UPS' },
  { key: 'camera', label: 'Cámara' }, { key: 'phone', label: 'Teléfono' },
  { key: 'other', label: 'Otro' },
];

const DIACRITICS_RANGE = new RegExp(`[${String.fromCharCode(0x0300)}-${String.fromCharCode(0x036f)}]`, 'g');
function slugify(label) {
  return label.toLowerCase().trim()
    .normalize('NFD').replace(DIACRITICS_RANGE, '') // sin acentos
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

router.get('/', async (req, res, next) => {
  try {
    const { active } = req.query;
    const where = { ...companyScope(req) };

    let types = await AssetType.findAll({ where, order: [['position', 'ASC'], ['label', 'ASC']] });

    if (types.length === 0 && req.companyId) {
      await AssetType.bulkCreate(DEFAULT_TYPES.map((t, i) => ({ ...t, company_id: req.companyId, position: i })));
      types = await AssetType.findAll({ where, order: [['position', 'ASC'], ['label', 'ASC']] });
    }

    res.json({ types: active === 'all' ? types : types.filter(t => t.active) });
  } catch (err) { next(err); }
});

router.post('/', authorize('super_admin', 'admin'), requireCompanySelected, async (req, res, next) => {
  try {
    const { label } = req.body;
    if (!label?.trim()) return res.status(400).json({ error: 'El nombre es requerido' });

    const key = slugify(label);
    if (!key) return res.status(400).json({ error: 'Nombre inválido' });

    const existing = await AssetType.findOne({ where: { key, company_id: req.companyId } });
    if (existing) return res.status(400).json({ error: 'Ya existe un tipo con ese nombre' });

    const type = await AssetType.create({ company_id: req.companyId, key, label: label.trim() });
    res.status(201).json(type);
  } catch (err) { next(err); }
});

router.put('/:id', authorize('super_admin', 'admin'), async (req, res, next) => {
  try {
    const type = await AssetType.findOne({ where: { id: req.params.id, ...companyScope(req) } });
    if (!type) return res.status(404).json({ error: 'Tipo no encontrado' });

    const updates = {};
    if (req.body.label !== undefined) updates.label = req.body.label;
    if (req.body.active !== undefined) updates.active = req.body.active;

    await type.update(updates);
    res.json(type);
  } catch (err) { next(err); }
});

// Baja: si ningún activo lo usa, se borra; si hay activos con ese tipo,
// se desactiva nomás (deja de ofrecerse para elegir, pero no rompe los
// activos que ya lo tenían).
router.delete('/:id', authorize('super_admin', 'admin'), async (req, res, next) => {
  try {
    const type = await AssetType.findOne({ where: { id: req.params.id, ...companyScope(req) } });
    if (!type) return res.status(404).json({ error: 'Tipo no encontrado' });

    const inUse = await Asset.count({ where: { type: type.key, ...companyScope(req) } });
    if (inUse > 0) {
      await type.update({ active: false });
      return res.json({ message: `Desactivado (usado por ${inUse} activo${inUse === 1 ? '' : 's'})` });
    }

    await type.destroy();
    res.json({ message: 'Tipo eliminado' });
  } catch (err) { next(err); }
});

module.exports = router;
