const router = require('express').Router();
const { Company, Branch, User } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const { getSubdomainSlug } = require('../utils/subdomain');

// Público (sin autenticar): resuelve la empresa a partir del subdominio de
// la URL, para mostrar su nombre/logo en la pantalla de login antes de que
// el usuario se identifique. Solo expone campos de marca, nada sensible.
// Debe registrarse antes de router.use(authenticate).
router.get('/resolve', async (req, res, next) => {
  try {
    const slug = getSubdomainSlug(req);
    if (!slug) return res.json({ company: null });

    const company = await Company.findOne({
      where: { slug, active: true },
      attributes: ['id', 'name', 'slug', 'logo_url', 'primary_color'],
    });
    res.json({ company: company || null });
  } catch (err) { next(err); }
});

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
