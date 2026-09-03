/**
 * Genera el próximo número de ticket para una empresa de forma segura
 * bajo concurrencia. Usa un advisory lock de Postgres con alcance de
 * transacción (se libera solo al hacer commit/rollback) para serializar
 * la asignación de números por company_id sin bloquear toda la tabla.
 *
 * Requiere ejecutarse dentro de una transacción.
 */
async function getNextTicketNumber(companyId, transaction) {
  if (!transaction) throw new Error('getNextTicketNumber requiere una transacción');
  const { sequelize, Ticket } = require('../models');

  await sequelize.query('SELECT pg_advisory_xact_lock(hashtext(:companyId))', {
    replacements: { companyId: String(companyId) },
    transaction,
  });

  const last = await Ticket.findOne({
    where: { company_id: companyId },
    order: [['ticket_number', 'DESC']],
    attributes: ['ticket_number'],
    transaction,
  });

  return (last?.ticket_number || 0) + 1;
}

module.exports = { getNextTicketNumber };
