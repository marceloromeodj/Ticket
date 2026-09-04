const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('Contract', {
  id:         { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  company_id: { type: DataTypes.UUID, allowNull: false },
  vendor_id:  DataTypes.UUID,
  asset_id:   DataTypes.UUID, // opcional: licencia/garantía asociada a un activo puntual

  name: { type: DataTypes.STRING(300), allowNull: false },
  type: {
    type: DataTypes.ENUM('license', 'warranty', 'service', 'lease', 'other'),
    defaultValue: 'other',
  },
  cost:     DataTypes.DECIMAL(12, 2),
  currency: { type: DataTypes.STRING(10), defaultValue: 'ARS' },

  start_date: DataTypes.DATEONLY,
  end_date:   DataTypes.DATEONLY,

  // Días antes del vencimiento en que se avisa (Slack/Telegram/notificación
  // interna, ver workers/cronJobs.js). alert_sent evita reenviar el mismo
  // aviso todos los días una vez que ya cruzó el umbral.
  renewal_alert_days: { type: DataTypes.INTEGER, defaultValue: 30 },
  alert_sent: { type: DataTypes.BOOLEAN, defaultValue: false },

  notes:  DataTypes.TEXT,
  active: { type: DataTypes.BOOLEAN, defaultValue: true },
}, {
  tableName: 'contracts',
  indexes: [
    { fields: ['company_id'] },
    { fields: ['vendor_id'] },
    { fields: ['asset_id'] },
    { fields: ['end_date'] },
  ],
});
