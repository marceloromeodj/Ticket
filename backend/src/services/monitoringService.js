/**
 * Integración con plataformas de monitoreo (Zabbix, PRTG, y en general
 * cualquiera que pueda mandar un webhook HTTP configurable). No existe un
 * formato estándar entre plataformas, así que en vez de adivinar el
 * payload nativo de cada una, se define un contrato JSON normalizado que
 * hay que configurar como plantilla de notificación en Zabbix (Media
 * type: Webhook) o en PRTG (Notification: HTTP request):
 *
 *   {
 *     "source": "zabbix" | "prtg",
 *     "status": "problem" | "resolved",
 *     "external_id": "<id único de la alerta/sensor, estable entre problem y resolved>",
 *     "host": "<nombre del host/dispositivo/sensor>",
 *     "message": "<descripción del problema>",
 *     "severity": "<texto libre: info|warning|average|high|critical|disaster, etc.>"
 *   }
 *
 * external_id es la clave para poder cerrar/actualizar el ticket correcto
 * cuando llega el evento de "resolved" de la misma alerta.
 */
const { sequelize, Ticket, TicketMessage } = require('../models');
const { getNextTicketNumber } = require('../utils/ticketNumber');
const { getInitialStatusKey, getKeysByCategory, isFinalStatus } = require('./ticketStatusService');

const SEVERITY_TO_PRIORITY = {
  info: 'low', information: 'low', 'not classified': 'low',
  warning: 'medium', average: 'medium',
  high: 'high', error: 'high',
  disaster: 'urgent', critical: 'urgent',
};

function mapSeverity(severity) {
  return SEVERITY_TO_PRIORITY[String(severity || '').toLowerCase()] || 'medium';
}

const monitoringService = {
  async processAlert(company, payload) {
    const { source, status, external_id, host, message, severity } = payload;
    if (!external_id || !status) {
      throw new Error('Payload inválido: se requieren external_id y status');
    }

    const existing = await Ticket.findOne({
      where: { company_id: company.id, external_source: source || null, external_alert_id: String(external_id) },
      order: [['created_at', 'DESC']],
    });

    if (status === 'resolved') {
      if (!existing) return { action: 'ignored', reason: 'no había ticket abierto para esa alerta' };
      if (await isFinalStatus(company.id, existing.status)) return { action: 'ignored', reason: 'el ticket ya estaba resuelto' };

      const [resolvedKey] = await getKeysByCategory(company.id, ['resolved']);
      await TicketMessage.create({
        ticket_id: existing.id,
        author_type: 'system',
        content: `[Monitoreo] La alerta se marcó como resuelta en ${source || 'la plataforma de monitoreo'}.`,
        message_type: 'activity_log',
        channel: 'api',
      });
      await existing.update({ status: resolvedKey || 'resolved', resolved_at: new Date() });
      return { action: 'resolved', ticket_id: existing.id };
    }

    // status === 'problem'
    if (existing && !(await isFinalStatus(company.id, existing.status))) {
      // Ya hay un ticket abierto para esta misma alerta: no duplicar.
      return { action: 'already_open', ticket_id: existing.id };
    }

    const t = await sequelize.transaction();
    try {
      const ticket_number = await getNextTicketNumber(company.id, t);
      const initialStatus = await getInitialStatusKey(company.id);
      const ticket = await Ticket.create({
        company_id:  company.id,
        ticket_number,
        subject:     `[Monitoreo] ${host || 'Alerta'}: ${(message || '').substring(0, 150)}`,
        description: message || '',
        source:      'api',
        type:        'incident',
        status:      initialStatus,
        priority:    mapSeverity(severity),
        requester_name: source === 'zabbix' ? 'Zabbix' : source === 'prtg' ? 'PRTG' : 'Monitoreo',
        external_source:   source || null,
        external_alert_id: String(external_id),
      }, { transaction: t });

      await TicketMessage.create({
        ticket_id: ticket.id,
        author_type: 'system',
        content: `[Monitoreo] Alerta generada automáticamente.\nHost: ${host || '-'}\nMensaje: ${message || '-'}\nSeveridad: ${severity || '-'}`,
        message_type: 'reply',
        channel: 'api',
      }, { transaction: t });

      await t.commit();
      return { action: 'created', ticket_id: ticket.id, ticket_number };
    } catch (err) {
      await t.rollback();
      throw err;
    }
  },
};

module.exports = { monitoringService };
