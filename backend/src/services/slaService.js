const moment = require('moment-timezone');
const { SLAPolicy, Ticket } = require('../models');
const { Op } = require('sequelize');

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
   * Calcular fechas de vencimiento SLA
   */
  calculateDueDates(policy, priority) {
    const firstResponseMins = policy.first_response_time?.[priority] || 240;
    const resolutionMins    = policy.resolution_time?.[priority]     || 1440;

    return {
      first_response_due_at: moment().add(firstResponseMins, 'minutes').toDate(),
      resolution_due_at:     moment().add(resolutionMins, 'minutes').toDate(),
    };
  },

  /**
   * Actualizar el estado SLA de todos los tickets abiertos
   * (ejecutado por cron job cada 15 minutos)
   */
  async updateSLAStatuses() {
    const now = new Date();

    // Breached: pasó la fecha límite de resolución y no está resuelto.
    // Se buscan primero (en vez de un UPDATE directo) para poder avisar
    // por los canales de notificación configurados de cada empresa.
    const toBreach = await Ticket.findAll({
      where: {
        status:             { [Op.notIn]: ['resolved', 'closed'] },
        resolution_due_at:  { [Op.lt]: now },
        sla_policy_id:      { [Op.ne]: null },
        sla_status:         { [Op.ne]: 'breached' },
      },
      attributes: ['id', 'company_id', 'ticket_number', 'subject'],
    });

    if (toBreach.length > 0) {
      await Ticket.update(
        { sla_status: 'breached' },
        { where: { id: { [Op.in]: toBreach.map(t => t.id) } } }
      );

      const { notificationChannelService } = require('./notificationChannelService');
      const byCompany = {};
      toBreach.forEach(t => { (byCompany[t.company_id] = byCompany[t.company_id] || []).push(t); });
      for (const [companyId, tickets] of Object.entries(byCompany)) {
        const list = tickets.slice(0, 5).map(t => `#${t.ticket_number} (${t.subject})`).join(', ');
        notificationChannelService.broadcast(
          companyId, 'sla_breach',
          `⏰ SLA incumplido en ${tickets.length} ticket(s): ${list}`
        ).catch(err => console.error('[SLA] Error notificando canales:', err.message));
      }
    }

    // Warning: dentro de 30 minutos del vencimiento
    const warningThreshold = moment().add(30, 'minutes').toDate();
    await Ticket.update(
      { sla_status: 'warning' },
      {
        where: {
          status:            { [Op.notIn]: ['resolved', 'closed'] },
          resolution_due_at: { [Op.between]: [now, warningThreshold] },
          sla_policy_id:     { [Op.ne]: null },
          sla_status:        'ok',
        },
      }
    );

    console.log(`[SLA] Estados actualizados: ${new Date().toISOString()}`);
  },
};

module.exports = { slaService };
