const { DataTypes } = require('sequelize');

// Override por empresa del texto de una notificación (broadcast a Slack/
// Telegram, o email transaccional). Si no hay fila para un evento, se usa
// el default en hardcoded en templateService.DEFAULT_TEMPLATES -- por eso
// esta tabla solo guarda overrides, no todos los eventos posibles.
module.exports = (sequelize) => sequelize.define('NotificationTemplate', {
  id:         { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  company_id: { type: DataTypes.UUID, allowNull: false },

  event:   { type: DataTypes.STRING(50), allowNull: false },
  channel: { type: DataTypes.ENUM('broadcast', 'email'), allowNull: false },
  subject: DataTypes.STRING(300), // solo channel='email'
  body:    { type: DataTypes.TEXT, allowNull: false },
}, {
  tableName: 'notification_templates',
  indexes: [
    { fields: ['company_id'] },
    { fields: ['event', 'company_id'], unique: true },
  ],
});
