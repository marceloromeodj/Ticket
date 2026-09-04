const axios = require('axios');
const { AutomationRule, User, Ticket, TicketMessage, Notification } = require('../models');
const { emitToUser } = require('../config/socket');
const { emailService } = require('./emailService');

const automationService = {
  /**
   * Ejecutar reglas de automatización para un evento dado
   * @param {string} event - 'ticket_created' | 'ticket_updated' | etc.
   * @param {Object} ticket - instancia del ticket
   * @param {Object} actor  - usuario que generó el evento
   */
  async run(event, ticket, actor) {
    try {
      const rules = await AutomationRule.findAll({
        where: { company_id: ticket.company_id, event, active: true },
        order: [['position', 'ASC']],
      });

      for (const rule of rules) {
        if (this.evaluateConditions(rule, ticket)) {
          await this.executeActions(rule, ticket, actor);
          await rule.update({ run_count: rule.run_count + 1, last_run_at: new Date() });
        }
      }
    } catch (err) {
      console.error('[Automation] Error ejecutando reglas:', err.message);
    }
  },

  /**
   * Evaluar condiciones de una regla
   */
  evaluateConditions(rule, ticket) {
    const conditions = rule.conditions || [];
    if (conditions.length === 0) return true;

    const evaluator = (cond) => {
      const val = ticket[cond.field] || ticket.dataValues?.[cond.field];
      switch (cond.operator) {
        case 'is':          return val === cond.value;
        case 'is_not':      return val !== cond.value;
        case 'contains':    return String(val || '').toLowerCase().includes(cond.value.toLowerCase());
        case 'not_contains':return !String(val || '').toLowerCase().includes(cond.value.toLowerCase());
        case 'in':          return (cond.value || []).includes(val);
        case 'not_in':      return !(cond.value || []).includes(val);
        case 'is_null':     return val == null;
        case 'is_not_null': return val != null;
        default:            return true;
      }
    };

    return rule.condition_type === 'any'
      ? conditions.some(evaluator)
      : conditions.every(evaluator);
  },

  /**
   * Ejecutar acciones de una regla
   */
  async executeActions(rule, ticket, actor) {
    const actions = rule.actions || [];

    for (const action of actions) {
      try {
        switch (action.type) {
          case 'assign_agent':
            await Ticket.update({ agent_id: action.value }, { where: { id: ticket.id } });
            break;

          case 'set_priority':
            await Ticket.update({ priority: action.value }, { where: { id: ticket.id } });
            break;

          case 'set_status':
            await Ticket.update({ status: action.value }, { where: { id: ticket.id } });
            break;

          case 'set_category':
            await Ticket.update({ category_id: action.value }, { where: { id: ticket.id } });
            break;

          case 'assign_group': {
            const group = action.value;
            if (!group) break;
            await Ticket.update({ assigned_group: group }, { where: { id: ticket.id } });

            const { Op } = require('sequelize');
            const members = await User.findAll({
              where: { company_id: ticket.company_id, active: true, groups: { [Op.contains]: [group] } },
              attributes: ['id'],
            });
            for (const member of members) {
              await Notification.create({
                user_id: member.id, ticket_id: ticket.id, type: 'system',
                title: `Ticket asignado al grupo "${group}"`,
                message: `Ticket #${ticket.ticket_number}: ${ticket.subject}`,
              });
              emitToUser(member.id, 'notification:new', { rule: rule.name, ticket_id: ticket.id });
            }
            break;
          }

          case 'add_note':
            await TicketMessage.create({
              ticket_id:    ticket.id,
              author_type:  'system',
              content:      action.value,
              message_type: 'internal_note',
              is_private:   true,
              channel:      'web',
            });
            break;

          case 'send_email': {
            const { to, subject, body } = action.value;
            let recipient = ticket.requester_email;
            if (to === 'agent' && ticket.agent_id) {
              const agent = await User.findByPk(ticket.agent_id);
              recipient = agent?.email;
            } else if (to === 'specific') {
              recipient = action.value.email;
            }
            if (recipient) {
              await emailService.sendRaw({ to: recipient, subject, html: body });
            }
            break;
          }

          case 'notify_agent': {
            const agentId = action.value === 'assigned' ? ticket.agent_id : action.value;
            if (agentId) {
              await Notification.create({
                user_id:   agentId,
                ticket_id: ticket.id,
                type:      'system',
                title:     `Automatización: ${rule.name}`,
                message:   `Regla ejecutada en ticket #${ticket.ticket_number}`,
              });
              emitToUser(agentId, 'notification:new', { rule: rule.name, ticket_id: ticket.id });
            }
            break;
          }

          case 'call_webhook': {
            const { url } = action.value || {};
            if (!url) break;
            await axios.post(url, {
              event: rule.event,
              rule_name: rule.name,
              ticket: {
                id: ticket.id, ticket_number: ticket.ticket_number, subject: ticket.subject,
                status: ticket.status, priority: ticket.priority, requester_email: ticket.requester_email,
              },
            }, { timeout: 5000 });
            break;
          }

          default:
            console.warn(`[Automation] Acción desconocida: ${action.type}`);
        }
      } catch (err) {
        console.error(`[Automation] Error en acción ${action.type}:`, err.message);
      }
    }
  },
};

module.exports = { automationService };
