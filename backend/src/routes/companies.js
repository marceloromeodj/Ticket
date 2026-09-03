const router = require('express').Router();
const { Company, Branch, User } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

// Solo super_admin puede gestionar empresas
router.get('/', authorize('super_admin'), async (req, res, next) => {
  try {
    const companies = await Company.findAll({
      include: [{ model: Branch, as: 'branches', where: { active: true }, required: false }],
      order: [['name', 'ASC']],
    });
    res.json(companies);
  } catch (err) { next(err); }
});

router.post('/', authorize('super_admin'), async (req, res, next) => {
  try {
    const { name, slug, timezone, plan, max_agents, settings } = req.body;
    const company = await Company.create({ name, slug, timezone, plan, max_agents, settings });
    res.status(201).json(company);
  } catch (err) { next(err); }
});

router.get('/:id', authorize('super_admin','admin'), async (req, res, next) => {
  try {
    const where = { id: req.user.role === 'super_admin' ? req.params.id : req.companyId };
    const company = await Company.findOne({
      where,
      include: [{ model: Branch, as: 'branches' }],
    });
    if (!company) return res.status(404).json({ error: 'Empresa no encontrada' });
    res.json(company);
  } catch (err) { next(err); }
});

router.put('/:id', authorize('super_admin','admin'), async (req, res, next) => {
  try {
    const id = req.user.role === 'super_admin' ? req.params.id : req.companyId;
    const company = await Company.findByPk(id);
    if (!company) return res.status(404).json({ error: 'Empresa no encontrada' });

    const allowed = ['name','timezone','plan','max_agents','settings','business_hours','primary_color','logo_url'];
    const updates = {};
    allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

    await company.update(updates);
    res.json(company);
  } catch (err) { next(err); }
});

// Stats de empresa
router.get('/:id/stats', authorize('super_admin','admin'), async (req, res, next) => {
  try {
    const companyId = req.user.role === 'super_admin' ? req.params.id : req.companyId;
    const [agents, branches] = await Promise.all([
      User.count({ where: { company_id: companyId, active: true, role: { [require('sequelize').Op.ne]: 'customer' } } }),
      Branch.count({ where: { company_id: companyId, active: true } }),
    ]);
    res.json({ agents, branches });
  } catch (err) { next(err); }
});

module.exports = router;
