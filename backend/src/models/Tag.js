const { DataTypes } = require('sequelize');
module.exports = (sequelize) => sequelize.define('Tag', {
  id:         { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  company_id: { type: DataTypes.UUID, allowNull: false },
  name:       { type: DataTypes.STRING(100), allowNull: false },
  color:      { type: DataTypes.STRING(7), defaultValue: '#6B7280' },
}, { tableName: 'tags', indexes: [{ fields: ['company_id', 'name'], unique: true }] });
