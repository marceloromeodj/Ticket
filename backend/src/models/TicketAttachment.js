const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('TicketAttachment', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  ticket_id:  { type: DataTypes.UUID, allowNull: false },
  message_id: DataTypes.UUID,
  filename:   { type: DataTypes.STRING(500), allowNull: false },
  original_name: DataTypes.STRING(500),
  mime_type:  DataTypes.STRING(100),
  size:       DataTypes.INTEGER,
  storage_path: DataTypes.STRING(1000),
  url:        DataTypes.STRING(1000),
  storage_type: {
    type: DataTypes.ENUM('local', 'minio', 's3'),
    defaultValue: 'minio',
  },
}, {
  tableName: 'ticket_attachments',
  indexes: [
    { fields: ['ticket_id'] },
    { fields: ['message_id'] },
  ],
});
