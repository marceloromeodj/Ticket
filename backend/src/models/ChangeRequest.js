const { DataTypes } = require('sequelize');

// RFC (Request For Change). Se llama ChangeRequest (no "Change") para no
// pisar la palabra reservada/genérica en el resto del código.
module.exports = (sequelize) => sequelize.define('ChangeRequest', {
  id:         { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  company_id: { type: DataTypes.UUID, allowNull: false },
  branch_id:  DataTypes.UUID,
  change_number: { type: DataTypes.INTEGER, comment: 'Número secuencial por empresa' },

  title:       { type: DataTypes.STRING(500), allowNull: false },
  description: DataTypes.TEXT,

  change_type: {
    type: DataTypes.ENUM('standard', 'normal', 'emergency'),
    defaultValue: 'normal',
  },
  risk: {
    type: DataTypes.ENUM('low', 'medium', 'high'),
    defaultValue: 'medium',
  },
  status: {
    type: DataTypes.ENUM(
      'draft', 'pending_approval', 'approved', 'rejected',
      'scheduled', 'in_progress', 'completed', 'failed', 'rolled_back'
    ),
    defaultValue: 'draft',
  },

  requested_by: DataTypes.UUID,
  approved_by:  DataTypes.UUID,
  approval_notes: DataTypes.TEXT,

  implementation_plan: DataTypes.TEXT,
  rollback_plan:        DataTypes.TEXT,

  scheduled_start: DataTypes.DATE,
  scheduled_end:   DataTypes.DATE,

  problem_id: DataTypes.UUID, // problema que motivó este cambio (opcional)
}, {
  tableName: 'change_requests',
  indexes: [
    { fields: ['company_id'] },
    { fields: ['status'] },
    { fields: ['problem_id'] },
    { fields: ['change_number', 'company_id'], unique: true },
  ],
});
