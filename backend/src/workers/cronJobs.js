const { CronJob } = require('cron');
const moment = require('moment');
const { slaService } = require('../services/slaService');
const { automationService } = require('../services/automationService');
const { emailService } = require('../services/emailService');
const { buildReportWorkbook, buildReportPDF } = require('../services/reportExportService');
const { notificationChannelService } = require('../services/notificationChannelService');
const { AutomationRule, Ticket, ScheduledReport, Contract, User } = require('../models');
const { Op } = require('sequelize');

const FREQUENCY_DAYS = { daily: 1, weekly: 7, monthly: 30 };
function isReportDue(report) {
  if (!report.last_sent_at) return true;
  const days = FREQUENCY_DAYS[report.frequency] || 7;
  return moment(report.last_sent_at).add(days, 'days').isSameOrBefore(moment());
}

function startCronJobs() {
  // ─── SLA checker: cada 10 minutos ───────────────────────────
  new CronJob('*/10 * * * *', async () => {
    try {
      await slaService.updateSLAStatuses();
    } catch (err) {
      console.error('[Cron] Error en SLA checker:', err.message);
    }
  }, null, true);

  // ─── Automatizaciones basadas en tiempo: cada hora ──────────
  new CronJob('0 * * * *', async () => {
    try {
      const rules = await AutomationRule.findAll({
        where: { event: 'time_based', active: true },
      });

      for (const rule of rules) {
        const tc = rule.time_condition;
        if (!tc?.hours || !tc?.field) continue;

        const threshold = new Date(Date.now() - tc.hours * 60 * 60 * 1000);
        const where = {
          company_id: rule.company_id,
          [tc.field]: { [Op.lt]: threshold },
          status:     { [Op.notIn]: ['resolved', 'closed'] },
        };
        if (tc.status_is) where.status = tc.status_is;

        const tickets = await Ticket.findAll({ where });
        for (const ticket of tickets) {
          await automationService.executeActions(rule, ticket, { id: 'system', role: 'system' });
        }
      }
    } catch (err) {
      console.error('[Cron] Error en automatizaciones por tiempo:', err.message);
    }
  }, null, true);

  // ─── Reportes programados: se revisa una vez por día ─────────
  new CronJob('0 7 * * *', async () => {
    try {
      const reports = await ScheduledReport.findAll({ where: { active: true } });
      for (const report of reports) {
        if (!isReportDue(report)) continue;
        try {
          const isPdf = report.format === 'pdf';
          const buffer = isPdf
            ? await buildReportPDF(report.company_id, report.report_type, report.frequency)
            : await buildReportWorkbook(report.company_id, report.report_type, report.frequency);
          const filename = `reporte-${report.report_type}.${isPdf ? 'pdf' : 'xlsx'}`;
          await emailService.sendRaw({
            to: report.recipients.join(','),
            companyId: report.company_id,
            subject: `Reporte HelpDesk (${report.report_type}) — ${new Date().toLocaleDateString('es-AR')}`,
            html: `<p>Adjunto el reporte "${report.report_type}" (${report.frequency}).</p>`,
            text: `Adjunto el reporte "${report.report_type}" (${report.frequency}).`,
            attachments: [{ filename, content: Buffer.from(buffer) }],
          });
          await report.update({ last_sent_at: new Date() });
          console.log(`[Cron] Reporte "${report.report_type}" enviado a empresa ${report.company_id}`);
        } catch (err) {
          console.error(`[Cron] Error enviando reporte programado ${report.id}:`, err.message);
        }
      }
    } catch (err) {
      console.error('[Cron] Error revisando reportes programados:', err.message);
    }
  }, null, true);

  // ─── Contratos/licencias por vencer: se revisa una vez por día ───
  new CronJob('0 8 * * *', async () => {
    try {
      const { notificationService } = require('../services/notificationService');
      const contracts = await Contract.findAll({ where: { active: true, alert_sent: false, end_date: { [Op.ne]: null } } });

      for (const contract of contracts) {
        const daysLeft = moment(contract.end_date).diff(moment().startOf('day'), 'days');
        if (daysLeft > contract.renewal_alert_days) continue;

        const summary = daysLeft >= 0
          ? `El contrato/licencia "${contract.name}" vence en ${daysLeft} día(s) (${contract.end_date}).`
          : `El contrato/licencia "${contract.name}" venció el ${contract.end_date}.`;

        const admins = await User.findAll({
          where: { company_id: contract.company_id, role: { [Op.in]: ['admin', 'supervisor', 'super_admin'] }, active: true },
          attributes: ['id'],
        });
        for (const admin of admins) {
          notificationService.create({
            user_id: admin.id, type: 'system',
            title: 'Contrato/licencia por vencer',
            message: summary,
            link: '/contracts',
          });
        }
        notificationChannelService
          .broadcast(contract.company_id, 'contract_expiring', `📄 ${summary}`)
          .catch(err => console.error('[Cron] Error notificando canales de contrato:', err.message));

        await contract.update({ alert_sent: true });
      }
    } catch (err) {
      console.error('[Cron] Error revisando contratos por vencer:', err.message);
    }
  }, null, true);

  console.log('[Cron] Jobs iniciados: SLA checker (10min), Time-based automation (1h), Reportes programados (diario 07:00), Contratos por vencer (diario 08:00)');
}

module.exports = { startCronJobs };
