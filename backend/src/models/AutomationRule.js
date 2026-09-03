const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('AutomationRule', {
  id:         { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  company_id: { type: DataTypes.UUID, allowNull: false },
  name:        { type: DataTypes.STRING(200), allowNull: false },
  description: DataTypes.TEXT,

  // Cuándo se dispara
  event: {
    type: DataTypes.ENUM(
      'ticket_created',
      'ticket_updated',
      'ticket_assigned',
      'ticket_resolved',
      'ticket_reopened',
      'reply_received',
      'time_based'
    ),
    allowNull: false,
  },

  // Para reglas basadas en tiempo
  time_condition: {
    type: DataTypes.JSONB,
    comment: '{ hours: N, field: "created_at"|"updated_at", status_is: "open"|... }',
  },

  // Condiciones (AND/OR)
  condition_type: {
    type: DataTypes.ENUM('any', 'all'),
    defaultValue: 'all',
  },
  conditions: {
    type: DataTypes.JSONB,
    defaultValue: [],
    comment: '[{ field, operator, value }]',
    /*
      Ejemplos:
      { field: "priority",  operator: "is",       value: "urgent" }
      { field: "status",    operator: "is_not",   value: "closed" }
      { field: "source",    operator: "is",       value: "email"  }
      { field: "subject",   operator: "contains", value: "urgente" }
    */
  },

  // Acciones a ejecutar
  actions: {
    type: DataTypes.JSONB,
    defaultValue: [],
    comment: '[{ type, value }]',
    /*
      Ejemplos:
      { type: "assign_agent",    value: "<agentId>" }
      { type: "assign_group",    value: "<groupName>" }
      { type: "set_priority",    value: "high" }
      { type: "set_status",      value: "pending" }
      { type: "add_tag",         value: "<tagId>" }
      { type: "send_email",      value: { to: "agent|requester|specific", template: "...", subject: "..." } }
      { type: "add_note",        value: "Nota automática" }
      { type: "set_sla",         value: "<slaPolicyId>" }
      { type: "notify_agent",    value: "<agentId>" }
    */
  },

  position: { type: DataTypes.INTEGER, defaultValue: 0 },
  active:    { type: DataTypes.BOOLEAN, defaultValue: true },
  run_count: { type: DataTypes.INTEGER, defaultValue: 0 },
  last_run_at: DataTypes.DATE,

}, {
  tableName: 'automation_rules',
  indexes: [
    { fields: ['company_id'] },
    { fields: ['event'] },
    { fields: ['active'] },
  ],
});
