const router = require('express').Router();
const { KnowledgeArticle, Category } = require('../models');
const { authenticate, authorize, tenantMiddleware, companyScope, requireCompanySelected } = require('../middleware/auth');
const { Op } = require('sequelize');

router.use(authenticate, tenantMiddleware);

router.get('/', async (req, res, next) => {
  try {
    const { search, status, category_id, visibility } = req.query;
    const where = { ...companyScope(req) };
    if (status)      where.status     = status;
    if (category_id) where.category_id = category_id;
    if (visibility)  where.visibility  = visibility;
    if (search) where[Op.or] = [{ title: { [Op.iLike]: `%${search}%` } }, { summary: { [Op.iLike]: `%${search}%` } }];

    const articles = await KnowledgeArticle.findAll({
      where,
      include: [{ model: Category, as: 'category', attributes: ['id','name'] }],
      order: [['created_at', 'DESC']],
    });
    res.json(articles);
  } catch (err) { next(err); }
});

router.post('/', authorize('super_admin','admin','supervisor','agent'), requireCompanySelected, async (req, res, next) => {
  try {
    const { title, summary, content, status, visibility, category_id, tags, is_faq } = req.body;
    const slug = title.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '').substring(0, 100) + '-' + Date.now();
    const article = await KnowledgeArticle.create({
      company_id: req.companyId, category_id, author_id: req.user.id,
      title, slug, summary, content, status, visibility, tags, is_faq: !!is_faq,
      published_at: status === 'published' ? new Date() : null,
    });
    res.status(201).json(article);
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const article = await KnowledgeArticle.findOne({ where: { id: req.params.id, ...companyScope(req) } });
    if (!article) return res.status(404).json({ error: 'Artículo no encontrado' });
    await article.increment('views');
    res.json(article);
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const article = await KnowledgeArticle.findOne({ where: { id: req.params.id, ...companyScope(req) } });
    if (!article) return res.status(404).json({ error: 'Artículo no encontrado' });
    const allowed = ['title','summary','content','status','visibility','category_id','tags','meta_title','meta_desc','is_faq'];
    const updates = {};
    allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
    if (updates.status === 'published' && article.status !== 'published') updates.published_at = new Date();
    await article.update(updates);
    res.json(article);
  } catch (err) { next(err); }
});

router.post('/:id/vote', async (req, res, next) => {
  try {
    const { helpful } = req.body;
    const article = await KnowledgeArticle.findOne({ where: { id: req.params.id, ...companyScope(req) } });
    if (!article) return res.status(404).json({ error: 'Artículo no encontrado' });
    if (helpful) await article.increment('helpful');
    else         await article.increment('not_helpful');
    res.json({ helpful: article.helpful, not_helpful: article.not_helpful });
  } catch (err) { next(err); }
});

router.delete('/:id', authorize('super_admin','admin'), async (req, res, next) => {
  try {
    await KnowledgeArticle.update({ status: 'archived' }, { where: { id: req.params.id, ...companyScope(req) } });
    res.json({ message: 'Artículo archivado' });
  } catch (err) { next(err); }
});

module.exports = router;
