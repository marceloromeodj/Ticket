const { CronJob } = require('cron');
const { slaService } = require('../services/slaService');
const { automationService } = require('../services/automationService');
const { AutomationRule, Ticket } = require('../models');
const { Op } = require('sequelize');

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

  console.log('[Cron] Jobs iniciados: SLA checker (10min), Time-based automation (1h)');
}

module.exports = { startCronJobs };
