const router = require('express').Router();
const ctrl = require('../controllers/reportController');
const { authenticate, authorize, tenantMiddleware } = require('../middleware/auth');

router.use(authenticate, tenantMiddleware, authorize('super_admin','admin','supervisor'));

router.get('/overview',          ctrl.overview);
router.get('/tickets-by-date',   ctrl.ticketsByDate);
router.get('/agent-performance', ctrl.agentPerformance);
router.get('/by-category',       ctrl.byCategory);
router.get('/sla',               ctrl.slaReport);
router.get('/satisfaction',      ctrl.satisfactionReport);

module.exports = router;
