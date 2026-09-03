const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('Category', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  company_id: { type: DataTypes.UUID, allowNull: false },
  parent_id:  DataTypes.UUID,
  name:        { type: DataTypes.STRING(200), allowNull: false },
  description: DataTypes.TEXT,
  icon:        DataTypes.STRING(50),
  color:       DataTypes.STRING(7),
  position:    { type: DataTypes.INTEGER, defaultValue: 0 },
  active:      { type: DataTypes.BOOLEAN, defaultValue: true },
}, { tableName: 'categories', indexes: [{ fields: ['company_id'] }, { fields: ['parent_id'] }] });
