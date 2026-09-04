/**
 * Textos de notificación con override por empresa. Cada evento tiene un
 * default acá (channel, variables disponibles, y subject/body o text) que
 * se usa si la empresa no cargó un NotificationTemplate propio en
 * Configuración > Plantillas.
 */
const DEFAULT_TEMPLATES = {
  ticket_urgent: {
    channel: 'broadcast',
    label: 'Ticket urgente creado',
    variables: ['ticket_number', 'subject'],
    body: '🔴 Ticket urgente #{{ticket_number}}: {{subject}}',
  },
  sla_breach: {
    channel: 'broadcast',
    label: 'SLA incumplido',
    variables: ['count', 'ticket_list'],
    body: '⏰ SLA incumplido en {{count}} ticket(s): {{ticket_list}}',
  },
  major_incident: {
    channel: 'broadcast',
    label: 'Incidente masivo / mayor',
    variables: ['count', 'window_minutes', 'ticket_numbers'],
    body: '🚨 Se detectaron {{count}} tickets abiertos en los últimos {{window_minutes}} minutos con la misma categoría/servicio: {{ticket_numbers}}. Revisá si conviene declarar un Incidente Mayor.',
  },
  contract_expiring: {
    channel: 'broadcast',
    label: 'Contrato/licencia por vencer',
    variables: ['name', 'days_left', 'end_date'],
    body: '📄 El contrato/licencia "{{name}}" vence en {{days_left}} día(s) ({{end_date}}).',
  },
  password_reset: {
    channel: 'email',
    label: 'Email de restablecer contraseña',
    variables: ['name', 'reset_url'],
    subject: 'Restablecer contraseña - HelpDesk',
    body: '<h2>Restablecer contraseña</h2><p>Hola {{name}},</p><p>Hacé clic en el enlace para restablecer tu contraseña:</p><p><a href="{{reset_url}}">{{reset_url}}</a></p><p>El enlace expira en 1 hora.</p>',
  },
  survey_invite: {
    channel: 'email',
    label: 'Email de invitación a encuesta CSAT',
    variables: ['requester_name', 'ticket_number', 'subject', 'status_label', 'survey_url'],
    subject: '¿Cómo fue tu experiencia? — Ticket #{{ticket_number}}',
    body: '<p>Hola {{requester_name}},</p><p>Tu ticket <strong>#{{ticket_number}}</strong> ({{subject}}) fue marcado como <strong>{{status_label}}</strong>.</p><p>¿Podrías calificar la atención que recibiste?</p><p><a href="{{survey_url}}">Calificar ahora</a></p>',
  },
};

function render(str, vars = {}) {
  return String(str || '').replace(/\{\{(\w+)\}\}/g, (_, key) => (vars[key] ?? ''));
}

/** Trae el template efectivo (override de la empresa o default) sin renderizar. */
async function getTemplate(companyId, event) {
  const { NotificationTemplate } = require('../models');
  const def = DEFAULT_TEMPLATES[event];
  if (!def) throw new Error(`Evento de notificación desconocido: ${event}`);

  const override = companyId
    ? await NotificationTemplate.findOne({ where: { company_id: companyId, event } })
    : null;

  return {
    event,
    channel: def.channel,
    label: def.label,
    variables: def.variables,
    subject: override?.subject ?? def.subject ?? null,
    body: override?.body ?? def.body,
    is_custom: !!override,
  };
}

/** Devuelve el texto ya renderizado (para broadcast) o {subject, body} (para email). */
async function renderTemplate(companyId, event, vars) {
  const tpl = await getTemplate(companyId, event);
  if (tpl.channel === 'broadcast') return render(tpl.body, vars);
  return { subject: render(tpl.subject, vars), body: render(tpl.body, vars) };
}

module.exports = { DEFAULT_TEMPLATES, getTemplate, renderTemplate, render };
