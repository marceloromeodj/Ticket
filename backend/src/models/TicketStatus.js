const { DataTypes } = require('sequelize');

// Estados de ticket configurables por empresa (antes un ENUM fijo:
// open/pending/waiting_customer/resolved/closed). `category` es lo que
// mantiene viva la lógica de negocio que depende de "está resuelto/
// cerrado" (SLA, encuesta CSAT, reapertura automática) aunque la empresa
// le ponga cualquier nombre/color al estado -- ver services/
// ticketStatusService.js. `key` es lo que se guarda en Ticket.status.
module.exports = (sequelize) => sequelize.define('TicketStatus', {
  id:         { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  company_id: { type: DataTypes.UUID, allowNull: false },

  key:   { type: DataTypes.STRING(50), allowNull: false },
  label: { type: DataTypes.STRING(100), allowNull: false },
  color: { type: DataTypes.STRING(20), defaultValue: '#6b7280' },

  // open: cuenta como ticket activo (SLA corriendo, "abiertos" en
  // dashboards). resolved: dispara la encuesta CSAT y detiene el SLA.
  // closed: detiene el SLA, no dispara encuesta de nuevo si ya se mandó.
  category: { type: DataTypes.ENUM('open', 'resolved', 'closed'), defaultValue: 'open' },

  position:   { type: DataTypes.INTEGER, defaultValue: 0 },
  is_initial: { type: DataTypes.BOOLEAN, defaultValue: false }, // estado de un ticket nuevo

  // Estados (key) a los que se puede pasar desde este. Vacío = sin
  // restricción (cualquier transición permitida) -- default seguro para
  // no romper nada en empresas que no configuran el flujo.
  allowed_next: { type: DataTypes.ARRAY(DataTypes.STRING), defaultValue: [] },

  active: { type: DataTypes.BOOLEAN, defaultValue: true },
}, {
  tableName: 'ticket_statuses',
  indexes: [
    { fields: ['company_id'] },
    { fields: ['key', 'company_id'], unique: true },
  ],
});
