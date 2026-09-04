const router = require('express').Router();
const { CannedResponse } = require('../models');
const { authenticate, tenantMiddleware, requireCompanySelected } = require('../middleware/auth');
const { Op } = require('sequelize');

// Las respuestas rápidas son de una empresa concreta.
router.use(authenticate, tenantMiddleware, requireCompanySelected);

router.get('/', async (req, res, next) => {
  try {
    const { search } = req.query;
    const where = {
      company_id: req.companyId,
      [Op.or]: [{ agent_id: null }, { agent_id: req.user.id }],
    };
    if (search) where[Op.and] = [{ title: { [Op.iLike]: `%${search}%` } }];
    const items = await CannedResponse.findAll({ where, order: [['title','ASC']] });
    res.json(items);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const { title, content, shortcut, category, shared } = req.body;
    const item = await CannedResponse.create({
      company_id: req.companyId,
      agent_id:   shared ? null : req.user.id,
      title, content, shortcut, category,
    });
    res.status(201).json(item);
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const item = await CannedResponse.findOne({ where: { id: req.params.id, company_id: req.companyId } });
    if (!item) return res.status(404).json({ error: 'Respuesta rápida no encontrada' });
    await item.update(req.body);
    await item.increment('use_count');
    res.json(item);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await CannedResponse.destroy({ where: { id: req.params.id, company_id: req.companyId } });
    res.json({ message: 'Respuesta eliminada' });
  } catch (err) { next(err); }
});

module.exports = router;
