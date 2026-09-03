const { DataTypes } = require('sequelize');
module.exports = (sequelize) => sequelize.define('CannedResponse', {
  id:         { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  company_id: { type: DataTypes.UUID, allowNull: false },
  agent_id:   DataTypes.UUID,
  title:      { type: DataTypes.STRING(300), allowNull: false },
  content:    { type: DataTypes.TEXT, allowNull: false },
  shortcut:   DataTypes.STRING(50),
  category:   DataTypes.STRING(100),
  use_count:  { type: DataTypes.INTEGER, defaultValue: 0 },
  // null = compartida con todos
}, { tableName: 'canned_responses', indexes: [{ fields: ['company_id'] }] });
