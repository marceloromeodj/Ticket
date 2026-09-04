const crypto = require('crypto');
const router = require('express').Router();
const { ApiToken } = require('../models');
const { authenticate, authorize, tenantMiddleware, companyScope, requireCompanySelected } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

router.use(authenticate, tenantMiddleware, authorize('super_admin', 'admin'), requireCompanySelected);

router.get('/', async (req, res, next) => {
  try {
    const tokens = await ApiToken.findAll({
      where: { ...companyScope(req) },
      attributes: ['id', 'name', 'token_prefix', 'last_used_at', 'active', 'created_at'],
      order: [['created_at', 'DESC']],
    });
    res.json({ tokens });
  } catch (err) { next(err); }
});

// Devuelve el token en texto plano UNA sola vez, en la respuesta de
// creación -- después solo se guarda el hash, no se puede volver a ver.
router.post('/', async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'El nombre es requerido' });

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const token = await ApiToken.create({
      company_id: req.companyId,
      created_by: req.user.id,
      name,
      token_hash: tokenHash,
      token_prefix: rawToken.slice(0, 8),
    });
    await logAudit(req, { action: 'create', entity_type: 'ApiToken', entity_id: token.id, after: { name } });

    res.status(201).json({
      id: token.id, name: token.name, token_prefix: token.token_prefix,
      token: rawToken, // ¡único momento en que se devuelve!
    });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const token = await ApiToken.findOne({ where: { id: req.params.id, ...companyScope(req) } });
    if (!token) return res.status(404).json({ error: 'Token no encontrado' });
    await token.update({ active: false });
    await logAudit(req, { action: 'revoke', entity_type: 'ApiToken', entity_id: token.id });
    res.json({ message: 'Token revocado' });
  } catch (err) { next(err); }
});

module.exports = router;
