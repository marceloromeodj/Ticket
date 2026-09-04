const { Op } = require('sequelize');

const WINDOW_MINUTES = 30;
const THRESHOLD = 5; // tickets similares en la ventana para considerarlo "masivo"

const massIncidentService = {
  /**
   * Se llama después de crear un ticket. Si hay THRESHOLD o más tickets
   * abiertos con la misma categoría o servicio en los últimos
   * WINDOW_MINUTES minutos, avisa a admins/supervisores y a los canales
   * de notificación de la empresa. No crea el Major Incident solo -- eso
   * lo decide un humano desde la pantalla de Tickets ("Declarar
   * incidente mayor" sobre una selección múltiple).
   */
  async checkAndNotify(ticket) {
    if (!ticket.category_id && !ticket.service_id) return null;

    const { Ticket, User } = require('../models');
    const { notificationService } = require('./notificationService');
    const { notificationChannelService } = require('./notificationChannelService');

    const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000);
    const orConditions = [];
    if (ticket.category_id) orConditions.push({ category_id: ticket.category_id });
    if (ticket.service_id)  orConditions.push({ service_id: ticket.service_id });

    const similar = await Ticket.findAll({
      where: {
        company_id: ticket.company_id,
        status: { [Op.notIn]: ['resolved', 'closed'] },
        created_at: { [Op.gte]: windowStart },
        [Op.or]: orConditions,
      },
      attributes: ['id', 'ticket_number'],
      order: [['created_at', 'DESC']],
      limit: 50,
    });

    if (similar.length < THRESHOLD) return null;

    const ticketNumbers = similar.slice(0, 10).map(t => `#${t.ticket_number}`).join(', ');
    const summary = `Se detectaron ${similar.length} tickets abiertos en los últimos ${WINDOW_MINUTES} minutos con la misma categoría/servicio: ${ticketNumbers}. Revisá si conviene declarar un Incidente Mayor desde Tickets.`;

    const admins = await User.findAll({
      where: { company_id: ticket.company_id, role: { [Op.in]: ['admin', 'supervisor', 'super_admin'] }, active: true },
      attributes: ['id'],
    });
    for (const admin of admins) {
      notificationService.create({
        user_id: admin.id,
        ticket_id: ticket.id,
        type: 'system',
        title: `Posible incidente masivo (${similar.length} tickets)`,
        message: summary,
        link: '/tickets',
      });
    }

    notificationChannelService
      .broadcast(ticket.company_id, 'major_incident', `🚨 ${summary}`)
      .catch(err => console.error('[MassIncident] Error notificando canales:', err.message));

    return { count: similar.length, ticket_ids: similar.map(t => t.id) };
  },
};

module.exports = { massIncidentService };
