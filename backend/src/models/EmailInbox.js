const { DataTypes } = require('sequelize');
module.exports = (sequelize) => sequelize.define('EmailInbox', {
  id:         { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  company_id: { type: DataTypes.UUID, allowNull: false },
  branch_id:  DataTypes.UUID,
  name:       { type: DataTypes.STRING(200), allowNull: false },
  email:      { type: DataTypes.STRING(200), allowNull: false },
  // IMAP para recibir
  imap_host:    DataTypes.STRING(200),
  imap_port:    { type: DataTypes.INTEGER, defaultValue: 993 },
  imap_user:    DataTypes.STRING(200),
  imap_pass:    DataTypes.STRING(500),
  imap_use_ssl: { type: DataTypes.BOOLEAN, defaultValue: true },
  // SMTP para enviar
  smtp_host:    DataTypes.STRING(200),
  smtp_port:    { type: DataTypes.INTEGER, defaultValue: 587 },
  smtp_user:    DataTypes.STRING(200),
  smtp_pass:    DataTypes.STRING(500),
  smtp_use_tls: { type: DataTypes.BOOLEAN, defaultValue: true },
  from_name:    DataTypes.STRING(200),
  // Configuración
  auto_assign_to: DataTypes.UUID,  // agente por defecto
  default_category_id: DataTypes.UUID,
  signature:    DataTypes.TEXT,
  active:       { type: DataTypes.BOOLEAN, defaultValue: true },
  last_sync_at: DataTypes.DATE,
}, { tableName: 'email_inboxes', indexes: [{ fields: ['company_id'] }] });
