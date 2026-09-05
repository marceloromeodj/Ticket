const { Op } = require('sequelize');
const { sequelize, Ticket, TicketMessage, TicketAttachment, User, Category, Tag, SLAPolicy, Notification, Asset, Problem, Service } = require('../models');
const { emitToCompany, emitToTicket, emitToUser } = require('../config/socket');
const { slaService }         = require('../services/slaService');
const { automationService }  = require('../services/automationService');
const { notificationService } = require('../services/notificationService');
const { storageService }     = require('../services/storageService');
const { getNextTicketNumber } = require('../utils/ticketNumber');
const { companyScope }       = require('../middleware/auth');
const { logAudit }           = require('../utils/audit');
const { surveyService }      = require('../services/surveyService');
const { notificationChannelService } = require('../services/notificationChannelService');
const { massIncidentService } = require('../services/massIncidentService');
const { renderTemplate } = require('../services/templateService');
const { getStatuses, getInitialStatusKey, isTransitionAllowed, isFinalStatus } = require('../services/ticketStatusService');

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

// Filtros compartidos entre list() y exportTickets() -- se separó para que
// el export no se desalinee con la lista si mañana se agrega un filtro.
function buildTicketWhere(req) {
  const { status, priority, type, agent_id, category_id, source, search, branch_id, from_date, to_date, sla_status } = req.query;

  const where = { ...companyScope(req) };

  if (req.user.role === 'agent' && req.branchIds?.length) {
    where.branch_id = { [Op.in]: req.branchIds };
  } else if (branch_id) {
    where.branch_id = branch_id;
  }

  if (status)      where.status      = status.includes(',') ? { [Op.in]: status.split(',') } : status;
  if (priority)    where.priority    = priority.includes(',') ? { [Op.in]: priority.split(',') } : priority;
  if (type)        where.type        = type.includes(',') ? { [Op.in]: type.split(',') } : type;
  if (agent_id)    where.agent_id    = agent_id === 'me' ? req.user.id : agent_id;
  if (category_id) where.category_id = category_id;
  if (source)      where.source      = source;
  if (sla_status)  where.sla_status  = sla_status;
  if (from_date)   where.created_at  = { ...where.created_at, [Op.gte]: new Date(from_date) };
  if (to_date)     where.created_at  = { ...where.created_at, [Op.lte]: new Date(to_date) };
  where.spam     = false;
  where.archived = false;

  if (search) {
    where[Op.or] = [
      { subject:          { [Op.iLike]: `%${search}%` } },
      { requester_email:  { [Op.iLike]: `%${search}%` } },
      { requester_name:   { [Op.iLike]: `%${search}%` } },
      { '$ticket_number$': isNaN(search) ? undefined : parseInt(search) },
    ].filter(Boolean);
  }

  return where;
}

// ─── Listar tickets ──────────────────────────────────────────────
async function list(req, res, next) {
  try {
    const { page = 1, limit = 25, sort_by = 'created_at', sort_dir = 'DESC' } = req.query;
    const where = buildTicketWhere(req);
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

// ─── Exportar tickets (CSV/Excel) ─────────────────────────────────
async function exportTickets(req, res, next) {
  try {
    const where = buildTicketWhere(req);
    const format = req.query.format === 'csv' ? 'csv' : 'excel';

    const tickets = await Ticket.findAll({
      where,
      include: [
        { model: User,     as: 'agent',     attributes: ['name'], required: false },
        { model: User,     as: 'requester', attributes: ['name', 'email'], required: false },
        { model: Category, as: 'category',  attributes: ['name'], required: false },
      ],
      order: [['created_at', 'DESC']],
      limit: 5000,
    });

    const columns = [
      { header: 'Número', key: 'ticket_number', width: 10 },
      { header: 'Asunto', key: 'subject', width: 40 },
      { header: 'Estado', key: 'status', width: 14 },
      { header: 'Prioridad', key: 'priority', width: 12 },
      { header: 'Tipo', key: 'type', width: 14 },
      { header: 'Categoría', key: 'category', width: 18 },
      { header: 'Agente', key: 'agent', width: 20 },
      { header: 'Solicitante', key: 'requester', width: 20 },
      { header: 'Email solicitante', key: 'requester_email', width: 26 },
      { header: 'Creado', key: 'created_at', width: 20 },
      { header: 'SLA', key: 'sla_status', width: 12 },
    ];
    const rows = tickets.map(t => ({
      ticket_number: t.ticket_number,
      subject: t.subject,
      status: t.status,
      priority: t.priority,
      type: t.type,
      category: t.category?.name || '',
      agent: t.agent?.name || '',
      requester: t.requester_name || t.requester?.name || '',
      requester_email: t.requester_email || t.requester?.email || '',
      created_at: t.created_at?.toISOString().slice(0, 16).replace('T', ' '),
      sla_status: t.sla_status,
    }));

    if (format === 'csv') {
      const { rowsToCSV } = require('../utils/exportService');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="tickets.csv"');
      return res.send(rowsToCSV({ columns, rows }));
    }

    const { rowsToExcelBuffer } = require('../utils/exportService');
    const buffer = await rowsToExcelBuffer({ sheetName: 'Tickets', columns, rows });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="tickets.xlsx"');
    res.send(Buffer.from(buffer));
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
        { model: Asset,      as: 'assets', through: { attributes: [] }, attributes: ['id', 'asset_tag', 'name', 'type'] },
        { model: Problem,    as: 'problem', attributes: ['id', 'problem_number', 'title', 'status'] },
        { model: Service,    as: 'service', attributes: ['id', 'name', 'criticality'] },
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
      source = 'web', tags = [],
    } = req.body;
    // Llega como string cuando el formulario se envía multipart/form-data
    // (con archivos adjuntos) en vez de JSON.
    let custom_fields = req.body.custom_fields || {};
    if (typeof custom_fields === 'string') {
      try { custom_fields = JSON.parse(custom_fields); } catch { custom_fields = {}; }
    }
    const category_id = emptyToNull(req.body.category_id);
    const agent_id     = emptyToNull(req.body.agent_id);
    const branch_id    = emptyToNull(req.body.branch_id);
    const service_id   = emptyToNull(req.body.service_id);

    if (agent_id && !(await isAgentInCompany(agent_id, req.companyId))) {
      await t.rollback();
      return res.status(400).json({ error: 'El agente no pertenece a esta empresa' });
    }

    // Número secuencial por empresa (seguro bajo concurrencia)
    const ticket_number = await getNextTicketNumber(req.companyId, t);

    // Resolver SLA
    const slaPolicy = await slaService.findApplicablePolicy(req.companyId, { priority, category_id, source });
    const slaDates  = slaPolicy ? await slaService.calculateDueDates(slaPolicy, priority, req.companyId) : {};
    const initialStatus = await getInitialStatusKey(req.companyId);

    const ticket = await Ticket.create({
      company_id:    req.companyId,
      branch_id:     branch_id || req.branchId,
      ticket_number,
      subject,
      description,
      priority,
      type,
      status:        initialStatus,
      category_id,
      service_id,
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
    let initialMessage = null;
    if (description) {
      initialMessage = await TicketMessage.create({
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

    // Adjuntos del formulario de "Nuevo ticket" (fuera de la transacción:
    // subir a MinIO no debe poder hacer fallar la creación del ticket ya
    // confirmada).
    if (req.files?.length > 0) {
      for (const file of req.files) {
        const uploaded = await storageService.upload(file);
        await TicketAttachment.create({
          ticket_id:     ticket.id,
          message_id:    initialMessage?.id,
          filename:      uploaded.filename,
          original_name: file.originalname,
          mime_type:     file.mimetype,
          size:          file.size,
          storage_path:  uploaded.path,
          url:           uploaded.url,
        });
      }
    }

    // Recargar con asociaciones
    const fullTicket = await Ticket.findByPk(ticket.id, {
      include: [
        { model: User,     as: 'agent',     attributes: ['id','name','avatar_url'] },
        { model: User,     as: 'requester', attributes: ['id','name','email'] },
        { model: Category, as: 'category' },
        { model: Tag,      as: 'tags', through: { attributes: [] } },
      ],
    });

    await logAudit(req, { action: 'create', entity_type: 'Ticket', entity_id: ticket.id, after: { subject, priority, status: 'open' } });

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

    // Canales externos (Slack/Telegram) para tickets urgentes, y detección
    // de incidentes masivos -- ninguno de los dos debe frenar la respuesta.
    if (priority === 'urgent') {
      renderTemplate(req.companyId, 'ticket_urgent', { ticket_number, subject })
        .then(text => notificationChannelService.broadcast(req.companyId, 'ticket_urgent', text))
        .catch(err => console.error('[Ticket] Error notificando canales:', err.message));
    }
    massIncidentService.checkAndNotify(ticket).catch(err => console.error('[Ticket] Error en detección de incidente masivo:', err.message));

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
      'requester_email', 'requester_phone', 'sla_policy_id', 'service_id',
    ];
    const uuidFields = ['category_id', 'agent_id', 'branch_id', 'sla_policy_id', 'service_id'];
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

    // Cambio de estado: valida contra el flujo configurado (Configuración
    // > Estados) y resuelve la categoría del estado nuevo/viejo en vez de
    // comparar contra strings fijos -- el estado puede ser cualquiera que
    // la empresa haya definido.
    let statusCategory = null;
    if (changes.status !== undefined && changes.status !== ticket.status) {
      const allowed = await isTransitionAllowed(ticket.company_id, ticket.status, changes.status);
      if (!allowed) {
        return res.status(400).json({ error: `No se puede pasar de "${ticket.status}" a "${changes.status}" según el flujo configurado` });
      }
      const statuses = await getStatuses(ticket.company_id);
      statusCategory = statuses.find(s => s.key === changes.status)?.category || 'open';
      const prevCategory = statuses.find(s => s.key === ticket.status)?.category || 'open';

      if (statusCategory === 'resolved' && !ticket.resolved_at) changes.resolved_at = new Date();
      if (statusCategory === 'closed' && !ticket.closed_at) changes.closed_at = new Date();
      if (statusCategory === 'open' && prevCategory !== 'open' && ticket.resolved_at) {
        changes.resolved_at = null;
        changes.reopen_count = ticket.reopen_count + 1;
      }
    }

    await ticket.update(changes);
    await logAudit(req, { action: 'update', entity_type: 'Ticket', entity_id: ticket.id, before: { status: prev.status, priority: prev.priority, agent_id: prev.agent_id }, after: { status: ticket.status, priority: ticket.priority, agent_id: ticket.agent_id } });

    // Encuesta de satisfacción: se dispara la primera vez que el ticket
    // pasa a una categoría resuelto/cerrado (surveyService no duplica si
    // ya existe una).
    if (prev.status !== ticket.status && (statusCategory === 'resolved' || statusCategory === 'closed')) {
      surveyService.maybeCreateSurvey(ticket).catch(err => console.error('[Survey] Error:', err.message));
    }

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
    // Si el cliente respondió, reabrir si estaba resuelto/cerrado
    if (req.user.role === 'customer' && await isFinalStatus(ticket.company_id, ticket.status)) {
      updates.status       = await getInitialStatusKey(ticket.company_id);
      updates.resolved_at  = null;
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

    // El cambio de estado masivo valida el flujo por ticket (cada uno
    // puede estar en un estado distinto con reglas distintas) y necesita
    // resolved_at/closed_at/reopen_count igual que el cambio individual,
    // así que se procesa aparte en vez de un UPDATE directo.
    if (action === 'status') {
      const tickets = await Ticket.findAll({ where, attributes: ['id', 'company_id', 'status', 'resolved_at', 'reopen_count'] });
      const blocked = [];
      for (const ticket of tickets) {
        if (ticket.status === value) continue;
        if (!(await isTransitionAllowed(ticket.company_id, ticket.status, value))) {
          blocked.push(ticket.id);
          continue;
        }
        const statuses = await getStatuses(ticket.company_id);
        const category = statuses.find(s => s.key === value)?.category || 'open';
        const prevCategory = statuses.find(s => s.key === ticket.status)?.category || 'open';
        const changes = { status: value };
        if (category === 'resolved') changes.resolved_at = new Date();
        if (category === 'open' && prevCategory !== 'open' && ticket.resolved_at) {
          changes.resolved_at = null;
          changes.reopen_count = ticket.reopen_count + 1;
        }
        await ticket.update(changes);
      }
      emitToCompany(req.companyId, 'tickets:bulk_updated', { ticket_ids, action, value });
      return res.json({
        updated: tickets.length - blocked.length,
        ...(blocked.length > 0 && { blocked, message: `${blocked.length} ticket(s) no se movieron: transición no permitida por el flujo configurado` }),
      });
    }

    const actionMap = {
      assign:   { agent_id:  value },
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

module.exports = { list, getOne, create, update, addMessage, getMessages, bulkUpdate, exportTickets };
