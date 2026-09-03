const { DataTypes } = require('sequelize');
module.exports = (sequelize) => sequelize.define('ChatMessage', {
  id:         { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  session_id: { type: DataTypes.UUID, allowNull: false },
  agent_id:   DataTypes.UUID,
  sender:     { type: DataTypes.ENUM('agent', 'visitor', 'bot', 'system'), defaultValue: 'visitor' },
  content:    { type: DataTypes.TEXT, allowNull: false },
  type:       { type: DataTypes.ENUM('text', 'image', 'file', 'event'), defaultValue: 'text' },
  attachment_url: DataTypes.STRING(1000),
  read_at:    DataTypes.DATE,
}, { tableName: 'chat_messages', indexes: [{ fields: ['session_id'] }] });
