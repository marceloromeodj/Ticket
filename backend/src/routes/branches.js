const router = require('express').Router();
const { Branch } = require('../models');
const { authenticate, authorize, tenantMiddleware } = require('../middleware/auth');

router.use(authenticate, tenantMiddleware);

router.get('/', async (req, res, next) => {
  try {
    const branches = await Branch.findAll({
      where: { company_id: req.companyId },
      order: [['name', 'ASC']],
    });
    res.json(branches);
  } catch (err) { next(err); }
});

router.post('/', authorize('super_admin','admin'), async (req, res, next) => {
  try {
    const { name, code, address, phone, email, timezone } = req.body;
    const branch = await Branch.create({ company_id: req.companyId, name, code, address, phone, email, timezone });
    res.status(201).json(branch);
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const branch = await Branch.findOne({ where: { id: req.params.id, company_id: req.companyId } });
    if (!branch) return res.status(404).json({ error: 'Sucursal no encontrada' });
    res.json(branch);
  } catch (err) { next(err); }
});

router.put('/:id', authorize('super_admin','admin'), async (req, res, next) => {
  try {
    const branch = await Branch.findOne({ where: { id: req.params.id, company_id: req.companyId } });
    if (!branch) return res.status(404).json({ error: 'Sucursal no encontrada' });
    const allowed = ['name','code','address','phone','email','timezone','settings','active'];
    const updates = {};
    allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
    await branch.update(updates);
    res.json(branch);
  } catch (err) { next(err); }
});

router.delete('/:id', authorize('super_admin','admin'), async (req, res, next) => {
  try {
    const branch = await Branch.findOne({ where: { id: req.params.id, company_id: req.companyId } });
    if (!branch) return res.status(404).json({ error: 'Sucursal no encontrada' });
    await branch.update({ active: false });
    res.json({ message: 'Sucursal desactivada' });
  } catch (err) { next(err); }
});

module.exports = router;
