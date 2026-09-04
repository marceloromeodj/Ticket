const { DataTypes } = require('sequelize');
module.exports = (sequelize) => sequelize.define('UserBranch', {
  user_id:   { type: DataTypes.UUID, allowNull: false },
  branch_id: { type: DataTypes.UUID, allowNull: false },
}, { tableName: 'user_branches', timestamps: false });
