const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');

module.exports = (sequelize) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    company_id: DataTypes.UUID,
    branch_id:  DataTypes.UUID,
    name: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    password: {
      type: DataTypes.STRING(255),
    },
    phone: DataTypes.STRING(50),
    avatar_url: DataTypes.STRING(500),
    role: {
      type: DataTypes.ENUM('super_admin', 'admin', 'supervisor', 'agent', 'customer'),
      defaultValue: 'agent',
    },
    // Para agentes: grupos/equipos
    groups: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: [],
    },
    // Para customers: empresa a la que pertenecen
    customer_company: DataTypes.STRING(200),
    notification_preferences: {
      type: DataTypes.JSONB,
      defaultValue: {
        email: true,
        browser: true,
        ticket_assigned: true,
        ticket_updated: true,
        ticket_resolved: true,
        mention: true,
      },
    },
    availability: {
      type: DataTypes.ENUM('online', 'busy', 'offline'),
      defaultValue: 'offline',
    },
    last_seen_at: DataTypes.DATE,
    last_login_at: DataTypes.DATE,
    reset_token: DataTypes.STRING(255),
    reset_token_expires: DataTypes.DATE,
    password_changed_at: DataTypes.DATE,
    email_verified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    // MFA/TOTP: mfa_secret se genera al iniciar el setup (POST /auth/mfa/setup)
    // pero mfa_enabled queda en false hasta confirmar un código válido
    // (POST /auth/mfa/enable), para no bloquear al usuario si abandona el
    // flujo de configuración a mitad de camino.
    mfa_secret:  DataTypes.STRING(64),
    mfa_enabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  }, {
    tableName: 'users',
    indexes: [
      { fields: ['email', 'company_id'], unique: true },
      { fields: ['company_id'] },
      { fields: ['branch_id'] },
      { fields: ['role'] },
      { fields: ['active'] },
    ],
    defaultScope: {
      attributes: { exclude: ['password', 'reset_token', 'mfa_secret'] },
    },
    scopes: {
      // Sin exclusiones: usado tanto para verificar contraseña como para
      // leer/escribir mfa_secret (ambos excluidos por defaultScope).
      withPassword: { attributes: {} },
    },
  });

  // Hash password antes de crear/actualizar
  User.beforeCreate(async (user) => {
    if (user.password) {
      user.password = await bcrypt.hash(user.password, 12);
    }
  });

  User.beforeUpdate(async (user) => {
    if (user.changed('password') && user.password) {
      user.password = await bcrypt.hash(user.password, 12);
      // Invalida los JWT emitidos antes de este cambio (ver middleware/auth.js)
      user.password_changed_at = new Date();
    }
  });

  User.prototype.checkPassword = async function(plain) {
    return bcrypt.compare(plain, this.password);
  };

  return User;
};
