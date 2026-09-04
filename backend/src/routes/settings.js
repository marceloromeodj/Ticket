const router = require('express').Router();
const { Company, CustomField } = require('../models');
const { authenticate, authorize, tenantMiddleware, requireCompanySelected } = require('../middleware/auth');

const adminOnly = authorize('super_admin', 'admin');

// La configuración es de una empresa concreta.
router.use(authenticate, tenantMiddleware, requireCompanySelected);

// Configuración general de la empresa. name/primary_color/timezone/
// logo_url/domain son columnas reales de Company; `settings` es el JSONB
// con las banderas de features (auto_assign, ticket_prefix, etc). Antes
// esta ruta devolvía/guardaba SOLO el JSONB, así que el formulario de
// "Configuración general" (que edita name/color/timezone) en realidad
// nunca tocaba esas columnas: quedaban mezcladas dentro del JSONB y el
// resto de la app (branding del login, etc.) seguía viendo los valores
// viejos sin importar lo que se guardara.
router.get('/', adminOnly, async (req, res, next) => {
  try {
    const company = await Company.findByPk(req.companyId);
    if (!company) return res.status(404).json({ error: 'Empresa no encontrada' });
    const { name, primary_color, timezone, logo_url, domain, settings } = company;
    res.json({ name, primary_color, timezone, logo_url, domain, settings });
  } catch (err) { next(err); }
});

router.put('/', adminOnly, async (req, res, next) => {
  try {
    const company = await Company.findByPk(req.companyId);
    if (!company) return res.status(404).json({ error: 'Empresa no encontrada' });

    const updates = {};
    ['name', 'primary_color', 'timezone', 'logo_url', 'domain'].forEach((f) => {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    });
    if (req.body.settings !== undefined) {
      updates.settings = { ...company.settings, ...req.body.settings };
    }

    await company.update(updates);
    const { name, primary_color, timezone, logo_url, domain, settings } = company;
    res.json({ name, primary_color, timezone, logo_url, domain, settings });
  } catch (err) { next(err); }
});

// Horario de atención
router.get('/business-hours', adminOnly, async (req, res, next) => {
  try {
    const company = await Company.findByPk(req.companyId, { attributes: ['business_hours'] });
    res.json(company?.business_hours || {});
  } catch (err) { next(err); }
});

router.put('/business-hours', adminOnly, async (req, res, next) => {
  try {
    const company = await Company.findByPk(req.companyId);
    await company.update({ business_hours: req.body });
    res.json(company.business_hours);
  } catch (err) { next(err); }
});

// Feriados (días puntuales sin atención, afecta el vencimiento de SLA
// cuando la política tiene "Solo horario laboral").
router.get('/holidays', adminOnly, async (req, res, next) => {
  try {
    const company = await Company.findByPk(req.companyId, { attributes: ['holidays'] });
    res.json(company?.holidays || []);
  } catch (err) { next(err); }
});

router.put('/holidays', adminOnly, async (req, res, next) => {
  try {
    const company = await Company.findByPk(req.companyId);
    if (!Array.isArray(req.body)) return res.status(400).json({ error: 'Se espera un array de fechas' });
    await company.update({ holidays: req.body });
    res.json(company.holidays);
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
