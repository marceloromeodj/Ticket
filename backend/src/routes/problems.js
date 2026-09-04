const router = require('express').Router();
const { Op } = require('sequelize');
const { sequelize, Problem, Ticket, User, Category } = require('../models');
const { authenticate, authorize, tenantMiddleware, companyScope, requireCompanySelected } = require('../middleware/auth');
const { getNextSequentialNumber } = require('../utils/sequentialNumber');
const { logAudit } = require('../utils/audit');

router.use(authenticate, tenantMiddleware, authorize('super_admin', 'admin', 'supervisor', 'agent'));

const includeRefs = [
  { model: User,     as: 'agent',    attributes: ['id', 'name', 'avatar_url'] },
  { model: Category, as: 'category', attributes: ['id', 'name', 'color'] },
  {
    model: Ticket, as: 'tickets',
    attributes: ['id', 'ticket_number', 'subject', 'status', 'priority'],
  },
];

router.get('/', async (req, res, next) => {
  try {
    const { status, priority } = req.query;
    const where = { ...companyScope(req) };
    if (status)   where.status = status;
    if (priority) where.priority = priority;

    const problems = await Problem.findAll({ where, include: includeRefs, order: [['created_at', 'DESC']] });
    res.json({ problems });
  } catch (err) { next(err); }
});

router.post('/', requireCompanySelected, async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const { title, description, priority = 'medium', category_id, agent_id } = req.body;
    const problem_number = await getNextSequentialNumber(Problem, 'problem_number', req.companyId, t);

    const problem = await Problem.create({
      company_id: req.companyId, branch_id: req.branchId,
      problem_number, title, description, priority, category_id, agent_id,
    }, { transaction: t });

    await t.commit();
    await logAudit(req, { action: 'create', entity_type: 'Problem', entity_id: problem.id, after: problem.toJSON() });

    const fullProblem = await Problem.findByPk(problem.id, { include: includeRefs });
    res.status(201).json(fullProblem);
  } catch (err) {
    await t.rollback();
    next(err);
  }
});

// Declarar Incidente Mayor a partir de una selección de tickets (ej. tras
// una alerta de incidente masivo): crea el Problema marcado is_major y
// vincula todos los tickets pasados de una sola vez.
router.post('/bulk-from-tickets', requireCompanySelected, authorize('super_admin', 'admin', 'supervisor'), async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const { ticket_ids, title, description, impact } = req.body;
    if (!Array.isArray(ticket_ids) || ticket_ids.length === 0) {
      await t.rollback();
      return res.status(400).json({ error: 'ticket_ids requerido' });
    }
    if (!title) {
      await t.rollback();
      return res.status(400).json({ error: 'title requerido' });
    }

    const problem_number = await getNextSequentialNumber(Problem, 'problem_number', req.companyId, t);
    const problem = await Problem.create({
      company_id: req.companyId, branch_id: req.branchId,
      problem_number, title, description, impact,
      priority: 'urgent', is_major: true, agent_id: req.user.id,
    }, { transaction: t });

    await Ticket.update(
      { problem_id: problem.id },
      { where: { id: { [Op.in]: ticket_ids }, ...companyScope(req) }, transaction: t }
    );

    await t.commit();
    await logAudit(req, { action: 'create', entity_type: 'Problem', entity_id: problem.id, after: { is_major: true, ticket_ids } });

    const fullProblem = await Problem.findByPk(problem.id, { include: includeRefs });
    res.status(201).json(fullProblem);
  } catch (err) {
    await t.rollback();
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const problem = await Problem.findOne({ where: { id: req.params.id, ...companyScope(req) }, include: includeRefs });
    if (!problem) return res.status(404).json({ error: 'Problema no encontrado' });
    res.json(problem);
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const problem = await Problem.findOne({ where: { id: req.params.id, ...companyScope(req) } });
    if (!problem) return res.status(404).json({ error: 'Problema no encontrado' });
    const before = problem.toJSON();

    const allowed = ['title', 'description', 'status', 'priority', 'root_cause', 'workaround', 'solution', 'category_id', 'agent_id'];
    const updates = {};
    allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
    if (['resolved', 'closed'].includes(updates.status) && !problem.resolved_at) updates.resolved_at = new Date();

    await problem.update(updates);
    await logAudit(req, { action: 'update', entity_type: 'Problem', entity_id: problem.id, before, after: problem.toJSON() });

    const fullProblem = await Problem.findByPk(problem.id, { include: includeRefs });
    res.json(fullProblem);
  } catch (err) { next(err); }
});

router.delete('/:id', authorize('super_admin', 'admin'), async (req, res, next) => {
  try {
    const problem = await Problem.findOne({ where: { id: req.params.id, ...companyScope(req) } });
    if (!problem) return res.status(404).json({ error: 'Problema no encontrado' });
    const before = problem.toJSON();
    await problem.destroy();
    await logAudit(req, { action: 'delete', entity_type: 'Problem', entity_id: req.params.id, before });
    res.json({ message: 'Problema eliminado' });
  } catch (err) { next(err); }
});

// Vincular / desvincular un ticket a este problema
router.post('/:id/tickets/:ticketId', async (req, res, next) => {
  try {
    const problem = await Problem.findOne({ where: { id: req.params.id, ...companyScope(req) } });
    if (!problem) return res.status(404).json({ error: 'Problema no encontrado' });
    const ticket = await Ticket.findOne({ where: { id: req.params.ticketId, ...companyScope(req) } });
    if (!ticket) return res.status(404).json({ error: 'Ticket no encontrado' });

    await ticket.update({ problem_id: problem.id });
    res.status(201).json({ message: 'Ticket vinculado al problema' });
  } catch (err) { next(err); }
});

router.delete('/:id/tickets/:ticketId', async (req, res, next) => {
  try {
    const ticket = await Ticket.findOne({ where: { id: req.params.ticketId, problem_id: req.params.id, ...companyScope(req) } });
    if (!ticket) return res.status(404).json({ error: 'Ticket no encontrado en este problema' });
    await ticket.update({ problem_id: null });
    res.json({ message: 'Ticket desvinculado del problema' });
  } catch (err) { next(err); }
});

module.exports = router;
