const router = require('express').Router();
const { Tag } = require('../models');
const { authenticate, tenantMiddleware, companyScope, requireCompanySelected } = require('../middleware/auth');

router.use(authenticate, tenantMiddleware);

router.get('/', async (req, res, next) => {
  try {
    const tags = await Tag.findAll({ where: companyScope(req), order: [['name','ASC']] });
    res.json(tags);
  } catch (err) { next(err); }
});

router.post('/', requireCompanySelected, async (req, res, next) => {
  try {
    const { name, color } = req.body;
    const [tag, created] = await Tag.findOrCreate({ where: { company_id: req.companyId, name }, defaults: { color } });
    res.status(created ? 201 : 200).json(tag);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await Tag.destroy({ where: { id: req.params.id, ...companyScope(req) } });
    res.json({ message: 'Tag eliminado' });
  } catch (err) { next(err); }
});

module.exports = router;
