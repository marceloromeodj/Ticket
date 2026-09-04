const { DataTypes } = require('sequelize');
module.exports = (sequelize) => sequelize.define('TicketAsset', {
  ticket_id: { type: DataTypes.UUID, allowNull: false },
  asset_id:  { type: DataTypes.UUID, allowNull: false },
}, { tableName: 'ticket_assets', timestamps: false });
