const router = require('express').Router();
const { ScheduledReport } = require('../models');
const { authenticate, authorize, tenantMiddleware, requireCompanySelected, requireModule } = require('../middleware/auth');

router.use(authenticate, tenantMiddleware, authorize('super_admin', 'admin', 'supervisor'), requireCompanySelected, requireModule('scheduled_reports'));

router.get('/', async (req, res, next) => {
  try {
    const reports = await ScheduledReport.findAll({ where: { company_id: req.companyId }, order: [['created_at', 'DESC']] });
    res.json({ reports });
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const { report_type, frequency = 'weekly', recipients = [], format = 'excel' } = req.body;
    if (!recipients.length) return res.status(400).json({ error: 'Agregá al menos un destinatario' });

    const report = await ScheduledReport.create({ company_id: req.companyId, report_type, frequency, recipients, format });
    res.status(201).json(report);
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const report = await ScheduledReport.findOne({ where: { id: req.params.id, company_id: req.companyId } });
    if (!report) return res.status(404).json({ error: 'No encontrado' });

    const allowed = ['frequency', 'recipients', 'format', 'active'];
    const updates = {};
    allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
    await report.update(updates);
    res.json(report);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const report = await ScheduledReport.findOne({ where: { id: req.params.id, company_id: req.companyId } });
    if (!report) return res.status(404).json({ error: 'No encontrado' });
    await report.destroy();
    res.json({ message: 'Eliminado' });
  } catch (err) { next(err); }
});

module.exports = router;
