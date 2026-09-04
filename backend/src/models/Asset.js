const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('Asset', {
  id:         { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  company_id: { type: DataTypes.UUID, allowNull: false },
  branch_id:  DataTypes.UUID,
  owner_id:   DataTypes.UUID, // usuario al que está asignado el activo

  asset_tag: { type: DataTypes.STRING(50), allowNull: false }, // código único por empresa (etiqueta/QR)
  name:      { type: DataTypes.STRING(200), allowNull: false },
  type: {
    type: DataTypes.ENUM(
      'pc', 'notebook', 'server', 'vm', 'printer', 'switch', 'router',
      'firewall', 'ap', 'ups', 'camera', 'phone', 'other'
    ),
    defaultValue: 'other',
  },
  status: {
    type: DataTypes.ENUM('active', 'maintenance', 'stored', 'retired'),
    defaultValue: 'active',
  },

  brand:  DataTypes.STRING(100),
  model:  DataTypes.STRING(100),
  serial_number: DataTypes.STRING(100),

  ip_address:  DataTypes.STRING(45),
  mac_address: DataTypes.STRING(50),
  os:          DataTypes.STRING(100),

  location: DataTypes.STRING(200),
  vendor:   DataTypes.STRING(200),

  purchase_date:   DataTypes.DATEONLY,
  warranty_until:  DataTypes.DATEONLY,

  notes: DataTypes.TEXT,
  custom_fields: { type: DataTypes.JSONB, defaultValue: {} },
}, {
  tableName: 'assets',
  indexes: [
    { fields: ['company_id'] },
    { fields: ['branch_id'] },
    { fields: ['owner_id'] },
    { fields: ['type'] },
    { fields: ['asset_tag', 'company_id'], unique: true },
  ],
});
