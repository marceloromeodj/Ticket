const router = require('express').Router();
const { Op } = require('sequelize');
const { Contract, Vendor, Asset } = require('../models');
const { authenticate, authorize, tenantMiddleware, companyScope, requireCompanySelected } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

router.use(authenticate, tenantMiddleware);

const includeRefs = [
  { model: Vendor, as: 'vendor', attributes: ['id', 'name'] },
  { model: Asset,  as: 'asset',  attributes: ['id', 'asset_tag', 'name'] },
];

router.get('/', async (req, res, next) => {
  try {
    const { active, expiring_days } = req.query;
    const where = { ...companyScope(req) };
    if (active !== 'all') where.active = active === undefined ? true : active === 'true';
    if (expiring_days) {
      const threshold = new Date(Date.now() + parseInt(expiring_days) * 24 * 60 * 60 * 1000);
      where.end_date = { [Op.lte]: threshold };
    }

    const contracts = await Contract.findAll({ where, include: includeRefs, order: [['end_date', 'ASC']] });
    res.json({ contracts });
  } catch (err) { next(err); }
});

router.post('/', authorize('super_admin', 'admin'), requireCompanySelected, async (req, res, next) => {
  try {
    const allowed = ['vendor_id', 'asset_id', 'name', 'type', 'cost', 'currency', 'start_date', 'end_date', 'renewal_alert_days', 'notes'];
    const data = { company_id: req.companyId };
    allowed.forEach(f => { if (req.body[f] !== undefined) data[f] = req.body[f]; });

    const contract = await Contract.create(data);
    await logAudit(req, { action: 'create', entity_type: 'Contract', entity_id: contract.id, after: data });

    const full = await Contract.findByPk(contract.id, { include: includeRefs });
    res.status(201).json(full);
  } catch (err) { next(err); }
});

router.put('/:id', authorize('super_admin', 'admin'), async (req, res, next) => {
  try {
    const contract = await Contract.findOne({ where: { id: req.params.id, ...companyScope(req) } });
    if (!contract) return res.status(404).json({ error: 'Contrato no encontrado' });

    const allowed = ['vendor_id', 'asset_id', 'name', 'type', 'cost', 'currency', 'start_date', 'end_date', 'renewal_alert_days', 'notes', 'active'];
    const updates = {};
    allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
    // Si se extiende la fecha de vencimiento, vuelve a habilitar el aviso.
    if (updates.end_date && updates.end_date !== contract.end_date) updates.alert_sent = false;

    await contract.update(updates);
    const full = await Contract.findByPk(contract.id, { include: includeRefs });
    res.json(full);
  } catch (err) { next(err); }
});

router.delete('/:id', authorize('super_admin', 'admin'), async (req, res, next) => {
  try {
    const contract = await Contract.findOne({ where: { id: req.params.id, ...companyScope(req) } });
    if (!contract) return res.status(404).json({ error: 'Contrato no encontrado' });
    await contract.update({ active: false });
    res.json({ message: 'Contrato desactivado' });
  } catch (err) { next(err); }
});

module.exports = router;
