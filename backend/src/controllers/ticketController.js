const { Op } = require('sequelize');
const { sequelize, Ticket, TicketMessage, TicketAttachment, User, Category, Tag, SLAPolicy, Notification } = require('../models');
const { emitToCompany, emitToTicket, emitToUser } = require('../config/socket');
const { slaService }         = require('../services/slaService');
const { automationService }  = require('../services/automationService');
const { notificationService } = require('../services/notificationService');
const { storageService }     = require('../services/storageService');
const { getNextTicketNumber } = require('../utils/ticketNumber');
const { companyScope }       = require('../middleware/auth');

// Reemplaza la URL pública guardada por una URL firmada de corta duración,
// generada recién ahora que ya se validó que el usuario tiene acceso al
// ticket (bucket de archivos privado).
async function withSignedAttachments(plainObject) {
  if (!plainObject) return plainObject;
  const attachTargets = [];
  if (Array.isArray(plainObject.attachments)) attachTargets.push(plainObject.attachments);
  if (Array.isArray(plainObject.messages)) {
    plainObject.messages.forEach(m => { if (Array.isArray(m.attachments)) attachTargets.push(m.attachments); });
  }
  for (const list of attachTargets) {
    for (const a of list) {
      a.url = await storageService.getPresignedUrl(a.storage_path);
    }
  }
  return plainObject;
}

// Los <select> del frontend mandan "" cuando queda en la opción "Sin
// asignar"/"Todas", pero estas columnas son UUID: Postgres rechaza un
// string vacío ("invalid input syntax for type uuid"), necesita null.
function emptyToNull(value) {
  return value === '' ? null : value;
}

// Evita asignar un ticket a un usuario de otra empresa (por ejemplo, un
// agente enviando un agent_id arbitrario en el body de update/bulk).
async function isAgentInCompany(agentId, companyId) {
  if (!agentId) return true;
  const agent = await User.findOne({ where: { id: agentId, company_id: companyId } });
  return !!agent;
}

// ─── Listar tickets ──────────────────────────────────────────────
async function list(req, res, next) {
  try {
    const {
      status, priority, agent_id, category_id, source,
      search, page = 1, limit = 25,
      sort_by = 'created_at', sort_dir = 'DESC',
      branch_id, from_date, to_date, sla_status, tag_id,
    } = req.query;

    // Solo un super_admin sin empresa seleccionada ve tickets de todas las
    // empresas; cualquier otro rol sin company_id no debe recibir
    // resultados (ver companyScope en middleware/auth.js).
    const where = { ...companyScope(req) };

    // Filtros de sucursal (un agente ve tickets de todas las sucursales a
    // las que pertenece, no solo la principal; ver req.branchIds en
    // middleware/auth.js)
    if (req.user.role === 'agent' && req.branchIds?.length) {
      where.branch_id = { [Op.in]: req.branchIds };
    } else if (branch_id) {
      where.branch_id = branch_id;
    }

    if (status)      where.status      = status.includes(',') ? { [Op.in]: status.split(',') } : status;
    if (priority)    where.priority    = priority.includes(',') ? { [Op.in]: priority.split(',') } : priority;
    if (agent_id)    where.agent_id    = agent_id === 'me' ? req.user.id : agent_id;
    if (category_id) where.category_id = category_id;
    if (source)      where.source      = source;
    if (sla_status)  where.sla_status  = sla_status;
    if (from_date)   where.created_at  = { ...where.created_at, [Op.gte]: new Date(from_date) };
    if (to_date)     where.created_at  = { ...where.created_at, [Op.lte]: new Date(to_date) };
    where.spam    = false;
    where.archived = false;

    if (search) {
      where[Op.or] = [
        { subject:          { [Op.iLike]: `%${search}%` } },
        { requester_email:  { [Op.iLike]: `%${search}%` } },
        { requester_name:   { [Op.iLike]: `%${search}%` } },
        { '$ticket_number$': isNaN(search) ? undefined : parseInt(search) },
      ].filter(Boolean);
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows } = await Ticket.findAndCountAll({
      where,
      include: [
        { model: User,     as: 'agent',     attributes: ['id','name','avatar_url'], required: false },
        { model: User,     as: 'requester', attributes: ['id','name','email'],      required: false },
        { model: Category, as: 'category',  attributes: ['id','name','color'],      required: false },
        { model: Tag,      as: 'tags',      attributes: ['id','name','color'],      through: { attributes: [] } },
      ],
      order: [[sort_by, sort_dir.toUpperCase()]],
      limit:  parseInt(limit),
      offset,
      distinct: true,
    });

    res.json({
      data: rows,
      meta: { total: count, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(count / parseInt(limit)) },
    });
  } catch (err) { next(err); }
}

// ─── Obtener un ticket ───────────────────────────────────────────
async function getOne(req, res, next) {
  try {
    const ticket = await Ticket.findOne({
      where: { id: req.params.id, ...companyScope(req) },
      include: [
        { model: User,       as: 'agent',     attributes: ['id','name','avatar_url','email'] },
        { model: User,       as: 'requester', attributes: ['id','name','email','phone'] },
        { model: Category,   as: 'category' },
        { model: Tag,        as: 'tags',      through: { attributes: [] } },
        { model: SLAPolicy,  as: 'slaPolicy' },
        { model: TicketAttachment, as: 'attachments' },
      ],
    });
    if (!ticket) return res.status(404).json({ error: 'Ticket no encontrado' });
    res.json(await withSignedAttachments(ticket.toJSON()));
  } catch (err) { next(err); }
}

// ─── Crear ticket ────────────────────────────────────────────────
async function create(req, res, next) {
  const t = await sequelize.transaction();
  try {
    const {
      subject, description, priority = 'medium', type = 'question',
      requester_id, requester_name, requester_email, requester_phone,
      source = 'web', custom_fields = {}, tags = [],
    } = req.body;
    const category_id = emptyToNull(req.body.category_id);
    const agent_id     = emptyToNull(req.body.agent_id);
    const branch_id    = emptyToNull(req.body.branch_id);

    if (agent_id && !(await isAgentInCompany(agent_id, req.companyId))) {
      await t.rollback();
      return res.status(400).json({ error: 'El agente no pertenece a esta empresa' });
    }

    // Número secuencial por empresa (seguro bajo concurrencia)
    const ticket_number = await getNextTicketNumber(req.companyId, t);

    // Resolver SLA
    const slaPolicy = await slaService.findApplicablePolicy(req.companyId, { priority, category_id, source });
    const slaDates  = slaPolicy ? slaService.calculateDueDates(slaPolicy, priority) : {};

    const ticket = await Ticket.create({
      company_id:    req.companyId,
      branch_id:     branch_id || req.branchId,
      ticket_number,
      subject,
      description,
      priority,
      type,
      category_id,
      source,
      agent_id,
      requester_id,
      requester_name,
      requester_email,
      requester_phone,
      sla_policy_id: slaPolicy?.id,
      custom_fields,
      ...slaDates,
    }, { transaction: t });

    // Asignar tags
    if (tags.length > 0) {
      await ticket.setTags(tags, { transaction: t });
    }

    // Mensaje inicial si hay descripción
    if (description) {
      await TicketMessage.create({
        ticket_id:    ticket.id,
        user_id:      req.user.role !== 'customer' ? req.user.id : requester_id,
        author_name:  requester_name,
        author_email: requester_email,
        author_type:  req.user.role === 'customer' ? 'customer' : 'agent',
        content:      description,
        message_type: 'reply',
        channel:      source,
      }, { transaction: t });
    }

    await t.commit();

    // Recargar con asociaciones
    const fullTicket = await Ticket.findByPk(ticket.id, {
      include: [
        { model: User,     as: 'agent',     attributes: ['id','name','avatar_url'] },
        { model: User,     as: 'requester', attributes: ['id','name','email'] },
        { model: Category, as: 'category' },
        { model: Tag,      as: 'tags', through: { attributes: [] } },
      ],
    });

    // Emitir evento en tiempo real
    emitToCompany(req.companyId, 'ticket:created', fullTicket);
    if (agent_id) emitToUser(agent_id, 'ticket:assigned', fullTicket);

    // Ejecutar automatizaciones
    automationService.run('ticket_created', fullTicket, req.user);

    // Notificaciones
    if (agent_id) {
      notificationService.create({
        user_id:   agent_id,
        ticket_id: ticket.id,
        type:      'ticket_assigned',
        title:     `Ticket #${ticket_number} asignado`,
        message:   `Se te asignó: ${subject}`,
      });
    }

    res.status(201).json(fullTicket);
  } catch (err) {
    await t.rollback();
    next(err);
  }
}

// ─── Actualizar ticket ───────────────────────────────────────────
async function update(req, res, next) {
  try {
    const ticket = await Ticket.findOne({ where: { id: req.params.id, ...companyScope(req) } });
    if (!ticket) return res.status(404).json({ error: 'Ticket no encontrado' });

    const prev = ticket.toJSON();

    const updatable = [
      'subject', 'priority', 'type', 'status', 'category_id',
      'agent_id', 'branch_id', 'custom_fields', 'requester_name',
      'requester_email', 'requester_phone', 'sla_policy_id',
    ];
    const uuidFields = ['category_id', 'agent_id', 'branch_id', 'sla_policy_id'];
    const changes = {};
    updatable.forEach(f => {
      if (req.body[f] === undefined) return;
      changes[f] = uuidFields.includes(f) ? emptyToNull(req.body[f]) : req.body[f];
    });

    // Se valida contra la empresa real del ticket (no req.companyId): un
    // super_admin sin empresa seleccionada puede llegar acá con
    // req.companyId vacío, pero el ticket sí pertenece a una empresa concreta.
    if (changes.agent_id && !(await isAgentInCompany(changes.agent_id, ticket.company_id))) {
      return res.status(400).json({ error: 'El agente no pertenece a esta empresa' });
    }

    // Tracking de resolución/cierre
    if (changes.status === 'resolved' && !ticket.resolved_at)  changes.resolved_at = new Date();
    if (changes.status === 'closed'   && !ticket.closed_at)    changes.closed_at   = new Date();
    if (['open','pending'].includes(changes.status) && ticket.resolved_at) {
      changes.resolved_at = null;
      changes.reopen_count = ticket.reopen_count + 1;
    }

    await ticket.update(changes);

    // Tags si vienen en el body
    if (req.body.tags !== undefined) await ticket.setTags(req.body.tags);

    // Nota de actividad si cambió agente o estado
    const activityNotes = [];
    if (prev.agent_id !== ticket.agent_id) activityNotes.push(`Asignado a ${ticket.agent_id || 'nadie'}`);
    if (prev.status   !== ticket.status)   activityNotes.push(`Estado cambiado a ${ticket.status}`);
    if (prev.priority !== ticket.priority) activityNotes.push(`Prioridad cambiada a ${ticket.priority}`);

    if (activityNotes.length > 0) {
      await TicketMessage.create({
        ticket_id:    ticket.id,
        user_id:      req.user.id,
        author_type:  'system',
        content:      activityNotes.join(' | '),
        message_type: 'activity_log',
        channel:      'web',
      });
    }

    const fullTicket = await Ticket.findByPk(ticket.id, {
      include: [
        { model: User,     as: 'agent',     attributes: ['id','name','avatar_url'] },
        { model: User,     as: 'requester', attributes: ['id','name','email'] },
        { model: Category, as: 'category' },
        { model: Tag,      as: 'tags', through: { attributes: [] } },
      ],
    });

    emitToCompany(ticket.company_id, 'ticket:updated', fullTicket);
    emitToTicket(ticket.id,          'ticket:updated', fullTicket);

    automationService.run('ticket_updated', fullTicket, req.user);

    // Notificar si se cambió el agente
    if (changes.agent_id && changes.agent_id !== prev.agent_id) {
      notificationService.create({
        user_id:   changes.agent_id,
        ticket_id: ticket.id,
        type:      'ticket_assigned',
        title:     `Ticket #${ticket.ticket_number} asignado`,
        message:   `Se te asignó: ${ticket.subject}`,
      });
    }

    res.json(fullTicket);
  } catch (err) { next(err); }
}

// ─── Agregar mensaje ─────────────────────────────────────────────
async function addMessage(req, res, next) {
  try {
    const { content, message_type = 'reply', is_private = false, mentions = [] } = req.body;

    const ticket = await Ticket.findOne({ where: { id: req.params.id, ...companyScope(req) } });
    if (!ticket) return res.status(404).json({ error: 'Ticket no encontrado' });

    const message = await TicketMessage.create({
      ticket_id:   ticket.id,
      user_id:     req.user.id,
      author_type: req.user.role === 'customer' ? 'customer' : 'agent',
      content,
      message_type,
      is_private,
      mentions,
      channel:     'web',
    });

    // Adjuntos
    if (req.files?.length > 0) {
      for (const file of req.files) {
        const uploaded = await storageService.upload(file);
        await TicketAttachment.create({
          ticket_id:     ticket.id,
          message_id:    message.id,
          filename:      uploaded.filename,
          original_name: file.originalname,
          mime_type:     file.mimetype,
          size:          file.size,
          storage_path:  uploaded.path,
          url:           uploaded.url,
        });
      }
    }

    // Actualizar reply_count y first_responded_at
    const updates = { reply_count: ticket.reply_count + 1 };
    if (!ticket.first_responded_at && req.user.role !== 'customer') {
      updates.first_responded_at = new Date();
    }
    // Si el cliente respondió, reabrir si estaba resuelto
    if (req.user.role === 'customer' && ['resolved', 'closed'].includes(ticket.status)) {
      updates.status     = 'open';
      updates.resolved_at = null;
      updates.reopen_count = ticket.reopen_count + 1;
    }
    await ticket.update(updates);

    const fullMessage = await TicketMessage.findByPk(message.id, {
      include: [
        { model: User, as: 'author', attributes: ['id','name','avatar_url'] },
        { model: TicketAttachment, as: 'attachments' },
      ],
    });
    const fullMessageJson = await withSignedAttachments(fullMessage.toJSON());

    emitToTicket(ticket.id, 'message:new', fullMessageJson);
    emitToCompany(ticket.company_id, 'ticket:updated', { id: ticket.id, reply_count: updates.reply_count });

    // Notificar a todos los involucrados
    notificationService.notifyTicketReply(ticket, message, req.user);

    res.status(201).json(fullMessageJson);
  } catch (err) { next(err); }
}

// ─── Listar mensajes de un ticket ────────────────────────────────
async function getMessages(req, res, next) {
  try {
    // Verificar primero que el ticket pertenezca a la empresa del usuario:
    // sin este chequeo, cualquier usuario autenticado podía leer mensajes
    // (incluidas notas privadas) de tickets de otra empresa conociendo el UUID.
    const ticket = await Ticket.findOne({ where: { id: req.params.id, ...companyScope(req) } });
    if (!ticket) return res.status(404).json({ error: 'Ticket no encontrado' });

    const { include_private = false } = req.query;
    const where = { ticket_id: ticket.id };
    if (!include_private || req.user.role === 'customer') where.is_private = false;

    const messages = await TicketMessage.findAll({
      where,
      include: [
        { model: User, as: 'author', attributes: ['id','name','avatar_url','role'] },
        { model: TicketAttachment, as: 'attachments' },
      ],
      order: [['created_at', 'ASC']],
    });
    const messagesJson = await withSignedAttachments({ messages: messages.map(m => m.toJSON()) });
    res.json(messagesJson.messages);
  } catch (err) { next(err); }
}

// ─── Bulk operations ─────────────────────────────────────────────
async function bulkUpdate(req, res, next) {
  try {
    const { ticket_ids, action } = req.body;
    const value = action === 'assign' ? emptyToNull(req.body.value) : req.body.value;
    if (!ticket_ids?.length) return res.status(400).json({ error: 'ticket_ids requerido' });

    const where = { id: { [Op.in]: ticket_ids }, ...companyScope(req) };

    if (action === 'assign' && !(await isAgentInCompany(value, req.companyId))) {
      return res.status(400).json({ error: 'El agente no pertenece a esta empresa' });
    }

    const actionMap = {
      assign:   { agent_id:  value },
      status:   { status:    value },
      priority: { priority:  value },
      spam:     { spam:      true  },
      archive:  { archived:  true  },
    };

    const updates = actionMap[action];
    if (!updates) return res.status(400).json({ error: 'Acción no válida' });

    await Ticket.update(updates, { where });
    emitToCompany(req.companyId, 'tickets:bulk_updated', { ticket_ids, action, value });

    res.json({ updated: ticket_ids.length });
  } catch (err) { next(err); }
}

module.exports = { list, getOne, create, update, addMessage, getMessages, bulkUpdate };
