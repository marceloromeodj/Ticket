const { DataTypes } = require('sequelize');

// Canal de notificación a nivel empresa (no por usuario individual: mandar
// un DM de Telegram a cada agente requeriría que cada uno vincule su chat
// personal, que es un flujo aparte). Sirve para avisar a un canal/grupo
// compartido de eventos importantes: ticket urgente, incumplimiento de
// SLA, incidente mayor declarado.
module.exports = (sequelize) => sequelize.define('NotificationChannel', {
  id:         { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  company_id: { type: DataTypes.UUID, allowNull: false },

  type: { type: DataTypes.ENUM('slack', 'telegram'), allowNull: false },
  // slack:    { webhook_url }
  // telegram: { bot_token, chat_id }
  config: { type: DataTypes.JSONB, defaultValue: {} },

  // Qué eventos dispara: ticket_urgent | sla_breach | major_incident
  events: { type: DataTypes.JSONB, defaultValue: ['ticket_urgent', 'sla_breach', 'major_incident'] },

  active: { type: DataTypes.BOOLEAN, defaultValue: true },
}, {
  tableName: 'notification_channels',
  indexes: [{ fields: ['company_id'] }],
});
