const router = require('express').Router();
const { Category } = require('../models');
const { authenticate, authorize, tenantMiddleware, companyScope, requireCompanySelected } = require('../middleware/auth');

router.use(authenticate, tenantMiddleware);

router.get('/', async (req, res, next) => {
  try {
    const cats = await Category.findAll({
      where: companyScope(req),
      include: [{ model: Category, as: 'children', required: false }],
      order: [['position','ASC'],['name','ASC']],
    });
    res.json(cats);
  } catch (err) { next(err); }
});

router.post('/', authorize('super_admin','admin'), requireCompanySelected, async (req, res, next) => {
  try {
    const { name, description, parent_id, icon, color, position } = req.body;
    const cat = await Category.create({ company_id: req.companyId, name, description, parent_id, icon, color, position });
    res.status(201).json(cat);
  } catch (err) { next(err); }
});

router.put('/:id', authorize('super_admin','admin'), async (req, res, next) => {
  try {
    const cat = await Category.findOne({ where: { id: req.params.id, ...companyScope(req) } });
    if (!cat) return res.status(404).json({ error: 'Categoría no encontrada' });
    await cat.update(req.body);
    res.json(cat);
  } catch (err) { next(err); }
});

router.delete('/:id', authorize('super_admin','admin'), async (req, res, next) => {
  try {
    await Category.update({ active: false }, { where: { id: req.params.id, ...companyScope(req) } });
    res.json({ message: 'Categoría desactivada' });
  } catch (err) { next(err); }
});

module.exports = router;
