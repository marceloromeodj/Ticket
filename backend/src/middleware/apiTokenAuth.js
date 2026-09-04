const crypto = require('crypto');
const { ApiToken, Company } = require('../models');

/**
 * Autenticación para la API externa de integraciones (/api/external/*):
 * un token opaco generado desde Configuración > API, en vez de un JWT de
 * sesión. Deliberadamente separado de `authenticate` (middleware/auth.js)
 * para no tocar el resto de las rutas internas -- solo /api/external usa
 * esto.
 */
async function apiTokenAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token de API no proporcionado' });
  }

  const rawToken = authHeader.split(' ')[1];
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  const token = await ApiToken.findOne({ where: { token_hash: tokenHash, active: true } });
  if (!token) return res.status(401).json({ error: 'Token de API inválido' });

  const company = await Company.findByPk(token.company_id, { attributes: ['modules'] });
  if (company?.modules?.api === false) {
    return res.status(403).json({ error: 'El módulo de API externa no está habilitado para esta empresa' });
  }

  token.update({ last_used_at: new Date() }).catch(() => {});

  req.companyId = token.company_id;
  req.apiToken = token;
  next();
}

module.exports = { apiTokenAuth };
