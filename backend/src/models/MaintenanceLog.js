const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('MaintenanceLog', {
  id:         { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  company_id: { type: DataTypes.UUID, allowNull: false },
  plan_id:    { type: DataTypes.UUID, allowNull: false },
  asset_id:   { type: DataTypes.UUID, allowNull: false },
  done_by:    DataTypes.UUID,

  done_at:           { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  checklist_results: { type: DataTypes.JSONB, defaultValue: [] }, // [{ item, checked, note }]
  notes:             DataTypes.TEXT,
}, {
  tableName: 'maintenance_logs',
  updatedAt: false,
  indexes: [
    { fields: ['company_id'] },
    { fields: ['plan_id'] },
    { fields: ['asset_id'] },
  ],
});
