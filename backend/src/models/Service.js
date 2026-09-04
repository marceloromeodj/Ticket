const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('Service', {
  id:         { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  company_id: { type: DataTypes.UUID, allowNull: false },

  name:        { type: DataTypes.STRING(200), allowNull: false },
  description: DataTypes.TEXT,
  category: {
    type: DataTypes.ENUM('infraestructura', 'sistemas', 'conectividad', 'correo', 'hardware', 'aplicaciones', 'otro'),
    defaultValue: 'otro',
  },
  criticality: {
    type: DataTypes.ENUM('low', 'medium', 'high', 'critical'),
    defaultValue: 'medium',
  },

  owner_id:      DataTypes.UUID,       // agente/responsable del servicio
  sla_policy_id: DataTypes.UUID,
  cost:          DataTypes.DECIMAL(10, 2),

  active: { type: DataTypes.BOOLEAN, defaultValue: true },
}, {
  tableName: 'services',
  indexes: [
    { fields: ['company_id'] },
    { fields: ['owner_id'] },
    { fields: ['active'] },
  ],
});
