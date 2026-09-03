const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { User, Company, Branch } = require('../models');
const { emailService } = require('../services/emailService');

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

// POST /api/auth/login
async function login(req, res, next) {
  try {
    const { email, password, company_slug } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email y contraseña requeridos' });

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
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const valid = await user.checkPassword(password);
    if (!valid) return res.status(401).json({ error: 'Credenciales inválidas' });

    await user.update({ last_login_at: new Date() });

    const token        = signToken(user);
    const refreshToken = signRefreshToken(user.id);

    res.json({
      token,
      refresh_token: refreshToken,
      user: {
        id:         user.id,
        name:       user.name,
        email:      user.email,
        role:       user.role,
        avatar_url: user.avatar_url,
        company:    user.company,
        branch:     user.branch,
      },
    });
  } catch (err) { next(err); }
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

module.exports = { login, refreshToken, me, forgotPassword, resetPassword, changePassword };
