const router = require('express').Router();
const { sequelize, ChangeRequest, User, Problem } = require('../models');
const { authenticate, authorize, tenantMiddleware, companyScope, requireCompanySelected, requireModule } = require('../middleware/auth');
const { getNextSequentialNumber } = require('../utils/sequentialNumber');
const { logAudit } = require('../utils/audit');

router.use(authenticate, tenantMiddleware, authorize('super_admin', 'admin', 'supervisor', 'agent'), requireModule('changes'));

const includeRefs = [
  { model: User,    as: 'requester', attributes: ['id', 'name', 'avatar_url'] },
  { model: User,    as: 'approver',  attributes: ['id', 'name', 'avatar_url'] },
  { model: Problem, as: 'problem',   attributes: ['id', 'problem_number', 'title'] },
];

router.get('/', async (req, res, next) => {
  try {
    const { status } = req.query;
    const where = { ...companyScope(req) };
    if (status) where.status = status;

    const changes = await ChangeRequest.findAll({ where, include: includeRefs, order: [['created_at', 'DESC']] });
    res.json({ changes });
  } catch (err) { next(err); }
});

router.post('/', requireCompanySelected, async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const {
      title, description, change_type = 'normal', risk = 'medium',
      implementation_plan, rollback_plan, scheduled_start, scheduled_end, problem_id,
    } = req.body;
    const change_number = await getNextSequentialNumber(ChangeRequest, 'change_number', req.companyId, t);

    const change = await ChangeRequest.create({
      company_id: req.companyId, branch_id: req.branchId,
      change_number, title, description, change_type, risk,
      implementation_plan, rollback_plan, scheduled_start, scheduled_end, problem_id,
      requested_by: req.user.id,
      status: 'draft',
    }, { transaction: t });

    await t.commit();
    await logAudit(req, { action: 'create', entity_type: 'ChangeRequest', entity_id: change.id, after: change.toJSON() });

    const fullChange = await ChangeRequest.findByPk(change.id, { include: includeRefs });
    res.status(201).json(fullChange);
  } catch (err) {
    await t.rollback();
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const change = await ChangeRequest.findOne({ where: { id: req.params.id, ...companyScope(req) }, include: includeRefs });
    if (!change) return res.status(404).json({ error: 'Cambio no encontrado' });
    res.json(change);
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const change = await ChangeRequest.findOne({ where: { id: req.params.id, ...companyScope(req) } });
    if (!change) return res.status(404).json({ error: 'Cambio no encontrado' });
    if (!['draft', 'rejected'].includes(change.status)) {
      return res.status(400).json({ error: 'Solo se puede editar un cambio en borrador o rechazado' });
    }
    const before = change.toJSON();

    const allowed = ['title', 'description', 'change_type', 'risk', 'implementation_plan', 'rollback_plan', 'scheduled_start', 'scheduled_end', 'problem_id'];
    const updates = {};
    allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

    await change.update(updates);
    await logAudit(req, { action: 'update', entity_type: 'ChangeRequest', entity_id: change.id, before, after: change.toJSON() });

    const fullChange = await ChangeRequest.findByPk(change.id, { include: includeRefs });
    res.json(fullChange);
  } catch (err) { next(err); }
});

// Enviar a aprobación
router.post('/:id/submit', async (req, res, next) => {
  try {
    const change = await ChangeRequest.findOne({ where: { id: req.params.id, ...companyScope(req) } });
    if (!change) return res.status(404).json({ error: 'Cambio no encontrado' });
    if (change.status !== 'draft') return res.status(400).json({ error: 'Solo un cambio en borrador puede enviarse a aprobación' });

    await change.update({ status: 'pending_approval' });
    res.json(change);
  } catch (err) { next(err); }
});

// Aprobar / rechazar (solo admin o super_admin)
router.post('/:id/approve', authorize('super_admin', 'admin'), async (req, res, next) => {
  try {
    const change = await ChangeRequest.findOne({ where: { id: req.params.id, ...companyScope(req) } });
    if (!change) return res.status(404).json({ error: 'Cambio no encontrado' });
    if (change.status !== 'pending_approval') return res.status(400).json({ error: 'El cambio no está pendiente de aprobación' });

    await change.update({
      status: change.scheduled_start ? 'scheduled' : 'approved',
      approved_by: req.user.id,
      approval_notes: req.body.approval_notes || null,
    });
    await logAudit(req, { action: 'approve', entity_type: 'ChangeRequest', entity_id: change.id, after: { approved_by: req.user.id } });
    res.json(change);
  } catch (err) { next(err); }
});

router.post('/:id/reject', authorize('super_admin', 'admin'), async (req, res, next) => {
  try {
    const change = await ChangeRequest.findOne({ where: { id: req.params.id, ...companyScope(req) } });
    if (!change) return res.status(404).json({ error: 'Cambio no encontrado' });
    if (change.status !== 'pending_approval') return res.status(400).json({ error: 'El cambio no está pendiente de aprobación' });

    await change.update({
      status: 'rejected',
      approved_by: req.user.id,
      approval_notes: req.body.approval_notes || null,
    });
    await logAudit(req, { action: 'reject', entity_type: 'ChangeRequest', entity_id: change.id, after: { approved_by: req.user.id } });
    res.json(change);
  } catch (err) { next(err); }
});

// Marcar en curso / completado / con falla (revertido)
router.post('/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    const allowedTransitions = {
      approved:    ['in_progress'],
      scheduled:   ['in_progress'],
      in_progress: ['completed', 'failed'],
      failed:      ['rolled_back'],
    };
    const change = await ChangeRequest.findOne({ where: { id: req.params.id, ...companyScope(req) } });
    if (!change) return res.status(404).json({ error: 'Cambio no encontrado' });

    if (!allowedTransitions[change.status]?.includes(status)) {
      return res.status(400).json({ error: `No se puede pasar de "${change.status}" a "${status}"` });
    }
    await change.update({ status });
    await logAudit(req, { action: 'status_change', entity_type: 'ChangeRequest', entity_id: change.id, after: { status } });
    res.json(change);
  } catch (err) { next(err); }
});

router.delete('/:id', authorize('super_admin', 'admin'), async (req, res, next) => {
  try {
    const change = await ChangeRequest.findOne({ where: { id: req.params.id, ...companyScope(req) } });
    if (!change) return res.status(404).json({ error: 'Cambio no encontrado' });
    const before = change.toJSON();
    await change.destroy();
    await logAudit(req, { action: 'delete', entity_type: 'ChangeRequest', entity_id: req.params.id, before });
    res.json({ message: 'Cambio eliminado' });
  } catch (err) { next(err); }
});

module.exports = router;
