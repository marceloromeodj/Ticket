const { DataTypes } = require('sequelize');

// Registro de auditoría genérico: quién hizo qué, cuándo, desde dónde, y
// qué cambió. Se escribe desde utils/audit.js en los puntos de mutación
// más relevantes (no se instrumenta automáticamente cada endpoint).
module.exports = (sequelize) => sequelize.define('AuditLog', {
  id:         { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  company_id: DataTypes.UUID, // null para acciones globales (ej. super_admin gestionando empresas)
  user_id:    DataTypes.UUID, // null si la acción no tiene actor humano (ej. cron, webhook externo)
  user_name:  DataTypes.STRING(200), // copia del nombre al momento del evento (por si el usuario se borra)

  action:      { type: DataTypes.STRING(50), allowNull: false },  // create | update | delete | login | login_failed | ...
  entity_type: { type: DataTypes.STRING(50), allowNull: false },  // 'Ticket', 'User', 'Company', ...
  entity_id:   DataTypes.UUID,

  before: DataTypes.JSONB,
  after:  DataTypes.JSONB,

  ip_address: DataTypes.STRING(45),
  user_agent: DataTypes.STRING(500),
}, {
  tableName: 'audit_logs',
  updatedAt: false,
  indexes: [
    { fields: ['company_id'] },
    { fields: ['user_id'] },
    { fields: ['entity_type', 'entity_id'] },
    { fields: ['created_at'] },
  ],
});
