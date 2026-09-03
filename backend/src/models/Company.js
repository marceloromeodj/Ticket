const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('Company', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING(200),
    allowNull: false,
  },
  slug: {
    type: DataTypes.STRING(100),
    unique: true,
  },
  domain: {
    type: DataTypes.STRING(200),
    comment: 'Dominio para recibir emails (ej: empresa.com)',
  },
  logo_url: DataTypes.STRING(500),
  primary_color: {
    type: DataTypes.STRING(7),
    defaultValue: '#4F46E5',
  },
  timezone: {
    type: DataTypes.STRING(50),
    defaultValue: 'America/Buenos_Aires',
  },
  language: {
    type: DataTypes.STRING(10),
    defaultValue: 'es',
  },
  business_hours: {
    type: DataTypes.JSONB,
    defaultValue: {
      monday:    { open: '09:00', close: '18:00', active: true },
      tuesday:   { open: '09:00', close: '18:00', active: true },
      wednesday: { open: '09:00', close: '18:00', active: true },
      thursday:  { open: '09:00', close: '18:00', active: true },
      friday:    { open: '09:00', close: '18:00', active: true },
      saturday:  { open: '09:00', close: '13:00', active: false },
      sunday:    { open: '09:00', close: '13:00', active: false },
    },
  },
  settings: {
    type: DataTypes.JSONB,
    defaultValue: {
      ticket_prefix: 'TKT',
      auto_assign: true,
      customer_portal: true,
      knowledge_base: true,
      chat_enabled: true,
      email_enabled: true,
      whatsapp_enabled: false,
    },
  },
  plan: {
    type: DataTypes.ENUM('free', 'starter', 'pro', 'enterprise'),
    defaultValue: 'free',
  },
  max_agents: {
    type: DataTypes.INTEGER,
    defaultValue: 5,
  },
  active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
}, {
  tableName: 'companies',
  indexes: [
    { fields: ['slug'], unique: true },
    { fields: ['active'] },
  ],
});
