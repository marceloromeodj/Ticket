const router = require('express').Router();
const { NotificationTemplate } = require('../models');
const { authenticate, authorize, tenantMiddleware, requireCompanySelected } = require('../middleware/auth');
const { DEFAULT_TEMPLATES, getTemplate } = require('../services/templateService');

router.use(authenticate, tenantMiddleware, authorize('super_admin', 'admin'), requireCompanySelected);

// Lista todos los eventos customizables con su valor efectivo actual
// (override de la empresa si existe, si no el default).
router.get('/', async (req, res, next) => {
  try {
    const events = Object.keys(DEFAULT_TEMPLATES);
    const templates = await Promise.all(events.map((event) => getTemplate(req.companyId, event)));
    res.json({ templates });
  } catch (err) { next(err); }
});

router.put('/:event', async (req, res, next) => {
  try {
    const def = DEFAULT_TEMPLATES[req.params.event];
    if (!def) return res.status(404).json({ error: 'Evento desconocido' });

    const { subject, body } = req.body;
    if (!body?.trim()) return res.status(400).json({ error: 'El contenido es requerido' });

    const [template] = await NotificationTemplate.upsert({
      company_id: req.companyId,
      event: req.params.event,
      channel: def.channel,
      subject: def.channel === 'email' ? subject : null,
      body,
    }, { returning: true });

    res.json(await getTemplate(req.companyId, req.params.event) || template);
  } catch (err) { next(err); }
});

// Revertir al default (borra el override de la empresa).
router.delete('/:event', async (req, res, next) => {
  try {
    await NotificationTemplate.destroy({ where: { company_id: req.companyId, event: req.params.event } });
    res.json(await getTemplate(req.companyId, req.params.event));
  } catch (err) { next(err); }
});

module.exports = router;
