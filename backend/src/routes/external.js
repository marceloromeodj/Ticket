/**
 * API externa para integraciones de terceros (autenticada con un token de
 * API generado en Configuración > API, no con el JWT de sesión). Alcance
 * deliberadamente acotado a lo que un sistema externo típicamente necesita:
 * crear y consultar tickets. Documentada en GET /api/docs.
 */
const router = require('express').Router();
const { sequelize, Ticket, TicketMessage } = require('../models');
const { apiTokenAuth } = require('../middleware/apiTokenAuth');
const { getNextTicketNumber } = require('../utils/ticketNumber');

router.use(apiTokenAuth);

router.get('/tickets', async (req, res, next) => {
  try {
    const { status, limit = 50 } = req.query;
    const where = { company_id: req.companyId };
    if (status) where.status = status;

    const tickets = await Ticket.findAll({
      where,
      attributes: ['id', 'ticket_number', 'subject', 'status', 'priority', 'requester_email', 'created_at'],
      order: [['created_at', 'DESC']],
      limit: Math.min(parseInt(limit) || 50, 200),
    });
    res.json({ tickets });
  } catch (err) { next(err); }
});

router.post('/tickets', async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const { subject, description, requester_name, requester_email, priority = 'medium', category_id, service_id } = req.body;
    if (!subject || !requester_email) {
      await t.rollback();
      return res.status(400).json({ error: 'subject y requester_email son requeridos' });
    }

    const ticket_number = await getNextTicketNumber(req.companyId, t);
    const ticket = await Ticket.create({
      company_id: req.companyId,
      ticket_number,
      subject,
      description,
      priority,
      source: 'api',
      status: 'open',
      requester_name,
      requester_email,
      category_id: category_id || null,
      service_id: service_id || null,
    }, { transaction: t });

    if (description) {
      await TicketMessage.create({
        ticket_id: ticket.id,
        author_name: requester_name,
        author_email: requester_email,
        author_type: 'customer',
        content: description,
        message_type: 'reply',
        channel: 'api',
      }, { transaction: t });
    }

    await t.commit();
    res.status(201).json({ id: ticket.id, ticket_number: ticket.ticket_number, status: ticket.status });
  } catch (err) {
    await t.rollback();
    next(err);
  }
});

module.exports = router;
