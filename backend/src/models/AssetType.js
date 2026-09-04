const { DataTypes } = require('sequelize');

// Tipos de activo configurables por empresa (antes un ENUM fijo en el
// modelo Asset). `key` es lo que se guarda en Asset.type -- un string
// simple, no una FK estricta, para no romper activos existentes cuando
// se desactiva o edita un tipo.
module.exports = (sequelize) => sequelize.define('AssetType', {
  id:         { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  company_id: { type: DataTypes.UUID, allowNull: false },

  key:      { type: DataTypes.STRING(50), allowNull: false },
  label:    { type: DataTypes.STRING(100), allowNull: false },
  position: { type: DataTypes.INTEGER, defaultValue: 0 },
  active:   { type: DataTypes.BOOLEAN, defaultValue: true },
}, {
  tableName: 'asset_types',
  indexes: [
    { fields: ['company_id'] },
    { fields: ['key', 'company_id'], unique: true },
  ],
});
