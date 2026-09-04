const router = require('express').Router();
const { Op } = require('sequelize');
const { MaintenancePlan, MaintenanceLog, Asset, User } = require('../models');
const { authenticate, authorize, tenantMiddleware, companyScope, requireCompanySelected } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

router.use(authenticate, tenantMiddleware);

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// Planes próximos a vencer o vencidos (para un dashboard/lista de pendientes)
router.get('/due', async (req, res, next) => {
  try {
    const { days = 7 } = req.query;
    const threshold = addDays(new Date(), parseInt(days));
    const plans = await MaintenancePlan.findAll({
      where: { ...companyScope(req), active: true, next_due_at: { [Op.lte]: threshold } },
      include: [{ model: Asset, as: 'asset', attributes: ['id', 'asset_tag', 'name', 'type'] }],
      order: [['next_due_at', 'ASC']],
    });
    res.json({ plans });
  } catch (err) { next(err); }
});

router.get('/plans', async (req, res, next) => {
  try {
    const { asset_id } = req.query;
    const where = { ...companyScope(req) };
    if (asset_id) where.asset_id = asset_id;

    const plans = await MaintenancePlan.findAll({
      where,
      include: [
        { model: Asset, as: 'asset', attributes: ['id', 'asset_tag', 'name'] },
        { model: MaintenanceLog, as: 'logs', separate: true, limit: 5, order: [['done_at', 'DESC']] },
      ],
      order: [['next_due_at', 'ASC']],
    });
    res.json({ plans });
  } catch (err) { next(err); }
});

router.post('/plans', authorize('super_admin', 'admin', 'supervisor', 'agent'), requireCompanySelected, async (req, res, next) => {
  try {
    const { asset_id, title, frequency_days = 90, checklist = [] } = req.body;
    if (!asset_id || !title) return res.status(400).json({ error: 'asset_id y title son requeridos' });

    const asset = await Asset.findOne({ where: { id: asset_id, ...companyScope(req) } });
    if (!asset) return res.status(404).json({ error: 'Activo no encontrado' });

    const plan = await MaintenancePlan.create({
      company_id: req.companyId, asset_id, title, frequency_days, checklist,
      next_due_at: addDays(new Date(), frequency_days),
    });
    res.status(201).json(plan);
  } catch (err) { next(err); }
});

router.put('/plans/:id', authorize('super_admin', 'admin', 'supervisor', 'agent'), async (req, res, next) => {
  try {
    const plan = await MaintenancePlan.findOne({ where: { id: req.params.id, ...companyScope(req) } });
    if (!plan) return res.status(404).json({ error: 'Plan no encontrado' });

    const allowed = ['title', 'frequency_days', 'checklist', 'active'];
    const updates = {};
    allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

    await plan.update(updates);
    res.json(plan);
  } catch (err) { next(err); }
});

router.delete('/plans/:id', authorize('super_admin', 'admin'), async (req, res, next) => {
  try {
    const plan = await MaintenancePlan.findOne({ where: { id: req.params.id, ...companyScope(req) } });
    if (!plan) return res.status(404).json({ error: 'Plan no encontrado' });
    await plan.destroy();
    res.json({ message: 'Plan eliminado' });
  } catch (err) { next(err); }
});

// Registrar que se hizo el mantenimiento
router.post('/plans/:id/complete', authorize('super_admin', 'admin', 'supervisor', 'agent'), async (req, res, next) => {
  try {
    const plan = await MaintenancePlan.findOne({ where: { id: req.params.id, ...companyScope(req) } });
    if (!plan) return res.status(404).json({ error: 'Plan no encontrado' });

    const { checklist_results = [], notes } = req.body;
    const now = new Date();

    const log = await MaintenanceLog.create({
      company_id: req.companyId, plan_id: plan.id, asset_id: plan.asset_id,
      done_by: req.user.id, done_at: now, checklist_results, notes,
    });
    await plan.update({ last_done_at: now, next_due_at: addDays(now, plan.frequency_days) });
    await logAudit(req, { action: 'complete', entity_type: 'MaintenancePlan', entity_id: plan.id });

    res.status(201).json({ log, plan });
  } catch (err) { next(err); }
});

module.exports = router;
