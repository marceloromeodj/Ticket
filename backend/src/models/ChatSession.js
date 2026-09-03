const { DataTypes } = require('sequelize');
module.exports = (sequelize) => sequelize.define('ChatSession', {
  id:            { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  ticket_id:     DataTypes.UUID,
  company_id:    { type: DataTypes.UUID, allowNull: false },
  branch_id:     DataTypes.UUID,
  agent_id:      DataTypes.UUID,
  visitor_id:    DataTypes.STRING(100),
  visitor_name:  DataTypes.STRING(200),
  visitor_email: DataTypes.STRING(200),
  visitor_phone: DataTypes.STRING(50),
  visitor_metadata: { type: DataTypes.JSONB, defaultValue: {} },
  status: {
    type: DataTypes.ENUM('waiting', 'active', 'resolved', 'abandoned'),
    defaultValue: 'waiting',
  },
  rating:   DataTypes.INTEGER,
  feedback: DataTypes.TEXT,
  started_at: DataTypes.DATE,
  ended_at:   DataTypes.DATE,
  wait_time_seconds:      { type: DataTypes.INTEGER, defaultValue: 0 },
  duration_seconds:       { type: DataTypes.INTEGER, defaultValue: 0 },
  total_messages:         { type: DataTypes.INTEGER, defaultValue: 0 },
}, { tableName: 'chat_sessions', indexes: [{ fields: ['company_id'] }, { fields: ['ticket_id'] }, { fields: ['status'] }] });
