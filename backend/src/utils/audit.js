/**
 * Registro de auditoría. Se llama explícitamente desde los puntos de
 * mutación más relevantes (no instrumenta automáticamente cada endpoint):
 * tickets, agentes, empresas, automatizaciones, SLA, activos, problemas,
 * cambios y login. Un fallo al auditar nunca debe romper la operación
 * real, por eso solo se loguea el error.
 */
async function logAudit(req, {
  action, entity_type, entity_id, before = null, after = null,
  // Overrides opcionales para casos sin req.user/req.companyId todavía
  // (ej. login, donde el usuario recién se resuelve en el propio handler).
  company_id, user_id, user_name,
}) {
  try {
    const { AuditLog } = require('../models');
    await AuditLog.create({
      company_id: company_id !== undefined ? company_id : (req.companyId || null),
      user_id:    user_id    !== undefined ? user_id    : (req.user?.id || null),
      user_name:  user_name  !== undefined ? user_name  : (req.user?.name || null),
      action, entity_type, entity_id,
      before, after,
      ip_address: req.ip,
      user_agent: req.headers?.['user-agent']?.slice(0, 500),
    });
  } catch (err) {
    console.error('[Audit] Error registrando evento:', err.message);
  }
}

module.exports = { logAudit };
