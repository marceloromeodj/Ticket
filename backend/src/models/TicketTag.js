const { DataTypes } = require('sequelize');
module.exports = (sequelize) => sequelize.define('TicketTag', {
  ticket_id: { type: DataTypes.UUID, allowNull: false },
  tag_id:    { type: DataTypes.UUID, allowNull: false },
}, { tableName: 'ticket_tags', timestamps: false });
