const router = require('express').Router();
const ctrl = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

router.post('/login',           ctrl.login);
router.post('/refresh',         ctrl.refreshToken);
router.get ('/me',              authenticate, ctrl.me);
router.post('/forgot-password', ctrl.forgotPassword);
router.post('/reset-password',  ctrl.resetPassword);
router.put ('/change-password', authenticate, ctrl.changePassword);

module.exports = router;
