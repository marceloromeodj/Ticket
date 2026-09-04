const router = require('express').Router();
const ctrl   = require('../controllers/ticketController');
const { authenticate, tenantMiddleware, requireCompanySelected } = require('../middleware/auth');
const { upload, verifyFileSignatures } = require('../middleware/upload');

router.use(authenticate, tenantMiddleware);

router.get   ('/',        ctrl.list);
router.get   ('/export',  ctrl.exportTickets);
router.post  ('/',        requireCompanySelected, upload.array('files', 10), verifyFileSignatures, ctrl.create);
router.post  ('/bulk',    requireCompanySelected, ctrl.bulkUpdate);
router.get   ('/:id',     ctrl.getOne);
router.put   ('/:id',     ctrl.update);
router.patch ('/:id',     ctrl.update);
router.get   ('/:id/messages', ctrl.getMessages);
router.post  ('/:id/messages', upload.array('files', 10), verifyFileSignatures, ctrl.addMessage);

module.exports = router;
