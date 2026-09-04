const { Op, fn, col, literal } = require('sequelize');
const moment = require('moment-timezone');
const { rowsToExcelBuffer } = require('../utils/exportService');

const PERIOD_DAYS = { daily: 1, weekly: 7, monthly: 30 };

/**
 * Una función por tipo de reporte que devuelve {title, headers, rows}
 * (rows = array de arrays, mismo orden que headers). Tanto el Excel como
 * el PDF se arman a partir de esta misma estructura para no duplicar las
 * consultas en dos lugares.
 */
const REPORT_DATA_BY_TYPE = {
  async overview(companyId, from, to) {
    const { Ticket } = require('../models');
    const baseWhere = { company_id: companyId, created_at: { [Op.between]: [from, to] } };
    const [total, open, resolved, closed, breached] = await Promise.all([
      Ticket.count({ where: baseWhere }),
      Ticket.count({ where: { ...baseWhere, status: 'open' } }),
      Ticket.count({ where: { ...baseWhere, status: 'resolved' } }),
      Ticket.count({ where: { ...baseWhere, status: 'closed' } }),
      Ticket.count({ where: { ...baseWhere, sla_status: 'breached' } }),
    ]);
    return {
      title: 'Resumen general', sheetName: 'Resumen',
      headers: ['Métrica', 'Valor'],
      rows: [['Total de tickets', total], ['Abiertos', open], ['Resueltos', resolved], ['Cerrados', closed], ['SLA incumplidos', breached]],
    };
  },

  async sla(companyId, from, to) {
    const { Ticket } = require('../models');
    const baseWhere = { company_id: companyId, created_at: { [Op.between]: [from, to] } };
    const [ok, warning, breached] = await Promise.all([
      Ticket.count({ where: { ...baseWhere, sla_status: 'ok' } }),
      Ticket.count({ where: { ...baseWhere, sla_status: 'warning' } }),
      Ticket.count({ where: { ...baseWhere, sla_status: 'breached' } }),
    ]);
    return {
      title: 'SLA', sheetName: 'SLA',
      headers: ['Estado SLA', 'Cantidad'],
      rows: [['Cumplido', ok], ['En riesgo', warning], ['Incumplido', breached]],
    };
  },

  async agent_performance(companyId, from, to) {
    const { Ticket, User } = require('../models');
    const data = await Ticket.findAll({
      where: { company_id: companyId, created_at: { [Op.between]: [from, to] }, agent_id: { [Op.ne]: null } },
      attributes: [
        'agent_id',
        [fn('COUNT', col('Ticket.id')), 'total'],
        [fn('COUNT', literal("CASE WHEN status = 'resolved' OR status = 'closed' THEN 1 END")), 'resolved'],
      ],
      include: [{ model: User, as: 'agent', attributes: ['name'] }],
      group: ['agent_id', 'agent.id'],
      raw: true, nest: true,
    });
    return {
      title: 'Performance de agentes', sheetName: 'Performance de agentes',
      headers: ['Agente', 'Total', 'Resueltos'],
      rows: data.map(d => [d.agent?.name || '—', d.total, d.resolved]),
    };
  },

  async satisfaction(companyId, from, to) {
    const { Ticket, TicketSurvey } = require('../models');
    const surveys = await TicketSurvey.findAll({
      where: { company_id: companyId, responded_at: { [Op.between]: [from, to] } },
      include: [{ model: Ticket, as: 'ticket', attributes: ['ticket_number'] }],
    });
    return {
      title: 'Satisfacción', sheetName: 'Satisfacción',
      headers: ['Ticket', 'Calificación', 'NPS (0-10)', 'Comentario'],
      rows: surveys.map(s => [s.ticket?.ticket_number || '—', s.rating, s.nps_score ?? '—', s.comment || '']),
    };
  },
};

function periodFor(frequency) {
  return {
    from: moment().subtract(PERIOD_DAYS[frequency] || 7, 'days').toDate(),
    to: new Date(),
  };
}

async function getReportData(companyId, reportType, frequency = 'weekly') {
  const builder = REPORT_DATA_BY_TYPE[reportType];
  if (!builder) throw new Error(`Tipo de reporte desconocido: ${reportType}`);
  const { from, to } = periodFor(frequency);
  return builder(companyId, from, to);
}

/**
 * Arma el workbook de un reporte programado. Consultas simplificadas
 * respecto a reportController (que sirve a la UI con filtros interactivos)
 * -- acá el período lo define la frecuencia del envío, sin filtros extra.
 */
async function buildReportWorkbook(companyId, reportType, frequency = 'weekly') {
  const { sheetName, headers, rows } = await getReportData(companyId, reportType, frequency);
  return rowsToExcelBuffer({
    sheetName,
    columns: headers.map(h => ({ header: h, key: h, width: 25 })),
    rows: rows.map(r => Object.fromEntries(headers.map((h, i) => [h, r[i]]))),
  });
}

/** Mismo reporte que buildReportWorkbook pero como PDF tabular simple. */
async function buildReportPDF(companyId, reportType, frequency = 'weekly') {
  const PDFDocument = require('pdfkit');
  const { title, headers, rows } = await getReportData(companyId, reportType, frequency);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(18).text(`Reporte HelpDesk — ${title}`, { align: 'left' });
    doc.fontSize(10).fillColor('#666').text(`Generado el ${new Date().toLocaleString('es-AR')}`, { align: 'left' });
    doc.moveDown(1.5);

    const colWidth = (doc.page.width - doc.page.margins.left - doc.page.margins.right) / headers.length;
    const startX = doc.page.margins.left;

    doc.fontSize(11).fillColor('#000');
    let y = doc.y;
    headers.forEach((h, i) => doc.text(String(h), startX + i * colWidth, y, { width: colWidth, underline: true }));
    doc.moveDown(1);

    rows.forEach((row) => {
      y = doc.y;
      if (y > doc.page.height - doc.page.margins.bottom - 30) { doc.addPage(); y = doc.y; }
      row.forEach((cell, i) => doc.text(String(cell ?? ''), startX + i * colWidth, y, { width: colWidth }));
      doc.moveDown(0.8);
    });

    if (rows.length === 0) doc.fontSize(10).fillColor('#999').text('Sin datos en el período seleccionado.');

    doc.end();
  });
}

module.exports = { buildReportWorkbook, buildReportPDF };
