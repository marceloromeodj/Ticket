const { Op, fn, col, literal } = require('sequelize');
const moment = require('moment-timezone');
const { rowsToExcelBuffer } = require('../utils/exportService');

const PERIOD_DAYS = { daily: 1, weekly: 7, monthly: 30 };

/**
 * Arma el workbook de un reporte programado. Consultas simplificadas
 * respecto a reportController (que sirve a la UI con filtros interactivos)
 * -- acá el período lo define la frecuencia del envío, sin filtros extra.
 */
async function buildReportWorkbook(companyId, reportType, frequency = 'weekly') {
  const { Ticket, User, TicketSurvey } = require('../models');
  const from = moment().subtract(PERIOD_DAYS[frequency] || 7, 'days').toDate();
  const to = new Date();
  const baseWhere = { company_id: companyId, created_at: { [Op.between]: [from, to] } };

  if (reportType === 'overview') {
    const [total, open, resolved, closed, breached] = await Promise.all([
      Ticket.count({ where: baseWhere }),
      Ticket.count({ where: { ...baseWhere, status: 'open' } }),
      Ticket.count({ where: { ...baseWhere, status: 'resolved' } }),
      Ticket.count({ where: { ...baseWhere, status: 'closed' } }),
      Ticket.count({ where: { ...baseWhere, sla_status: 'breached' } }),
    ]);
    return rowsToExcelBuffer({
      sheetName: 'Resumen',
      columns: [{ header: 'Métrica', key: 'k', width: 30 }, { header: 'Valor', key: 'v', width: 15 }],
      rows: [
        { k: 'Total de tickets', v: total },
        { k: 'Abiertos', v: open },
        { k: 'Resueltos', v: resolved },
        { k: 'Cerrados', v: closed },
        { k: 'SLA incumplidos', v: breached },
      ],
    });
  }

  if (reportType === 'sla') {
    const [ok, warning, breached] = await Promise.all([
      Ticket.count({ where: { ...baseWhere, sla_status: 'ok' } }),
      Ticket.count({ where: { ...baseWhere, sla_status: 'warning' } }),
      Ticket.count({ where: { ...baseWhere, sla_status: 'breached' } }),
    ]);
    return rowsToExcelBuffer({
      sheetName: 'SLA',
      columns: [{ header: 'Estado SLA', key: 'k', width: 20 }, { header: 'Cantidad', key: 'v', width: 12 }],
      rows: [{ k: 'Cumplido', v: ok }, { k: 'En riesgo', v: warning }, { k: 'Incumplido', v: breached }],
    });
  }

  if (reportType === 'agent_performance') {
    const data = await Ticket.findAll({
      where: { ...baseWhere, agent_id: { [Op.ne]: null } },
      attributes: [
        'agent_id',
        [fn('COUNT', col('Ticket.id')), 'total'],
        [fn('COUNT', literal("CASE WHEN status = 'resolved' OR status = 'closed' THEN 1 END")), 'resolved'],
      ],
      include: [{ model: User, as: 'agent', attributes: ['name'] }],
      group: ['agent_id', 'agent.id'],
      raw: true,
      nest: true,
    });
    return rowsToExcelBuffer({
      sheetName: 'Performance de agentes',
      columns: [
        { header: 'Agente', key: 'agent', width: 25 },
        { header: 'Total', key: 'total', width: 10 },
        { header: 'Resueltos', key: 'resolved', width: 12 },
      ],
      rows: data.map(d => ({ agent: d.agent?.name || '—', total: d.total, resolved: d.resolved })),
    });
  }

  if (reportType === 'satisfaction') {
    const surveys = await TicketSurvey.findAll({
      where: { company_id: companyId, responded_at: { [Op.between]: [from, to] } },
      include: [{ model: Ticket, as: 'ticket', attributes: ['ticket_number'] }],
    });
    return rowsToExcelBuffer({
      sheetName: 'Satisfacción',
      columns: [
        { header: 'Ticket', key: 'ticket_number', width: 12 },
        { header: 'Calificación', key: 'rating', width: 14 },
        { header: 'Comentario', key: 'comment', width: 40 },
      ],
      rows: surveys.map(s => ({ ticket_number: s.ticket?.ticket_number, rating: s.rating, comment: s.comment || '' })),
    });
  }

  throw new Error(`Tipo de reporte desconocido: ${reportType}`);
}

module.exports = { buildReportWorkbook };
