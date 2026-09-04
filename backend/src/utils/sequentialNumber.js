/**
 * Igual que utils/ticketNumber.js pero genérico para cualquier modelo con
 * un campo de número secuencial por empresa (problem_number,
 * change_number, ...). Usa un advisory lock de Postgres con alcance de
 * transacción para serializar la asignación bajo concurrencia.
 */
async function getNextSequentialNumber(Model, numberField, companyId, transaction) {
  if (!transaction) throw new Error('getNextSequentialNumber requiere una transacción');
  const { sequelize } = require('../models');

  await sequelize.query('SELECT pg_advisory_xact_lock(hashtext(:key))', {
    replacements: { key: `${Model.name}:${numberField}:${companyId}` },
    transaction,
  });

  const last = await Model.findOne({
    where: { company_id: companyId },
    order: [[numberField, 'DESC']],
    attributes: [numberField],
    transaction,
  });

  return (last?.[numberField] || 0) + 1;
}

module.exports = { getNextSequentialNumber };
