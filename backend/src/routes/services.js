const router = require('express').Router();
const { Service, User, SLAPolicy } = require('../models');
const { authenticate, authorize, tenantMiddleware, companyScope, requireCompanySelected } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

router.use(authenticate, tenantMiddleware);

const includeRefs = [
  { model: User,       as: 'owner',     attributes: ['id', 'name', 'avatar_url'] },
  { model: SLAPolicy,  as: 'slaPolicy', attributes: ['id', 'name'] },
];

router.get('/', async (req, res, next) => {
  try {
    const { active } = req.query;
    const where = { ...companyScope(req) };
    if (active !== 'all') where.active = active === undefined ? true : active === 'true';

    const services = await Service.findAll({ where, include: includeRefs, order: [['name', 'ASC']] });
    res.json({ services });
  } catch (err) { next(err); }
});

router.post('/', authorize('super_admin', 'admin'), requireCompanySelected, async (req, res, next) => {
  try {
    const allowed = ['name', 'description', 'category', 'criticality', 'owner_id', 'sla_policy_id', 'cost'];
    const data = { company_id: req.companyId };
    allowed.forEach(f => { if (req.body[f] !== undefined) data[f] = req.body[f]; });

    const service = await Service.create(data);
    await logAudit(req, { action: 'create', entity_type: 'Service', entity_id: service.id, after: data });

    const full = await Service.findByPk(service.id, { include: includeRefs });
    res.status(201).json(full);
  } catch (err) { next(err); }
});

router.put('/:id', authorize('super_admin', 'admin'), async (req, res, next) => {
  try {
    const service = await Service.findOne({ where: { id: req.params.id, ...companyScope(req) } });
    if (!service) return res.status(404).json({ error: 'Servicio no encontrado' });

    const allowed = ['name', 'description', 'category', 'criticality', 'owner_id', 'sla_policy_id', 'cost', 'active'];
    const updates = {};
    allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

    await service.update(updates);
    const full = await Service.findByPk(service.id, { include: includeRefs });
    res.json(full);
  } catch (err) { next(err); }
});

router.delete('/:id', authorize('super_admin', 'admin'), async (req, res, next) => {
  try {
    const service = await Service.findOne({ where: { id: req.params.id, ...companyScope(req) } });
    if (!service) return res.status(404).json({ error: 'Servicio no encontrado' });
    await service.update({ active: false });
    res.json({ message: 'Servicio desactivado' });
  } catch (err) { next(err); }
});

module.exports = router;
