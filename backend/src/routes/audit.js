const router = require('express').Router();
const { AuditLog, User } = require('../models');
const { authenticate, authorize, tenantMiddleware, companyScope, requireModule } = require('../middleware/auth');
const { Op } = require('sequelize');

// Solo admins pueden ver el registro de auditoría de su empresa;
// super_admin sin empresa seleccionada ve todo (mismo criterio que el
// resto de la app, vía companyScope).
router.use(authenticate, tenantMiddleware, authorize('super_admin', 'admin'), requireModule('audit'));

router.get('/', async (req, res, next) => {
  try {
    const { entity_type, action, user_id, from, to, page = 1, limit = 50 } = req.query;
    const where = { ...companyScope(req) };
    if (entity_type) where.entity_type = entity_type;
    if (action)      where.action = action;
    if (user_id)     where.user_id = user_id;
    if (from || to) {
      where.created_at = {};
      if (from) where.created_at[Op.gte] = new Date(from);
      if (to)   where.created_at[Op.lte] = new Date(to);
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const { count, rows } = await AuditLog.findAndCountAll({
      where,
      include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email'] }],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset,
    });

    res.json({
      data: rows,
      meta: { total: count, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(count / parseInt(limit)) },
    });
  } catch (err) { next(err); }
});

module.exports = router;
