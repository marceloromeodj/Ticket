const router = require('express').Router();
const { TicketStatus, Ticket } = require('../models');
const { authenticate, authorize, tenantMiddleware, companyScope, requireCompanySelected } = require('../middleware/auth');
const { getStatuses, invalidateCache } = require('../services/ticketStatusService');

router.use(authenticate, tenantMiddleware);

const DIACRITICS_RANGE = new RegExp(`[${String.fromCharCode(0x0300)}-${String.fromCharCode(0x036f)}]`, 'g');
function slugify(label) {
  return label.toLowerCase().trim()
    .normalize('NFD').replace(DIACRITICS_RANGE, '')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

// Lectura: cualquier rol autenticado de la empresa (agentes incluidos)
// para poder pintar el tablero y los selects de estado.
router.get('/', async (req, res, next) => {
  try {
    const statuses = await getStatuses(req.companyId);
    res.json({ statuses: req.query.active === 'all' ? statuses : statuses.filter(s => s.active) });
  } catch (err) { next(err); }
});

router.post('/', authorize('super_admin', 'admin'), requireCompanySelected, async (req, res, next) => {
  try {
    const { label, color, category = 'open' } = req.body;
    if (!label?.trim()) return res.status(400).json({ error: 'El nombre es requerido' });
    if (!['open', 'resolved', 'closed'].includes(category)) return res.status(400).json({ error: 'Categoría inválida' });

    const key = slugify(label);
    if (!key) return res.status(400).json({ error: 'Nombre inválido' });

    const existing = await TicketStatus.findOne({ where: { key, company_id: req.companyId } });
    if (existing) return res.status(400).json({ error: 'Ya existe un estado con ese nombre' });

    const count = await TicketStatus.count({ where: { company_id: req.companyId } });
    const status = await TicketStatus.create({ company_id: req.companyId, key, label: label.trim(), color, category, position: count });
    invalidateCache(req.companyId);
    res.status(201).json(status);
  } catch (err) { next(err); }
});

router.put('/:id', authorize('super_admin', 'admin'), async (req, res, next) => {
  try {
    const status = await TicketStatus.findOne({ where: { id: req.params.id, ...companyScope(req) } });
    if (!status) return res.status(404).json({ error: 'Estado no encontrado' });

    const allowed = ['label', 'color', 'category', 'position', 'is_initial', 'allowed_next', 'active'];
    const updates = {};
    allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

    // Solo un estado inicial por empresa: al marcar uno, desmarca el resto.
    if (updates.is_initial === true) {
      await TicketStatus.update({ is_initial: false }, { where: { company_id: status.company_id } });
    }

    await status.update(updates);
    invalidateCache(status.company_id);
    res.json(status);
  } catch (err) { next(err); }
});

// Baja: si ningún ticket lo usa, se borra; si hay tickets con ese
// estado, se desactiva nomás (deja de ofrecerse, pero no rompe lo ya
// creado -- mismo criterio que Tipos de activos).
router.delete('/:id', authorize('super_admin', 'admin'), async (req, res, next) => {
  try {
    const status = await TicketStatus.findOne({ where: { id: req.params.id, ...companyScope(req) } });
    if (!status) return res.status(404).json({ error: 'Estado no encontrado' });

    const inUse = await Ticket.count({ where: { status: status.key, ...companyScope(req) } });
    invalidateCache(status.company_id);
    if (inUse > 0) {
      await status.update({ active: false });
      return res.json({ message: `Desactivado (usado por ${inUse} ticket${inUse === 1 ? '' : 's'})` });
    }

    await status.destroy();
    res.json({ message: 'Estado eliminado' });
  } catch (err) { next(err); }
});

module.exports = router;
