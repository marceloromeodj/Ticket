const router = require('express').Router();
const { Company, Branch, User } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const { getSubdomainSlug } = require('../utils/subdomain');
const { logAudit } = require('../utils/audit');

// Público (sin autenticar): resuelve la empresa a partir del subdominio de
// la URL, para mostrar su nombre/logo en la pantalla de login (y para que
// el portal de clientes sepa a qué empresa pertenece) antes de que el
// usuario se identifique. Solo expone campos de marca, nada sensible.
// Debe registrarse antes de router.use(authenticate).
router.get('/resolve', async (req, res, next) => {
  try {
    const slug = getSubdomainSlug(req);
    const attributes = ['id', 'name', 'slug', 'logo_url', 'primary_color'];

    if (slug) {
      const company = await Company.findOne({ where: { slug, active: true }, attributes });
      return res.json({ company: company || null });
    }

    // Sin modo multi-subdominio configurado: si la instalación tiene una
    // sola empresa activa (el caso típico fuera de un SaaS multi-tenant),
    // se resuelve a esa por defecto -- si no, no hay forma de saber cuál
    // es sin un subdominio, así que se devuelve null.
    const activeCompanies = await Company.findAll({ where: { active: true }, attributes, limit: 2 });
    res.json({ company: activeCompanies.length === 1 ? activeCompanies[0] : null });
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
    await logAudit(req, { action: 'create', entity_type: 'Company', entity_id: company.id, company_id: company.id, after: company.toJSON() });
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

    const before = company.toJSON();
    const allowed = ['name','timezone','plan','max_agents','settings','business_hours','primary_color','logo_url'];
    const updates = {};
    allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

    await company.update(updates);
    await logAudit(req, { action: 'update', entity_type: 'Company', entity_id: company.id, company_id: company.id, before, after: company.toJSON() });
    res.json(company);
  } catch (err) { next(err); }
});

// Regenerar el token del webhook de monitoreo (por si se filtró)
router.post('/:id/regenerate-webhook-token', authorize('super_admin', 'admin'), async (req, res, next) => {
  try {
    const id = req.user.role === 'super_admin' ? req.params.id : req.companyId;
    const company = await Company.findByPk(id);
    if (!company) return res.status(404).json({ error: 'Empresa no encontrada' });

    await company.update({ monitoring_webhook_token: require('crypto').randomBytes(24).toString('hex') });
    await logAudit(req, { action: 'regenerate_webhook_token', entity_type: 'Company', entity_id: company.id, company_id: company.id });
    res.json({ monitoring_webhook_token: company.monitoring_webhook_token });
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
