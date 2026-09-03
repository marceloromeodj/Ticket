const { Notification, User } = require('../models');
const { emitToUser } = require('../config/socket');

const notificationService = {
  async create({ user_id, ticket_id, type, title, message, link }) {
    try {
      const notif = await Notification.create({ user_id, ticket_id, type, title, message, link });
      emitToUser(user_id, 'notification:new', notif);
      return notif;
    } catch (err) {
      console.error('[Notification] Error:', err.message);
    }
  },

  async notifyTicketReply(ticket, message, actor) {
    const notifyIds = new Set();

    // Notificar al agente asignado (si no es quien respondió)
    if (ticket.agent_id && ticket.agent_id !== actor.id) {
      notifyIds.add(ticket.agent_id);
    }

    // Notificar menciones
    for (const mentionedId of (message.mentions || [])) {
      if (mentionedId !== actor.id) notifyIds.add(mentionedId);
    }

    for (const userId of notifyIds) {
      await this.create({
        user_id:   userId,
        ticket_id: ticket.id,
        type:      'new_reply',
        title:     `Nueva respuesta en Ticket #${ticket.ticket_number}`,
        message:   `${actor.name}: ${String(message.content).substring(0, 100)}`,
        link:      `/tickets/${ticket.id}`,
      });
    }
  },
};

module.exports = { notificationService };
