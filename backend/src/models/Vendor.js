const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('Vendor', {
  id:         { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  company_id: { type: DataTypes.UUID, allowNull: false },

  name:          { type: DataTypes.STRING(200), allowNull: false },
  contact_name:  DataTypes.STRING(200),
  contact_email: DataTypes.STRING(200),
  contact_phone: DataTypes.STRING(50),
  notes:         DataTypes.TEXT,
  active:        { type: DataTypes.BOOLEAN, defaultValue: true },
}, {
  tableName: 'vendors',
  indexes: [{ fields: ['company_id'] }],
});
