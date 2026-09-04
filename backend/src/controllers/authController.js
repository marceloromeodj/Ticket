const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const speakeasy = require('speakeasy');
const { User, Company, Branch } = require('../models');
const { emailService } = require('../services/emailService');
const { getSubdomainSlug } = require('../utils/subdomain');
const { logAudit } = require('../utils/audit');
const { ssoConfig, verifyGoogleIdToken, verifyMicrosoftIdToken } = require('../services/ssoService');

function signToken(user) {
  return jwt.sign(
    {
      id:         user.id,
      email:      user.email,
      role:       user.role,
      company_id: user.company_id,
      branch_id:  user.branch_id,
      name:       user.name,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );
}

function signRefreshToken(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET, { expiresIn: '30d' });
}

function signMfaToken(userId) {
  return jwt.sign({ id: userId, mfa_pending: true }, process.env.JWT_SECRET, { expiresIn: '5m' });
}

function buildLoginResponse(user) {
  const token        = signToken(user);
  const refreshToken = signRefreshToken(user.id);
  return {
    token,
    refresh_token: refreshToken,
    user: {
      id:         user.id,
      name:       user.name,
      email:      user.email,
      role:       user.role,
      avatar_url: user.avatar_url,
      mfa_enabled: user.mfa_enabled,
      company:    user.company,
      branch:     user.branch,
    },
  };
}

// POST /api/auth/login
async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email y contraseña requeridos' });

    // Si se accede por el subdominio de una empresa (empresa1.dominio.com),
    // se usa como scope implícito aunque el cliente no lo mande explícito.
    const company_slug = req.body.company_slug || getSubdomainSlug(req);

    // Buscar usuario con scope que incluya password
    const whereClause = { email: email.toLowerCase(), active: true };

    let user = await User.scope('withPassword').findOne({
      where: whereClause,
      include: [
        { model: Company, as: 'company', where: company_slug ? { slug: company_slug } : undefined },
        { model: Branch,  as: 'branch', required: false },
      ],
    });

    if (!user) {
      await logAudit(req, { action: 'login_failed', entity_type: 'User', entity_id: null, company_id: null, user_id: null, user_name: email, after: { reason: 'usuario no encontrado' } });
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const valid = await user.checkPassword(password);
    if (!valid) {
      await logAudit(req, { action: 'login_failed', entity_type: 'User', entity_id: user.id, company_id: user.company_id, user_id: user.id, user_name: user.name, after: { reason: 'contraseña incorrecta' } });
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // Si el usuario tiene MFA activado, no se emite el JWT todavía: se
    // devuelve un token de corta duración que solo sirve para completar el
    // segundo paso en POST /auth/mfa/verify-login.
    if (user.mfa_enabled) {
      return res.json({ mfa_required: true, mfa_token: signMfaToken(user.id) });
    }

    await user.update({ last_login_at: new Date() });
    await logAudit(req, { action: 'login', entity_type: 'User', entity_id: user.id, company_id: user.company_id, user_id: user.id, user_name: user.name });

    res.json(buildLoginResponse(user));
  } catch (err) { next(err); }
}

// POST /api/auth/mfa/verify-login — segundo paso del login cuando el
// usuario tiene MFA activado.
async function verifyMfaLogin(req, res, next) {
  try {
    const { mfa_token, code } = req.body;
    if (!mfa_token || !code) return res.status(400).json({ error: 'mfa_token y code son requeridos' });

    let decoded;
    try {
      decoded = jwt.verify(mfa_token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'Token de MFA inválido o expirado, iniciá sesión de nuevo' });
    }
    if (!decoded.mfa_pending) return res.status(401).json({ error: 'Token inválido' });

    const user = await User.scope('withPassword').findOne({
      where: { id: decoded.id, active: true, mfa_enabled: true },
      include: [
        { model: Company, as: 'company' },
        { model: Branch,  as: 'branch', required: false },
      ],
    });
    if (!user) return res.status(401).json({ error: 'Usuario no encontrado' });

    const valid = speakeasy.totp.verify({ secret: user.mfa_secret, encoding: 'base32', token: code, window: 1 });
    if (!valid) {
      await logAudit(req, { action: 'login_failed', entity_type: 'User', entity_id: user.id, company_id: user.company_id, user_id: user.id, user_name: user.name, after: { reason: 'código MFA incorrecto' } });
      return res.status(401).json({ error: 'Código incorrecto' });
    }

    await user.update({ last_login_at: new Date() });
    await logAudit(req, { action: 'login', entity_type: 'User', entity_id: user.id, company_id: user.company_id, user_id: user.id, user_name: user.name });

    res.json(buildLoginResponse(user));
  } catch (err) { next(err); }
}

// POST /api/auth/mfa/setup — genera un secreto nuevo (no lo activa todavía)
// y devuelve la URL otpauth:// para mostrar como QR.
async function setupMfa(req, res, next) {
  try {
    const user = await User.scope('withPassword').findByPk(req.user.id);
    const secret = speakeasy.generateSecret({ name: `HelpDesk (${user.email})` });
    await user.update({ mfa_secret: secret.base32, mfa_enabled: false });
    res.json({ secret: secret.base32, otpauth_url: secret.otpauth_url });
  } catch (err) { next(err); }
}

// POST /api/auth/mfa/enable — confirma el setup con un código válido.
async function enableMfa(req, res, next) {
  try {
    const { code } = req.body;
    const user = await User.scope('withPassword').findByPk(req.user.id);
    if (!user.mfa_secret) return res.status(400).json({ error: 'Iniciá el setup de MFA primero' });

    const valid = speakeasy.totp.verify({ secret: user.mfa_secret, encoding: 'base32', token: code, window: 1 });
    if (!valid) return res.status(400).json({ error: 'Código incorrecto' });

    await user.update({ mfa_enabled: true });
    await logAudit(req, { action: 'mfa_enabled', entity_type: 'User', entity_id: user.id, company_id: user.company_id, user_id: user.id, user_name: user.name });
    res.json({ message: 'MFA activado correctamente' });
  } catch (err) { next(err); }
}

// POST /api/auth/mfa/disable — requiere la contraseña actual (no el código,
// para no dejar a alguien sin acceso si perdió su app de autenticación).
async function disableMfa(req, res, next) {
  try {
    const { password } = req.body;
    const user = await User.scope('withPassword').findByPk(req.user.id);

    const valid = await user.checkPassword(password || '');
    if (!valid) return res.status(400).json({ error: 'Contraseña incorrecta' });

    await user.update({ mfa_enabled: false, mfa_secret: null });
    await logAudit(req, { action: 'mfa_disabled', entity_type: 'User', entity_id: user.id, company_id: user.company_id, user_id: user.id, user_name: user.name });
    res.json({ message: 'MFA desactivado' });
  } catch (err) { next(err); }
}

// GET /api/auth/sso/config — le dice al frontend qué botones de SSO mostrar,
// sin necesitar rebuildear el frontend cuando se configuran las apps.
async function getSsoConfig(req, res) {
  res.json({
    google: ssoConfig.google,
    microsoft: ssoConfig.microsoft,
    google_client_id: ssoConfig.google_client_id,
    azure_client_id: ssoConfig.azure_client_id,
    azure_tenant_id: ssoConfig.azure_tenant_id,
  });
}

// Login por SSO: solo funciona si YA existe un usuario activo con ese
// email en HelpDesk (SSO reemplaza la contraseña, no crea cuentas nuevas
// -- las cuentas se siguen creando desde Agentes/Configuración).
async function loginWithVerifiedEmail(req, res, email) {
  const user = await User.scope('withPassword').findOne({
    where: { email: email.toLowerCase(), active: true },
    include: [
      { model: Company, as: 'company' },
      { model: Branch,  as: 'branch', required: false },
    ],
  });

  if (!user) {
    return res.status(404).json({ error: 'No existe una cuenta con este email en HelpDesk. Pedile a un administrador que te cree como agente primero.' });
  }
  if (user.mfa_enabled) {
    return res.json({ mfa_required: true, mfa_token: signMfaToken(user.id) });
  }

  await user.update({ last_login_at: new Date() });
  await logAudit(req, { action: 'login', entity_type: 'User', entity_id: user.id, company_id: user.company_id, user_id: user.id, user_name: user.name, after: { via: 'sso' } });
  return res.json(buildLoginResponse(user));
}

// POST /api/auth/sso/google  { id_token }
async function ssoGoogle(req, res, next) {
  try {
    const { id_token } = req.body;
    if (!id_token) return res.status(400).json({ error: 'id_token requerido' });
    const { email } = await verifyGoogleIdToken(id_token);
    return await loginWithVerifiedEmail(req, res, email);
  } catch (err) {
    if (err.message?.includes('no está configurado')) return res.status(400).json({ error: err.message });
    return res.status(401).json({ error: 'No se pudo verificar la sesión de Google' });
  }
}

// POST /api/auth/sso/microsoft  { id_token }
async function ssoMicrosoft(req, res, next) {
  try {
    const { id_token } = req.body;
    if (!id_token) return res.status(400).json({ error: 'id_token requerido' });
    const { email } = await verifyMicrosoftIdToken(id_token);
    return await loginWithVerifiedEmail(req, res, email);
  } catch (err) {
    if (err.message?.includes('no está configurado')) return res.status(400).json({ error: err.message });
    return res.status(401).json({ error: 'No se pudo verificar la sesión de Microsoft' });
  }
}

// POST /api/auth/refresh
async function refreshToken(req, res, next) {
  try {
    const { refresh_token } = req.body;
    if (!refresh_token) return res.status(400).json({ error: 'Refresh token requerido' });

    const decoded = jwt.verify(refresh_token, process.env.JWT_REFRESH_SECRET);
    const user = await User.findOne({ where: { id: decoded.id, active: true } });
    if (!user) return res.status(401).json({ error: 'Usuario no encontrado' });

    // Igual que en middleware/auth.js: un refresh token emitido antes de
    // un cambio de contraseña no debe poder generar nuevos access tokens.
    if (user.password_changed_at && decoded.iat * 1000 < new Date(user.password_changed_at).getTime()) {
      return res.status(401).json({ error: 'Refresh token inválido o expirado' });
    }

    const token    = signToken(user);
    const newRefresh = signRefreshToken(user.id);

    res.json({ token, refresh_token: newRefresh });
  } catch (err) {
    return res.status(401).json({ error: 'Refresh token inválido o expirado' });
  }
}

// GET /api/auth/me
async function me(req, res, next) {
  try {
    const user = await User.findByPk(req.user.id, {
      include: [
        { model: Company, as: 'company' },
        { model: Branch,  as: 'branch', required: false },
      ],
    });
    res.json(user);
  } catch (err) { next(err); }
}

// POST /api/auth/forgot-password
async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body;
    const user = await User.findOne({ where: { email: email?.toLowerCase() } });
    if (!user) return res.json({ message: 'Si el email existe, recibirás un enlace' });

    const token   = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

    await user.update({ reset_token: token, reset_token_expires: expires });

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
    await emailService.sendPasswordReset(user, resetUrl);

    res.json({ message: 'Si el email existe, recibirás un enlace' });
  } catch (err) { next(err); }
}

// POST /api/auth/reset-password
async function resetPassword(req, res, next) {
  try {
    const { token, password } = req.body;
    const user = await User.findOne({
      where: { reset_token: token },
    });

    if (!user || user.reset_token_expires < new Date()) {
      return res.status(400).json({ error: 'Token inválido o expirado' });
    }

    await user.update({ password, reset_token: null, reset_token_expires: null });
    res.json({ message: 'Contraseña actualizada correctamente' });
  } catch (err) { next(err); }
}

// PUT /api/auth/change-password
async function changePassword(req, res, next) {
  try {
    const { current_password, new_password } = req.body;
    const user = await User.scope('withPassword').findByPk(req.user.id);

    const valid = await user.checkPassword(current_password);
    if (!valid) return res.status(400).json({ error: 'Contraseña actual incorrecta' });

    await user.update({ password: new_password });
    res.json({ message: 'Contraseña actualizada' });
  } catch (err) { next(err); }
}

module.exports = {
  login, refreshToken, me, forgotPassword, resetPassword, changePassword,
  verifyMfaLogin, setupMfa, enableMfa, disableMfa,
  getSsoConfig, ssoGoogle, ssoMicrosoft,
};
