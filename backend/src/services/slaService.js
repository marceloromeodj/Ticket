const moment = require('moment-timezone');
const { SLAPolicy, Ticket, Company } = require('../models');
const { Op } = require('sequelize');
const { addBusinessMinutes } = require('../utils/businessHours');
const { getNonFinalKeys } = require('./ticketStatusService');

const slaService = {
  /**
   * Buscar la política SLA aplicable para un ticket nuevo
   */
  async findApplicablePolicy(companyId, { priority, category_id, source }) {
    // Primero buscar políticas con condiciones
    const policies = await SLAPolicy.findAll({
      where: { company_id: companyId, active: true },
      order: [['is_default', 'ASC'], ['created_at', 'ASC']],
    });

    for (const policy of policies) {
      if (policy.is_default) return policy;

      const conditions = policy.conditions || [];
      if (conditions.length === 0) return policy;

      const matches = conditions.every(cond => {
        const fieldValue = { priority, category_id, source }[cond.field];
        if (cond.operator === 'is')     return fieldValue === cond.value;
        if (cond.operator === 'is_not') return fieldValue !== cond.value;
        if (cond.operator === 'in')     return cond.value.includes(fieldValue);
        return true;
      });

      if (matches) return policy;
    }

    return null;
  },

  /**
   * Calcular fechas de vencimiento SLA. Si la política tiene
   * business_hours_only, el conteo respeta el horario de atención y los
   * feriados de la empresa (antes ese checkbox no tenía ningún efecto:
   * siempre se calculaba en tiempo corrido).
   */
  async calculateDueDates(policy, priority, companyId) {
    const firstResponseMins = policy.first_response_time?.[priority] || 240;
    const resolutionMins    = policy.resolution_time?.[priority]     || 1440;

    if (!policy.business_hours_only || !companyId) {
      return {
        first_response_due_at: moment().add(firstResponseMins, 'minutes').toDate(),
        resolution_due_at:     moment().add(resolutionMins, 'minutes').toDate(),
      };
    }

    const company = await Company.findByPk(companyId, { attributes: ['business_hours', 'holidays', 'timezone'] });
    const opts = { businessHours: company?.business_hours, holidays: company?.holidays || [], timezone: company?.timezone || 'UTC' };
    const now = new Date();

    return {
      first_response_due_at: addBusinessMinutes(now, firstResponseMins, opts),
      resolution_due_at:     addBusinessMinutes(now, resolutionMins, opts),
    };
  },

  /**
   * Actualizar el estado SLA de todos los tickets abiertos
   * (ejecutado por cron job cada 15 minutos). Se procesa empresa por
   * empresa porque qué estados cuentan como "no resuelto" es
   * configurable por empresa (ver ticketStatusService) -- ya no es un
   * NOT IN ('resolved','closed') global y fijo.
   */
  async updateSLAStatuses() {
    const now = new Date();
    const companies = await Company.findAll({ attributes: ['id'], where: { active: true } });

    for (const { id: companyId } of companies) {
      const nonFinalKeys = await getNonFinalKeys(companyId);
      if (nonFinalKeys.length === 0) continue;

      // Breached: pasó la fecha límite de resolución y no está resuelto.
      // Se buscan primero (en vez de un UPDATE directo) para poder avisar
      // por los canales de notificación de la empresa.
      const toBreach = await Ticket.findAll({
        where: {
          company_id:         companyId,
          status:             { [Op.in]: nonFinalKeys },
          resolution_due_at:  { [Op.lt]: now },
          sla_policy_id:      { [Op.ne]: null },
          sla_status:         { [Op.ne]: 'breached' },
        },
        attributes: ['id', 'ticket_number', 'subject'],
      });

      if (toBreach.length > 0) {
        await Ticket.update(
          { sla_status: 'breached' },
          { where: { id: { [Op.in]: toBreach.map(t => t.id) } } }
        );

        const { notificationChannelService } = require('./notificationChannelService');
        const { renderTemplate } = require('./templateService');
        const ticket_list = toBreach.slice(0, 5).map(t => `#${t.ticket_number} (${t.subject})`).join(', ');
        renderTemplate(companyId, 'sla_breach', { count: toBreach.length, ticket_list })
          .then(text => notificationChannelService.broadcast(companyId, 'sla_breach', text))
          .catch(err => console.error('[SLA] Error notificando canales:', err.message));
      }

      // Warning: dentro de 30 minutos del vencimiento
      const warningThreshold = moment().add(30, 'minutes').toDate();
      await Ticket.update(
        { sla_status: 'warning' },
        {
          where: {
            company_id:        companyId,
            status:            { [Op.in]: nonFinalKeys },
            resolution_due_at: { [Op.between]: [now, warningThreshold] },
            sla_policy_id:     { [Op.ne]: null },
            sla_status:        'ok',
          },
        }
      );
    }

    console.log(`[SLA] Estados actualizados: ${new Date().toISOString()}`);
  },
};

module.exports = { slaService };
