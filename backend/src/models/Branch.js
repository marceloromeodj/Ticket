const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('Branch', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  company_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  name: {
    type: DataTypes.STRING(200),
    allowNull: false,
  },
  code: {
    type: DataTypes.STRING(20),
    comment: 'Código corto de la sucursal (ej: BUE, COR)',
  },
  address: DataTypes.STRING(300),
  phone: DataTypes.STRING(50),
  email: DataTypes.STRING(200),
  timezone: {
    type: DataTypes.STRING(50),
    defaultValue: 'America/Buenos_Aires',
  },
  settings: {
    type: DataTypes.JSONB,
    defaultValue: {},
  },
  active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
}, {
  tableName: 'branches',
  indexes: [
    { fields: ['company_id'] },
    { fields: ['active'] },
  ],
});
