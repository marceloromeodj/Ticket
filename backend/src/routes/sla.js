const router = require('express').Router();
const { SLAPolicy } = require('../models');
const { authenticate, authorize, tenantMiddleware, requireCompanySelected } = require('../middleware/auth');

// Las políticas de SLA son de una empresa concreta: un super_admin sin
// empresa seleccionada no tiene "todas las políticas" que tenga sentido ver.
router.use(authenticate, tenantMiddleware, authorize('super_admin','admin'), requireCompanySelected);

router.get('/', async (req, res, next) => {
  try {
    const policies = await SLAPolicy.findAll({ where: { company_id: req.companyId }, order: [['is_default','DESC'],['name','ASC']] });
    res.json(policies);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const { name, description, first_response_time, resolution_time, business_hours_only, conditions, escalation_actions, is_default } = req.body;
    if (is_default) {
      await SLAPolicy.update({ is_default: false }, { where: { company_id: req.companyId } });
    }
    const policy = await SLAPolicy.create({ company_id: req.companyId, name, description, first_response_time, resolution_time, business_hours_only, conditions, escalation_actions, is_default });
    res.status(201).json(policy);
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const policy = await SLAPolicy.findOne({ where: { id: req.params.id, company_id: req.companyId } });
    if (!policy) return res.status(404).json({ error: 'Política SLA no encontrada' });
    if (req.body.is_default) {
      await SLAPolicy.update({ is_default: false }, { where: { company_id: req.companyId } });
    }
    await policy.update(req.body);
    res.json(policy);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await SLAPolicy.destroy({ where: { id: req.params.id, company_id: req.companyId } });
    res.json({ message: 'Política eliminada' });
  } catch (err) { next(err); }
});

module.exports = router;
