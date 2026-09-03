const { DataTypes } = require('sequelize');
module.exports = (sequelize) => sequelize.define('CustomField', {
  id:         { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  company_id: { type: DataTypes.UUID, allowNull: false },
  entity:     { type: DataTypes.ENUM('ticket', 'customer', 'company'), defaultValue: 'ticket' },
  name:       { type: DataTypes.STRING(100), allowNull: false },
  label:      { type: DataTypes.STRING(200), allowNull: false },
  field_type: {
    type: DataTypes.ENUM('text', 'number', 'date', 'select', 'multiselect', 'checkbox', 'url'),
    defaultValue: 'text',
  },
  options:    { type: DataTypes.ARRAY(DataTypes.STRING), defaultValue: [] },
  required:   { type: DataTypes.BOOLEAN, defaultValue: false },
  show_in_portal: { type: DataTypes.BOOLEAN, defaultValue: false },
  position:   { type: DataTypes.INTEGER, defaultValue: 0 },
  active:     { type: DataTypes.BOOLEAN, defaultValue: true },
}, { tableName: 'custom_fields', indexes: [{ fields: ['company_id', 'entity'] }] });
