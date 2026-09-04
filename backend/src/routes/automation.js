const router = require('express').Router();
const { AutomationRule } = require('../models');
const { authenticate, authorize, tenantMiddleware, requireCompanySelected, requireModule } = require('../middleware/auth');

// Las reglas de automatización son de una empresa concreta.
router.use(authenticate, tenantMiddleware, authorize('super_admin','admin'), requireCompanySelected, requireModule('automation'));

router.get('/', async (req, res, next) => {
  try {
    const rules = await AutomationRule.findAll({
      where: { company_id: req.companyId },
      order: [['position', 'ASC']],
    });
    res.json(rules);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const { name, description, event, condition_type, conditions, actions, position, time_condition } = req.body;
    const rule = await AutomationRule.create({
      company_id: req.companyId, name, description, event,
      condition_type, conditions, actions, position, time_condition,
    });
    res.status(201).json(rule);
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const rule = await AutomationRule.findOne({ where: { id: req.params.id, company_id: req.companyId } });
    if (!rule) return res.status(404).json({ error: 'Regla no encontrada' });
    res.json(rule);
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const rule = await AutomationRule.findOne({ where: { id: req.params.id, company_id: req.companyId } });
    if (!rule) return res.status(404).json({ error: 'Regla no encontrada' });
    const allowed = ['name','description','event','condition_type','conditions','actions','position','active','time_condition'];
    const updates = {};
    allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
    await rule.update(updates);
    res.json(rule);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await AutomationRule.destroy({ where: { id: req.params.id, company_id: req.companyId } });
    res.json({ message: 'Regla eliminada' });
  } catch (err) { next(err); }
});

module.exports = router;
