const jwt = require('jsonwebtoken');
const { User } = require('../models');

/**
 * Middleware de autenticación JWT.
 * Inyecta req.user con datos del token.
 */
async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token no proporcionado' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Verificar que el usuario aún existe y está activo. Se incluyen las
    // sucursales adicionales (más allá de branch_id, la "principal") para
    // que los agentes con acceso a varias sucursales vean los tickets de
    // todas ellas, no solo de la principal.
    const user = await User.findOne({
      where: { id: decoded.id, active: true },
      include: [{ association: 'branches', attributes: ['id'] }],
    });

    if (!user) {
      return res.status(401).json({ error: 'Usuario no encontrado o inactivo' });
    }

    // Si la contraseña cambió después de emitido este token, invalidarlo.
    // Sin esto, un token robado o filtrado seguía siendo válido hasta su
    // expiración natural incluso después de que el usuario cambiara su
    // contraseña para revocarlo.
    if (user.password_changed_at && decoded.iat * 1000 < new Date(user.password_changed_at).getTime()) {
      return res.status(401).json({ error: 'Sesión inválida, iniciá sesión nuevamente', code: 'TOKEN_EXPIRED' });
    }

    // req.branchId sigue siendo la sucursal principal (compatibilidad con
    // el resto del código: asignación por defecto de tickets, etc.).
    // req.branchIds es la lista completa de sucursales a las que el
    // usuario tiene acceso (principal + adicionales vía user_branches),
    // usada para filtrar qué tickets puede ver un agente.
    const extraBranchIds = (user.branches || []).map(b => b.id);
    req.user = user;
    req.companyId = user.company_id;
    req.branchId  = user.branch_id;
    req.branchIds = Array.from(new Set([user.branch_id, ...extraBranchIds].filter(Boolean)));
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expirado', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ error: 'Token inválido' });
  }
}

/**
 * Verificar rol(es). Uso: authorize('admin', 'supervisor')
 */
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'No autenticado' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Sin permisos suficientes' });
    }
    next();
  };
}

/**
 * Solo super_admin o admin de la misma empresa.
 */
function adminOrSuperAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  if (['super_admin', 'admin'].includes(req.user.role)) return next();
  return res.status(403).json({ error: 'Se requiere rol de administrador' });
}

/**
 * Inyecta el companyId desde header X-Company-ID (útil para super_admin)
 */
function tenantMiddleware(req, res, next) {
  if (req.user?.role === 'super_admin') {
    const headerCompany = req.headers['x-company-id'];
    if (headerCompany) req.companyId = headerCompany;
  }
  next();
}

/**
 * Condición de empresa a usar en un `where` de Sequelize. Si el usuario
 * (o el super_admin, vía X-Company-ID) tiene una empresa activa, filtra
 * por ella. Si un super_admin no eligió ninguna (vista global), no
 * filtra. Cualquier otro caso sin company_id no debería ocurrir, pero
 * por seguridad no devuelve resultados en vez de romper la query con un
 * `undefined` en el where.
 */
function companyScope(req) {
  if (req.companyId) return { company_id: req.companyId };
  if (req.user?.role === 'super_admin') return {};
  return { company_id: '00000000-0000-0000-0000-000000000000' };
}

/**
 * Para creación de registros: un super_admin sin empresa seleccionada
 * (vista global) no puede crear un agente/sucursal/categoría/etc. porque
 * esos registros necesitan pertenecer a una empresa concreta.
 */
function requireCompanySelected(req, res, next) {
  if (!req.companyId) {
    return res.status(400).json({ error: 'Seleccioná una empresa antes de crear este registro' });
  }
  next();
}

module.exports = { authenticate, authorize, adminOrSuperAdmin, tenantMiddleware, companyScope, requireCompanySelected };
