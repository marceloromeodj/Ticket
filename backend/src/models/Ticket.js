const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('Ticket', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  company_id:    { type: DataTypes.UUID, allowNull: false },
  branch_id:     DataTypes.UUID,
  ticket_number: {
    type: DataTypes.INTEGER,
    comment: 'Número secuencial por empresa',
  },
  subject: {
    type: DataTypes.STRING(500),
    allowNull: false,
  },
  description: DataTypes.TEXT,

  // Estado del ticket
  status: {
    type: DataTypes.ENUM('open', 'pending', 'waiting_customer', 'resolved', 'closed'),
    defaultValue: 'open',
  },
  priority: {
    type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'),
    defaultValue: 'medium',
  },
  type: {
    type: DataTypes.ENUM('question', 'incident', 'problem', 'task', 'feature_request'),
    defaultValue: 'question',
  },

  // Relaciones principales
  category_id:    DataTypes.UUID,
  sla_policy_id:  DataTypes.UUID,
  agent_id:       DataTypes.UUID,
  requester_id:   DataTypes.UUID,  // Puede ser customer o agente que abre
  requester_name:  DataTypes.STRING(200),
  requester_email: DataTypes.STRING(200),
  requester_phone: DataTypes.STRING(50),

  // Canal de origen
  source: {
    type: DataTypes.ENUM('web', 'email', 'chat', 'whatsapp', 'telegram', 'phone', 'api'),
    defaultValue: 'web',
  },

  // SLA tracking
  sla_status: {
    type: DataTypes.ENUM('ok', 'warning', 'breached'),
    defaultValue: 'ok',
  },
  first_response_due_at: DataTypes.DATE,
  resolution_due_at:     DataTypes.DATE,
  first_responded_at:    DataTypes.DATE,
  resolved_at:           DataTypes.DATE,
  closed_at:             DataTypes.DATE,

  // Email/WhatsApp threading
  email_message_id:   DataTypes.STRING(500),
  whatsapp_chat_id:   DataTypes.STRING(200),

  // Campos custom (JSONB para flexibilidad)
  custom_fields: {
    type: DataTypes.JSONB,
    defaultValue: {},
  },

  // Métricas
  reply_count:   { type: DataTypes.INTEGER, defaultValue: 0 },
  reopen_count:  { type: DataTypes.INTEGER, defaultValue: 0 },

  // Spam / archivado
  spam:     { type: DataTypes.BOOLEAN, defaultValue: false },
  archived: { type: DataTypes.BOOLEAN, defaultValue: false },

}, {
  tableName: 'tickets',
  indexes: [
    { fields: ['company_id'] },
    { fields: ['branch_id'] },
    { fields: ['status'] },
    { fields: ['priority'] },
    { fields: ['agent_id'] },
    { fields: ['requester_id'] },
    { fields: ['ticket_number', 'company_id'], unique: true },
    { fields: ['created_at'] },
    { fields: ['sla_status'] },
    {
      name: 'tickets_search_idx',
      fields: ['subject', 'requester_email'],
      using: 'gin',
      operator: 'gin_trgm_ops',
    },
  ],
});
