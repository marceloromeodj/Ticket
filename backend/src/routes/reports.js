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

// Exportar cualquiera de los 4 reportes a Excel, con el mismo período que
// usan los reportes programados (frecuencia semanal por defecto).
router.get('/:type/export', async (req, res, next) => {
  try {
    const { buildReportWorkbook } = require('../services/reportExportService');
    const buffer = await buildReportWorkbook(req.companyId, req.params.type, req.query.frequency || 'monthly');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="reporte-${req.params.type}.xlsx"`);
    res.send(Buffer.from(buffer));
  } catch (err) { next(err); }
});

module.exports = router;
