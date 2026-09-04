const router = require('express').Router();
const { EmailInbox, Branch } = require('../models');
const { authenticate, authorize, tenantMiddleware, requireCompanySelected } = require('../middleware/auth');
const { emailService } = require('../services/emailService');

// Las bandejas de email son de una empresa concreta.
router.use(authenticate, tenantMiddleware, authorize('super_admin','admin'), requireCompanySelected);

router.get('/', async (req, res, next) => {
  try {
    const inboxes = await EmailInbox.findAll({
      where: { company_id: req.companyId },
      attributes: { exclude: ['imap_pass','smtp_pass'] },
      include: [{ model: Branch, as: 'branch', attributes: ['id', 'name'] }],
      order: [['name', 'ASC']],
    });
    res.json(inboxes);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const inbox = await EmailInbox.create({ company_id: req.companyId, branch_id: req.branchId, ...req.body });
    res.status(201).json(inbox);
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const inbox = await EmailInbox.findOne({ where: { id: req.params.id, company_id: req.companyId } });
    if (!inbox) return res.status(404).json({ error: 'Bandeja no encontrada' });
    await inbox.update(req.body);
    res.json(inbox);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await EmailInbox.update({ active: false }, { where: { id: req.params.id, company_id: req.companyId } });
    res.json({ message: 'Bandeja desactivada' });
  } catch (err) { next(err); }
});

// Sincronizar manualmente
router.post('/:id/sync', async (req, res, next) => {
  try {
    const inbox = await EmailInbox.findOne({ where: { id: req.params.id, company_id: req.companyId } });
    if (!inbox) return res.status(404).json({ error: 'Bandeja no encontrada' });
    const result = await emailService.listenInbox(inbox);
    await inbox.update({ last_sync_at: new Date() });
    res.json(result);
  } catch (err) { next(err); }
});

module.exports = router;
