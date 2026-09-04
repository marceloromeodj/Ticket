const { DataTypes } = require('sequelize');

// Encuesta de satisfacción (CSAT) enviada al resolver/cerrar un ticket.
module.exports = (sequelize) => sequelize.define('TicketSurvey', {
  id:         { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  company_id: { type: DataTypes.UUID, allowNull: false },
  ticket_id:  { type: DataTypes.UUID, allowNull: false },
  token:      { type: DataTypes.STRING(64), allowNull: false, unique: true },

  rating:     DataTypes.INTEGER, // 1-5, null hasta que responda
  comment:    DataTypes.TEXT,

  sent_at:      DataTypes.DATE,
  responded_at: DataTypes.DATE,
}, {
  tableName: 'ticket_surveys',
  indexes: [
    { fields: ['company_id'] },
    { fields: ['ticket_id'], unique: true },
    { fields: ['token'], unique: true },
  ],
});
