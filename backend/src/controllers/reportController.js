const { Op, fn, col, literal } = require('sequelize');
const { sequelize, Ticket, TicketMessage, User, Category, TicketSurvey } = require('../models');
const moment = require('moment-timezone');
const { companyScope } = require('../middleware/auth');

// ─── Overview / Dashboard stats ─────────────────────────────────
async function overview(req, res, next) {
  try {
    const { from, to, branch_id } = req.query;
    const tz   = req.user.company?.timezone || 'UTC';
    const from_ = from ? moment.tz(from, tz).toDate() : moment.tz(tz).subtract(30, 'days').toDate();
    const to_   = to   ? moment.tz(to,   tz).toDate() : new Date();

    const where = { ...companyScope(req), created_at: { [Op.between]: [from_, to_] } };
    if (branch_id) where.branch_id = branch_id;

    const [
      total, open, pending, resolved, closed,
      urgentOpen, slaBreached,
    ] = await Promise.all([
      Ticket.count({ where }),
      Ticket.count({ where: { ...where, status: 'open' } }),
      Ticket.count({ where: { ...where, status: 'pending' } }),
      Ticket.count({ where: { ...where, status: 'resolved' } }),
      Ticket.count({ where: { ...where, status: 'closed' } }),
      Ticket.count({ where: { ...where, priority: 'urgent', status: { [Op.notIn]: ['resolved','closed'] } } }),
      Ticket.count({ where: { ...where, sla_status: 'breached' } }),
    ]);

    // Tiempo promedio de primera respuesta (en minutos)
    const avgFirstResponse = await Ticket.findOne({
      where: { ...where, first_responded_at: { [Op.ne]: null } },
      attributes: [
        [fn('AVG', literal("EXTRACT(EPOCH FROM (first_responded_at - created_at)) / 60")), 'avg_minutes'],
      ],
      raw: true,
    });

    // Tiempo promedio de resolución
    const avgResolution = await Ticket.findOne({
      where: { ...where, resolved_at: { [Op.ne]: null } },
      attributes: [
        [fn('AVG', literal("EXTRACT(EPOCH FROM (resolved_at - created_at)) / 60")), 'avg_minutes'],
      ],
      raw: true,
    });

    res.json({
      total,
      by_status:   { open, pending, resolved, closed },
      urgent_open: urgentOpen,
      sla_breached: slaBreached,
      avg_first_response_minutes: Math.round(avgFirstResponse?.avg_minutes || 0),
      avg_resolution_minutes:     Math.round(avgResolution?.avg_minutes || 0),
    });
  } catch (err) { next(err); }
}

// ─── Tickets por día (para gráfico de línea/barra) ──────────────
async function ticketsByDate(req, res, next) {
  try {
    const { from, to, branch_id, group_by = 'day' } = req.query;
    const tz   = 'UTC';
    const from_ = from ? new Date(from) : moment().subtract(30, 'days').toDate();
    const to_   = to   ? new Date(to)   : new Date();

    const dateTrunc = group_by === 'month' ? 'month' : group_by === 'week' ? 'week' : 'day';
    const where = { ...companyScope(req), created_at: { [Op.between]: [from_, to_] } };
    if (branch_id) where.branch_id = branch_id;

    const data = await Ticket.findAll({
      where,
      attributes: [
        [fn('DATE_TRUNC', dateTrunc, col('created_at')), 'date'],
        [fn('COUNT', col('id')), 'count'],
        'status',
      ],
      group: [literal(`DATE_TRUNC('${dateTrunc}', created_at)`), 'status'],
      order: [[literal(`DATE_TRUNC('${dateTrunc}', created_at)`), 'ASC']],
      raw: true,
    });

    res.json(data);
  } catch (err) { next(err); }
}

// ─── Performance por agente ──────────────────────────────────────
async function agentPerformance(req, res, next) {
  try {
    const { from, to, branch_id } = req.query;
    const from_ = from ? new Date(from) : moment().subtract(30, 'days').toDate();
    const to_   = to   ? new Date(to)   : new Date();

    const where = {
      ...companyScope(req),
      agent_id:   { [Op.ne]: null },
      created_at: { [Op.between]: [from_, to_] },
    };
    if (branch_id) where.branch_id = branch_id;

    const data = await Ticket.findAll({
      where,
      attributes: [
        'agent_id',
        [fn('COUNT', col('Ticket.id')), 'total'],
        [fn('COUNT', literal("CASE WHEN status = 'resolved' OR status = 'closed' THEN 1 END")), 'resolved'],
        [fn('AVG', literal("CASE WHEN first_responded_at IS NOT NULL THEN EXTRACT(EPOCH FROM (first_responded_at - \"Ticket\".created_at)) / 60 END")), 'avg_first_response'],
        [fn('AVG', literal("CASE WHEN resolved_at IS NOT NULL THEN EXTRACT(EPOCH FROM (resolved_at - \"Ticket\".created_at)) / 60 END")), 'avg_resolution'],
        [fn('COUNT', literal("CASE WHEN sla_status = 'breached' THEN 1 END")), 'sla_breached'],
      ],
      include: [
        { model: User, as: 'agent', attributes: ['id','name','avatar_url'] },
      ],
      group: ['agent_id', 'agent.id'],
      order: [[literal('total'), 'DESC']],
      raw: false,
    });

    res.json(data);
  } catch (err) { next(err); }
}

// ─── Por categoría ───────────────────────────────────────────────
async function byCategory(req, res, next) {
  try {
    const { from, to } = req.query;
    const from_ = from ? new Date(from) : moment().subtract(30, 'days').toDate();
    const to_   = to   ? new Date(to)   : new Date();

    const data = await Ticket.findAll({
      where: { ...companyScope(req), created_at: { [Op.between]: [from_, to_] } },
      attributes: [
        'category_id',
        [fn('COUNT', col('Ticket.id')), 'total'],
      ],
      include: [{ model: Category, as: 'category', attributes: ['id','name','color'] }],
      group: ['category_id', 'category.id'],
      order: [[literal('total'), 'DESC']],
    });

    res.json(data);
  } catch (err) { next(err); }
}

// ─── SLA report ──────────────────────────────────────────────────
async function slaReport(req, res, next) {
  try {
    const { from, to } = req.query;
    const from_ = from ? new Date(from) : moment().subtract(30, 'days').toDate();
    const to_   = to   ? new Date(to)   : new Date();

    const [ok, warning, breached] = await Promise.all([
      Ticket.count({ where: { ...companyScope(req), created_at: { [Op.between]: [from_, to_] }, sla_status: 'ok' } }),
      Ticket.count({ where: { ...companyScope(req), created_at: { [Op.between]: [from_, to_] }, sla_status: 'warning' } }),
      Ticket.count({ where: { ...companyScope(req), created_at: { [Op.between]: [from_, to_] }, sla_status: 'breached' } }),
    ]);

    const total = ok + warning + breached;
    res.json({
      total,
      ok,      ok_pct:      total ? Math.round((ok      / total) * 100) : 0,
      warning, warning_pct: total ? Math.round((warning / total) * 100) : 0,
      breached,breached_pct:total ? Math.round((breached/ total) * 100) : 0,
    });
  } catch (err) { next(err); }
}

// ─── Satisfacción del usuario (CSAT) ──────────────────────────────
async function satisfactionReport(req, res, next) {
  try {
    const { from, to } = req.query;
    const from_ = from ? new Date(from) : moment().subtract(30, 'days').toDate();
    const to_   = to   ? new Date(to)   : new Date();

    const where = { ...companyScope(req), responded_at: { [Op.between]: [from_, to_] } };

    const surveys = await TicketSurvey.findAll({
      where,
      include: [{ model: Ticket, as: 'ticket', attributes: ['agent_id'], include: [{ model: User, as: 'agent', attributes: ['id', 'name'] }] }],
    });

    const total = surveys.length;
    const avg = total ? surveys.reduce((sum, s) => sum + s.rating, 0) / total : 0;
    const distribution = [1, 2, 3, 4, 5].map(n => surveys.filter(s => s.rating === n).length);
    const csat_pct = total ? Math.round((surveys.filter(s => s.rating >= 4).length / total) * 100) : 0;
    const detractor_pct = total ? Math.round((surveys.filter(s => s.rating <= 2).length / total) * 100) : 0;

    // NPS real: de las respuestas que además contestaron la pregunta de
    // recomendación (0-10), % promotores (9-10) menos % detractores (0-6).
    const npsResponses = surveys.filter(s => s.nps_score !== null && s.nps_score !== undefined);
    const npsTotal = npsResponses.length;
    const promoters = npsResponses.filter(s => s.nps_score >= 9).length;
    const detractorsNps = npsResponses.filter(s => s.nps_score <= 6).length;
    const nps_score = npsTotal ? Math.round(((promoters - detractorsNps) / npsTotal) * 100) : null;

    const byAgentMap = {};
    surveys.forEach(s => {
      const agent = s.ticket?.agent;
      if (!agent) return;
      if (!byAgentMap[agent.id]) byAgentMap[agent.id] = { agent_id: agent.id, agent_name: agent.name, count: 0, sum: 0 };
      byAgentMap[agent.id].count += 1;
      byAgentMap[agent.id].sum += s.rating;
    });
    const by_agent = Object.values(byAgentMap)
      .map(a => ({ agent_id: a.agent_id, agent_name: a.agent_name, responses: a.count, avg_rating: Math.round((a.sum / a.count) * 10) / 10 }))
      .sort((a, b) => b.avg_rating - a.avg_rating);

    res.json({
      total_responses: total,
      avg_rating: Math.round(avg * 10) / 10,
      csat_pct,
      detractor_pct,
      nps_score,   // -100 a 100, null si nadie respondió la pregunta de NPS
      nps_responses: npsTotal,
      distribution, // [count con 1 estrella, ..., count con 5 estrellas]
      by_agent,
    });
  } catch (err) { next(err); }
}

module.exports = { overview, ticketsByDate, agentPerformance, byCategory, slaReport, satisfactionReport };
