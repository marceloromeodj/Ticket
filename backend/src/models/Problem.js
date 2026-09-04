const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('Problem', {
  id:         { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  company_id: { type: DataTypes.UUID, allowNull: false },
  branch_id:  DataTypes.UUID,
  problem_number: { type: DataTypes.INTEGER, comment: 'Número secuencial por empresa' },

  title:       { type: DataTypes.STRING(500), allowNull: false },
  description: DataTypes.TEXT,

  status: {
    type: DataTypes.ENUM('investigating', 'root_cause_identified', 'workaround_available', 'resolved', 'closed'),
    defaultValue: 'investigating',
  },
  priority: {
    type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'),
    defaultValue: 'medium',
  },

  root_cause: DataTypes.TEXT,
  workaround: DataTypes.TEXT,
  solution:   DataTypes.TEXT,

  category_id: DataTypes.UUID,
  agent_id:    DataTypes.UUID, // responsable del problema

  resolved_at: DataTypes.DATE,
}, {
  tableName: 'problems',
  indexes: [
    { fields: ['company_id'] },
    { fields: ['status'] },
    { fields: ['agent_id'] },
    { fields: ['problem_number', 'company_id'], unique: true },
  ],
});
