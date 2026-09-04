const router = require('express').Router();
const ctrl = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

router.post('/login',           ctrl.login);
router.post('/refresh',         ctrl.refreshToken);
router.get ('/me',              authenticate, ctrl.me);
router.post('/forgot-password', ctrl.forgotPassword);
router.post('/reset-password',  ctrl.resetPassword);
router.put ('/change-password', authenticate, ctrl.changePassword);

// MFA/TOTP
router.post('/mfa/verify-login', ctrl.verifyMfaLogin); // segundo paso del login, sin JWT completo todavía
router.post('/mfa/setup',        authenticate, ctrl.setupMfa);
router.post('/mfa/enable',       authenticate, ctrl.enableMfa);
router.post('/mfa/disable',      authenticate, ctrl.disableMfa);

// SSO (Google Workspace / Microsoft)
router.get ('/sso/config',    ctrl.getSsoConfig);
router.post('/sso/google',    ctrl.ssoGoogle);
router.post('/sso/microsoft', ctrl.ssoMicrosoft);

module.exports = router;
