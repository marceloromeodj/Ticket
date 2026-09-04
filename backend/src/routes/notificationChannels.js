const router = require('express').Router();
const { NotificationChannel } = require('../models');
const { authenticate, authorize, tenantMiddleware, requireCompanySelected } = require('../middleware/auth');
const { notificationChannelService } = require('../services/notificationChannelService');

// Configuración por empresa: quién puede tocar esto es admin/super_admin.
router.use(authenticate, tenantMiddleware, authorize('super_admin', 'admin'), requireCompanySelected);

router.get('/', async (req, res, next) => {
  try {
    const channels = await NotificationChannel.findAll({ where: { company_id: req.companyId } });
    res.json({ channels });
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const { type, config, events } = req.body;
    if (!['slack', 'telegram'].includes(type)) return res.status(400).json({ error: 'Tipo inválido' });

    const channel = await NotificationChannel.create({ company_id: req.companyId, type, config, events });
    res.status(201).json(channel);
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const channel = await NotificationChannel.findOne({ where: { id: req.params.id, company_id: req.companyId } });
    if (!channel) return res.status(404).json({ error: 'Canal no encontrado' });

    const allowed = ['config', 'events', 'active'];
    const updates = {};
    allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
    await channel.update(updates);
    res.json(channel);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const channel = await NotificationChannel.findOne({ where: { id: req.params.id, company_id: req.companyId } });
    if (!channel) return res.status(404).json({ error: 'Canal no encontrado' });
    await channel.destroy();
    res.json({ message: 'Canal eliminado' });
  } catch (err) { next(err); }
});

// Enviar un mensaje de prueba para validar la configuración
router.post('/:id/test', async (req, res, next) => {
  try {
    const channel = await NotificationChannel.findOne({ where: { id: req.params.id, company_id: req.companyId } });
    if (!channel) return res.status(404).json({ error: 'Canal no encontrado' });

    await notificationChannelService.sendToChannel(channel, '✅ Mensaje de prueba desde HelpDesk');
    res.json({ message: 'Mensaje de prueba enviado (revisá el canal)' });
  } catch (err) { next(err); }
});

module.exports = router;
