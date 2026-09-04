const router = require('express').Router();
const { Company, CustomField } = require('../models');
const { authenticate, authorize, tenantMiddleware, requireCompanySelected } = require('../middleware/auth');

const adminOnly = authorize('super_admin', 'admin');

// La configuración es de una empresa concreta.
router.use(authenticate, tenantMiddleware, requireCompanySelected);

// Configuración general de la empresa
router.get('/', adminOnly, async (req, res, next) => {
  try {
    const company = await Company.findByPk(req.companyId);
    if (!company) return res.status(404).json({ error: 'Empresa no encontrada' });
    res.json(company.settings);
  } catch (err) { next(err); }
});

router.put('/', adminOnly, async (req, res, next) => {
  try {
    const company = await Company.findByPk(req.companyId);
    if (!company) return res.status(404).json({ error: 'Empresa no encontrada' });
    const settings = { ...company.settings, ...req.body };
    await company.update({ settings });
    res.json(settings);
  } catch (err) { next(err); }
});

// Horario de atención
router.put('/business-hours', adminOnly, async (req, res, next) => {
  try {
    const company = await Company.findByPk(req.companyId);
    await company.update({ business_hours: req.body });
    res.json(company.business_hours);
  } catch (err) { next(err); }
});

// Custom fields — la lectura es para cualquier rol autenticado de la
// empresa (agentes incluidos), porque necesitan las definiciones para
// renderizar el formulario de nuevo ticket. Solo admin puede crearlos/
// editarlos/desactivarlos.
router.get('/custom-fields', async (req, res, next) => {
  try {
    const { entity = 'ticket' } = req.query;
    const fields = await CustomField.findAll({ where: { company_id: req.companyId, entity, active: true }, order: [['position','ASC']] });
    res.json(fields);
  } catch (err) { next(err); }
});

router.post('/custom-fields', adminOnly, async (req, res, next) => {
  try {
    const field = await CustomField.create({ company_id: req.companyId, ...req.body });
    res.status(201).json(field);
  } catch (err) { next(err); }
});

router.put('/custom-fields/:id', adminOnly, async (req, res, next) => {
  try {
    const field = await CustomField.findOne({ where: { id: req.params.id, company_id: req.companyId } });
    if (!field) return res.status(404).json({ error: 'Campo no encontrado' });
    await field.update(req.body);
    res.json(field);
  } catch (err) { next(err); }
});

router.delete('/custom-fields/:id', adminOnly, async (req, res, next) => {
  try {
    await CustomField.update({ active: false }, { where: { id: req.params.id, company_id: req.companyId } });
    res.json({ message: 'Campo desactivado' });
  } catch (err) { next(err); }
});

module.exports = router;
