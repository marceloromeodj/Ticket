const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('MaintenancePlan', {
  id:         { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  company_id: { type: DataTypes.UUID, allowNull: false },
  asset_id:   { type: DataTypes.UUID, allowNull: false },

  title:         { type: DataTypes.STRING(200), allowNull: false },
  frequency_days: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 90 },
  checklist:     { type: DataTypes.JSONB, defaultValue: [] }, // ["Limpiar filtros", "Revisar cables", ...]

  last_done_at: DataTypes.DATE,
  next_due_at:  DataTypes.DATE,
  active:       { type: DataTypes.BOOLEAN, defaultValue: true },
}, {
  tableName: 'maintenance_plans',
  indexes: [
    { fields: ['company_id'] },
    { fields: ['asset_id'] },
    { fields: ['next_due_at'] },
  ],
});
