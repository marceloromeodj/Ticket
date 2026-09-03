const { DataTypes } = require('sequelize');
const { sanitizeMessageHtml } = require('../utils/sanitizeHtml');

module.exports = (sequelize) => {
const TicketMessage = sequelize.define('TicketMessage', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  ticket_id: { type: DataTypes.UUID, allowNull: false },
  user_id:   DataTypes.UUID,

  // Para mensajes de clientes sin cuenta
  author_name:  DataTypes.STRING(200),
  author_email: DataTypes.STRING(200),
  author_type:  {
    type: DataTypes.ENUM('agent', 'customer', 'system', 'bot'),
    defaultValue: 'agent',
  },

  content: { type: DataTypes.TEXT, allowNull: false },
  content_html: DataTypes.TEXT,

  // Tipo de mensaje
  message_type: {
    type: DataTypes.ENUM('reply', 'internal_note', 'activity_log', 'auto_reply'),
    defaultValue: 'reply',
  },

  // Canal
  channel: {
    type: DataTypes.ENUM('web', 'email', 'chat', 'whatsapp', 'telegram', 'api'),
    defaultValue: 'web',
  },

  // Email metadata
  email_message_id:   DataTypes.STRING(500),
  email_in_reply_to:  DataTypes.STRING(500),

  // WhatsApp metadata
  wa_message_id:  DataTypes.STRING(200),
  wa_status:      DataTypes.ENUM('sent', 'delivered', 'read', 'failed'),

  is_private: { type: DataTypes.BOOLEAN, defaultValue: false },

  // Menciones de agentes
  mentions: {
    type: DataTypes.ARRAY(DataTypes.UUID),
    defaultValue: [],
  },

}, {
  tableName: 'ticket_messages',
  indexes: [
    { fields: ['ticket_id'] },
    { fields: ['user_id'] },
    { fields: ['message_type'] },
    { fields: ['created_at'] },
  ],
});

// Sanea el HTML antes de guardarlo (emails/WhatsApp/portal entrantes
// pueden contener HTML arbitrario controlado por el remitente). Se hace
// en el modelo, no en cada controller/servicio, para cubrir todo punto
// de escritura presente y futuro sin depender de que cada uno recuerde
// sanitizar antes de llamar a .create()/.update().
function sanitize(message) {
  if (message.changed('content_html') && message.content_html) {
    message.content_html = sanitizeMessageHtml(message.content_html);
  }
}
TicketMessage.beforeCreate(sanitize);
TicketMessage.beforeUpdate(sanitize);

return TicketMessage;
};
