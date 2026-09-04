const router = require('express').Router();
const { Vendor } = require('../models');
const { authenticate, authorize, tenantMiddleware, companyScope, requireCompanySelected } = require('../middleware/auth');

router.use(authenticate, tenantMiddleware);

router.get('/', async (req, res, next) => {
  try {
    const { active } = req.query;
    const where = { ...companyScope(req) };
    if (active !== 'all') where.active = active === undefined ? true : active === 'true';

    const vendors = await Vendor.findAll({ where, order: [['name', 'ASC']] });
    res.json({ vendors });
  } catch (err) { next(err); }
});

router.post('/', authorize('super_admin', 'admin'), requireCompanySelected, async (req, res, next) => {
  try {
    const allowed = ['name', 'contact_name', 'contact_email', 'contact_phone', 'notes'];
    const data = { company_id: req.companyId };
    allowed.forEach(f => { if (req.body[f] !== undefined) data[f] = req.body[f]; });

    const vendor = await Vendor.create(data);
    res.status(201).json(vendor);
  } catch (err) { next(err); }
});

router.put('/:id', authorize('super_admin', 'admin'), async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ where: { id: req.params.id, ...companyScope(req) } });
    if (!vendor) return res.status(404).json({ error: 'Proveedor no encontrado' });

    const allowed = ['name', 'contact_name', 'contact_email', 'contact_phone', 'notes', 'active'];
    const updates = {};
    allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

    await vendor.update(updates);
    res.json(vendor);
  } catch (err) { next(err); }
});

router.delete('/:id', authorize('super_admin', 'admin'), async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ where: { id: req.params.id, ...companyScope(req) } });
    if (!vendor) return res.status(404).json({ error: 'Proveedor no encontrado' });
    await vendor.update({ active: false });
    res.json({ message: 'Proveedor desactivado' });
  } catch (err) { next(err); }
});

module.exports = router;
