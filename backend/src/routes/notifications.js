const router = require('express').Router();
const { Notification } = require('../models');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const { read, limit = 20 } = req.query;
    const where = { user_id: req.user.id };
    if (read !== undefined) where.read = read === 'true';
    const notifs = await Notification.findAll({ where, order: [['created_at','DESC']], limit: parseInt(limit) });
    const unread = await Notification.count({ where: { user_id: req.user.id, read: false } });
    res.json({ data: notifs, unread });
  } catch (err) { next(err); }
});

router.put('/:id/read', async (req, res, next) => {
  try {
    await Notification.update({ read: true, read_at: new Date() }, { where: { id: req.params.id, user_id: req.user.id } });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.put('/read-all', async (req, res, next) => {
  try {
    await Notification.update({ read: true, read_at: new Date() }, { where: { user_id: req.user.id, read: false } });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
