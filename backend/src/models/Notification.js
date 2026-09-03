const { DataTypes } = require('sequelize');
module.exports = (sequelize) => sequelize.define('Notification', {
  id:        { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  user_id:   { type: DataTypes.UUID, allowNull: false },
  ticket_id: DataTypes.UUID,
  type:      {
    type: DataTypes.ENUM(
      'ticket_assigned', 'ticket_updated', 'ticket_resolved', 'ticket_reopened',
      'new_reply', 'mention', 'sla_breach', 'sla_warning', 'system'
    ),
    allowNull: false,
  },
  title:   DataTypes.STRING(300),
  message: DataTypes.TEXT,
  link:    DataTypes.STRING(500),
  read:    { type: DataTypes.BOOLEAN, defaultValue: false },
  read_at: DataTypes.DATE,
}, {
  tableName: 'notifications',
  indexes: [{ fields: ['user_id', 'read'] }, { fields: ['ticket_id'] }],
});
