const router = require('express').Router();
const { sequelize, ChatSession, ChatMessage, Ticket } = require('../models');
const { authenticate, tenantMiddleware } = require('../middleware/auth');
const { emitToTicket } = require('../config/socket');
const { getNextTicketNumber } = require('../utils/ticketNumber');

router.use(authenticate, tenantMiddleware);

// Listar sesiones de chat activas
router.get('/sessions', async (req, res, next) => {
  try {
    const { status = 'waiting' } = req.query;
    const sessions = await ChatSession.findAll({
      where: { company_id: req.companyId, status },
      include: [{ model: ChatMessage, as: 'messages', limit: 1, order: [['created_at','DESC']] }],
      order: [['created_at','DESC']],
    });
    res.json(sessions);
  } catch (err) { next(err); }
});

// Obtener mensajes de una sesión (validando que la sesión sea de la empresa)
router.get('/sessions/:id/messages', async (req, res, next) => {
  try {
    const session = await ChatSession.findOne({ where: { id: req.params.id, company_id: req.companyId } });
    if (!session) return res.status(404).json({ error: 'Sesión no encontrada' });

    const messages = await ChatMessage.findAll({
      where: { session_id: session.id },
      order: [['created_at','ASC']],
    });
    res.json(messages);
  } catch (err) { next(err); }
});

// Aceptar sesión de chat
router.post('/sessions/:id/accept', async (req, res, next) => {
  try {
    const session = await ChatSession.findOne({ where: { id: req.params.id, company_id: req.companyId } });
    if (!session) return res.status(404).json({ error: 'Sesión no encontrada' });
    await session.update({ agent_id: req.user.id, status: 'active', started_at: new Date() });
    res.json(session);
  } catch (err) { next(err); }
});

// Convertir chat en ticket
router.post('/sessions/:id/to-ticket', async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const session = await ChatSession.findOne({ where: { id: req.params.id, company_id: req.companyId }, transaction: t });
    if (!session) {
      await t.rollback();
      return res.status(404).json({ error: 'Sesión no encontrada' });
    }

    const messages = await ChatMessage.findAll({ where: { session_id: session.id }, order: [['created_at','ASC']], transaction: t });
    const description = messages.map(m => `${m.sender}: ${m.content}`).join('\n');

    const ticket_number = await getNextTicketNumber(req.companyId, t);

    const ticket = await Ticket.create({
      company_id:     req.companyId,
      ticket_number,
      subject:        `Chat: ${session.visitor_name || 'Visitante'}`,
      description,
      source:         'chat',
      status:         'open',
      priority:       'medium',
      requester_name: session.visitor_name,
      requester_email: session.visitor_email,
      agent_id:       session.agent_id,
    }, { transaction: t });

    await session.update({ ticket_id: ticket.id, status: 'resolved', ended_at: new Date() }, { transaction: t });

    await t.commit();
    res.json({ ticket, session });
  } catch (err) {
    await t.rollback();
    next(err);
  }
});

// Cerrar sesión
router.post('/sessions/:id/close', async (req, res, next) => {
  try {
    const session = await ChatSession.findOne({ where: { id: req.params.id, company_id: req.companyId } });
    if (!session) return res.status(404).json({ error: 'Sesión no encontrada' });
    await session.update({ status: 'resolved', ended_at: new Date() });
    res.json(session);
  } catch (err) { next(err); }
});

module.exports = router;
