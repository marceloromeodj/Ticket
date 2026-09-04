const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('ScheduledReport', {
  id:         { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  company_id: { type: DataTypes.UUID, allowNull: false },

  report_type: {
    type: DataTypes.ENUM('overview', 'agent_performance', 'sla', 'satisfaction'),
    allowNull: false,
  },
  frequency: { type: DataTypes.ENUM('daily', 'weekly', 'monthly'), defaultValue: 'weekly' },
  recipients: { type: DataTypes.JSONB, defaultValue: [] }, // ["email@empresa.com", ...]
  format: { type: DataTypes.ENUM('csv', 'excel'), defaultValue: 'excel' },

  last_sent_at: DataTypes.DATE,
  active:       { type: DataTypes.BOOLEAN, defaultValue: true },
}, {
  tableName: 'scheduled_reports',
  indexes: [{ fields: ['company_id'] }, { fields: ['active'] }],
});
