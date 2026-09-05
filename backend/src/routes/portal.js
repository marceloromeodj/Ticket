/**
 * Portal del cliente - rutas públicas y autenticadas para customers
 * Acceso en /api/portal/
 */
const router = require('express').Router();
const { sequelize, Ticket, TicketMessage, KnowledgeArticle, Category, User, ChatSession, TicketSurvey, Service, Problem, CustomField } = require('../models');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const { getNextTicketNumber } = require('../utils/ticketNumber');
const { getInitialStatusKey, isFinalStatus } = require('../services/ticketStatusService');

// ─── Encuesta de satisfacción (CSAT) ──────────────────────────────
// Público de verdad: el token de la encuesta es la única identidad
// necesaria, no requiere company_id (por eso se registra antes de
// portalAuth, que sí lo exige).
router.get('/survey/:token', async (req, res, next) => {
  try {
    const survey = await TicketSurvey.findOne({
      where: { token: req.params.token },
      include: [{ model: Ticket, as: 'ticket', attributes: ['ticket_number', 'subject', 'status'] }],
    });
    if (!survey) return res.status(404).json({ error: 'Encuesta no encontrada' });
    res.json({
      ticket_number: survey.ticket.ticket_number,
      subject: survey.ticket.subject,
      already_responded: !!survey.responded_at,
      rating: survey.rating,
      nps_score: survey.nps_score,
      comment: survey.comment,
    });
  } catch (err) { next(err); }
});

router.post('/survey/:token', async (req, res, next) => {
  try {
    const { rating, nps_score, comment } = req.body;
    if (!rating || rating < 1 || rating > 5) return res.status(400).json({ error: 'La calificación debe ser entre 1 y 5' });
    if (nps_score !== undefined && nps_score !== null && (nps_score < 0 || nps_score > 10)) {
      return res.status(400).json({ error: 'El puntaje de recomendación debe ser entre 0 y 10' });
    }

    const survey = await TicketSurvey.findOne({ where: { token: req.params.token } });
    if (!survey) return res.status(404).json({ error: 'Encuesta no encontrada' });
    if (survey.responded_at) return res.status(400).json({ error: 'Esta encuesta ya fue respondida' });

    await survey.update({ rating, nps_score: nps_score ?? null, comment: comment || null, responded_at: new Date() });
    res.json({ message: 'Gracias por tu respuesta' });
  } catch (err) { next(err); }
});

// Middleware ligero para portal (no requiere cuenta, solo company)
function portalAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (token) {
    try {
      req.portalUser = jwt.verify(token, process.env.JWT_SECRET);
    } catch {}
  }
  // company_id puede venir por header o query
  req.portalCompanyId = req.headers['x-company-id'] || req.query.company_id;
  if (!req.portalCompanyId) return res.status(400).json({ error: 'company_id requerido' });
  next();
}

router.use(portalAuth);

// ─── Catálogo de servicios (público) ─────────────────────────────
router.get('/services', async (req, res, next) => {
  try {
    const services = await Service.findAll({
      where: { company_id: req.portalCompanyId, active: true },
      attributes: ['id', 'name', 'description', 'category', 'criticality'],
      order: [['name', 'ASC']],
    });
    res.json(services);
  } catch (err) { next(err); }
});

// ─── Preguntas frecuentes (público) ───────────────────────────────
router.get('/faq', async (req, res, next) => {
  try {
    const articles = await KnowledgeArticle.findAll({
      where: { company_id: req.portalCompanyId, status: 'published', visibility: 'public', is_faq: true },
      attributes: ['id', 'title', 'slug', 'summary'],
      order: [['title', 'ASC']],
    });
    res.json(articles);
  } catch (err) { next(err); }
});

// ─── Estado de servicios / incidentes activos (público) ──────────
router.get('/status', async (req, res, next) => {
  try {
    const activeIncidents = await Problem.findAll({
      where: { company_id: req.portalCompanyId, is_major: true, status: { [Op.notIn]: ['resolved', 'closed'] } },
      attributes: ['id', 'title', 'impact', 'status', 'created_at'],
      order: [['created_at', 'DESC']],
    });
    res.json({
      operational: activeIncidents.length === 0,
      incidents: activeIncidents,
    });
  } catch (err) { next(err); }
});

// ─── Campos personalizados del ticket, para el formulario público ─
router.get('/custom-fields', async (req, res, next) => {
  try {
    const fields = await CustomField.findAll({
      where: { company_id: req.portalCompanyId, entity: 'ticket', active: true, show_in_portal: true },
      order: [['position', 'ASC']],
    });
    res.json(fields);
  } catch (err) { next(err); }
});

// ─── Crear ticket (sin cuenta) ───────────────────────────────────
router.post('/tickets', async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    // Acepta requester_name/requester_email (nombres usados en el resto de
    // la app y por el formulario del portal) o name/email como alias.
    const {
      requester_name, requester_email, requester_phone,
      name, email, phone,
      subject, description, category_id, service_id, priority = 'medium', custom_fields,
    } = req.body;
    const finalName  = requester_name || name;
    const finalEmail = requester_email || email;
    const finalPhone = requester_phone || phone;
    if (!finalEmail || !subject) {
      await t.rollback();
      return res.status(400).json({ error: 'Email y asunto son requeridos' });
    }

    const ticket_number = await getNextTicketNumber(req.portalCompanyId, t);
    const initialStatus = await getInitialStatusKey(req.portalCompanyId);

    const ticket = await Ticket.create({
      company_id:      req.portalCompanyId,
      ticket_number,
      subject,
      description,
      priority,
      source:          'web',
      status:          initialStatus,
      requester_id:    req.portalUser?.id,
      requester_name:  finalName,
      requester_email: finalEmail,
      requester_phone: finalPhone,
      category_id,
      service_id:      service_id || null,
      custom_fields:   custom_fields || {},
    }, { transaction: t });

    if (description) {
      await TicketMessage.create({
        ticket_id:    ticket.id,
        author_name:  finalName,
        author_email: finalEmail,
        author_type:  'customer',
        content:      description,
        message_type: 'reply',
        channel:      'web',
      }, { transaction: t });
    }

    await t.commit();

    res.status(201).json({
      id:            ticket.id,
      ticket_number: ticket.ticket_number,
      subject:       ticket.subject,
      status:        ticket.status,
      created_at:    ticket.created_at,
    });
  } catch (err) {
    await t.rollback();
    next(err);
  }
});

// ─── Ver ticket por email + número ──────────────────────────────
// Requiere probar identidad (email del solicitante o sesión de portal):
// sin esto, el número de ticket es secuencial y cualquiera podía
// enumerar tickets de otra persona sin autenticarse.
router.get('/tickets/:number', async (req, res, next) => {
  try {
    const { email } = req.query;
    if (!email && !req.portalUser) {
      return res.status(400).json({ error: 'Email requerido para consultar el ticket' });
    }

    const ticket = await Ticket.findOne({
      where: {
        company_id:    req.portalCompanyId,
        ticket_number: req.params.number,
        ...(req.portalUser
          ? { requester_id: req.portalUser.id }
          : { requester_email: { [Op.iLike]: email } }),
      },
      include: [
        {
          model: TicketMessage, as: 'messages',
          where: { is_private: false },
          required: false,
          order: [['created_at','ASC']],
        },
      ],
    });
    if (!ticket) return res.status(404).json({ error: 'Ticket no encontrado' });
    res.json(ticket);
  } catch (err) { next(err); }
});

// ─── Responder un ticket (portal) ───────────────────────────────
// Solo el solicitante original del ticket (por sesión de portal, o por
// email coincidente) puede responder — evita que cualquiera con el UUID
// del ticket publique mensajes suplantando al cliente.
router.post('/tickets/:id/reply', async (req, res, next) => {
  try {
    const { content, email } = req.body;
    const ticket = await Ticket.findOne({ where: { id: req.params.id, company_id: req.portalCompanyId } });
    if (!ticket) return res.status(404).json({ error: 'Ticket no encontrado' });

    const isOwner = req.portalUser
      ? req.portalUser.id === ticket.requester_id
      : !!email && ticket.requester_email?.toLowerCase() === String(email).toLowerCase();

    if (!isOwner) {
      return res.status(403).json({ error: 'No autorizado a responder este ticket' });
    }

    const message = await TicketMessage.create({
      ticket_id:    ticket.id,
      user_id:      req.portalUser?.id,
      author_name:  ticket.requester_name,
      author_email: ticket.requester_email,
      author_type:  'customer',
      content,
      message_type: 'reply',
      channel:      'web',
    });

    if (await isFinalStatus(ticket.company_id, ticket.status)) {
      const reopenStatus = await getInitialStatusKey(ticket.company_id);
      await ticket.update({ status: reopenStatus, resolved_at: null, reopen_count: ticket.reopen_count + 1 });
    }

    res.status(201).json(message);
  } catch (err) { next(err); }
});

// ─── Base de conocimiento pública ───────────────────────────────
router.get('/articles', async (req, res, next) => {
  try {
    const { search, category_id } = req.query;
    const where = { company_id: req.portalCompanyId, status: 'published', visibility: 'public' };
    if (category_id) where.category_id = category_id;
    if (search) where[Op.or] = [{ title: { [Op.iLike]: `%${search}%` } }, { summary: { [Op.iLike]: `%${search}%` } }];

    const articles = await KnowledgeArticle.findAll({
      where,
      attributes: ['id','title','slug','summary','views','helpful','not_helpful','published_at','tags','category_id'],
      include: [{ model: Category, as: 'category', attributes: ['id','name'] }],
      order: [['views','DESC']],
    });
    res.json(articles);
  } catch (err) { next(err); }
});

router.get('/articles/:slug', async (req, res, next) => {
  try {
    const article = await KnowledgeArticle.findOne({
      where: { slug: req.params.slug, company_id: req.portalCompanyId, status: 'published', visibility: 'public' },
    });
    if (!article) return res.status(404).json({ error: 'Artículo no encontrado' });
    await article.increment('views');
    res.json(article);
  } catch (err) { next(err); }
});

// ─── Iniciar sesión de chat ──────────────────────────────────────
router.post('/chat/start', async (req, res, next) => {
  try {
    const { name, email, phone, metadata = {} } = req.body;
    const session = await ChatSession.create({
      company_id:       req.portalCompanyId,
      visitor_id:       `v_${Date.now()}`,
      visitor_name:     name,
      visitor_email:    email,
      visitor_phone:    phone,
      visitor_metadata: metadata,
      status:           'waiting',
    });
    res.status(201).json(session);
  } catch (err) { next(err); }
});

module.exports = router;
