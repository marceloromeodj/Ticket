const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('ApiToken', {
  id:         { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  company_id: { type: DataTypes.UUID, allowNull: false },
  created_by: DataTypes.UUID,

  name:         { type: DataTypes.STRING(200), allowNull: false },
  token_hash:   { type: DataTypes.STRING(64), allowNull: false, unique: true }, // sha256 hex
  token_prefix: { type: DataTypes.STRING(12), allowNull: false }, // primeros caracteres, para identificarlo en la lista

  last_used_at: DataTypes.DATE,
  active:       { type: DataTypes.BOOLEAN, defaultValue: true },
}, {
  tableName: 'api_tokens',
  indexes: [
    { fields: ['company_id'] },
    { fields: ['token_hash'], unique: true },
  ],
});
