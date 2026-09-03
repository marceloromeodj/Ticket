const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('SLAPolicy', {
  id:         { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  company_id: { type: DataTypes.UUID, allowNull: false },
  name:        { type: DataTypes.STRING(200), allowNull: false },
  description: DataTypes.TEXT,

  // Tiempos en minutos
  first_response_time: {
    type: DataTypes.JSONB,
    defaultValue: { urgent: 60, high: 240, medium: 480, low: 1440 },
    comment: 'Minutos por prioridad',
  },
  resolution_time: {
    type: DataTypes.JSONB,
    defaultValue: { urgent: 240, high: 480, medium: 1440, low: 2880 },
  },

  // Aplica solo en horario laboral
  business_hours_only: { type: DataTypes.BOOLEAN, defaultValue: true },

  // Condiciones para asignar esta política (prioridad, categoría, canal, etc.)
  conditions: {
    type: DataTypes.JSONB,
    defaultValue: [],
    comment: '[{ field, operator, value }]',
  },

  // Acciones de escalamiento
  escalation_actions: {
    type: DataTypes.JSONB,
    defaultValue: [],
    comment: '[{ threshold_minutes, actions: [{ type, value }] }]',
  },

  is_default: { type: DataTypes.BOOLEAN, defaultValue: false },
  active:     { type: DataTypes.BOOLEAN, defaultValue: true },
}, {
  tableName: 'sla_policies',
  indexes: [{ fields: ['company_id'] }],
});
