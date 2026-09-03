/**
 * Integración con WhatsApp Business API (Meta Cloud API)
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api
 */
const axios = require('axios');
const { sequelize, Ticket, TicketMessage } = require('../models');
const { getNextTicketNumber } = require('../utils/ticketNumber');

const WA_API_BASE = 'https://graph.facebook.com/v18.0';

const whatsappService = {
  /**
   * Enviar mensaje de texto por WhatsApp
   */
  async sendText({ to, message, phoneNumberId }) {
    const phoneId = phoneNumberId || process.env.WA_PHONE_NUMBER_ID;
    const token   = process.env.WA_ACCESS_TOKEN;

    if (!phoneId || !token) {
      console.warn('[WhatsApp] API no configurada');
      return null;
    }

    const response = await axios.post(
      `${WA_API_BASE}/${phoneId}/messages`,
      {
        messaging_product: 'whatsapp',
        to:                to.replace(/\D/g, ''), // solo dígitos
        type:              'text',
        text:              { body: message },
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data;
  },

  /**
   * Enviar template de WhatsApp (para notificaciones proactivas)
   */
  async sendTemplate({ to, templateName, language = 'es', components = [] }) {
    const phoneId = process.env.WA_PHONE_NUMBER_ID;
    const token   = process.env.WA_ACCESS_TOKEN;

    if (!phoneId || !token) return null;

    const response = await axios.post(
      `${WA_API_BASE}/${phoneId}/messages`,
      {
        messaging_product: 'whatsapp',
        to:   to.replace(/\D/g, ''),
        type: 'template',
        template: { name: templateName, language: { code: language }, components },
      },
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
    );

    return response.data;
  },

  /**
   * Procesar webhook entrante de WhatsApp
   * @param {Object} body - body del webhook de Meta
   */
  async processWebhook(body) {
    try {
      const entry   = body.entry?.[0];
      const changes = entry?.changes?.[0];
      const value   = changes?.value;

      if (!value?.messages?.length) return;

      // Defensa en profundidad: aunque el webhook ya está protegido por
      // verificación de firma (X-Hub-Signature-256), confirmamos que el
      // mensaje corresponde al número de WhatsApp configurado para esta
      // instalación antes de procesarlo.
      const incomingPhoneId = value.metadata?.phone_number_id;
      if (process.env.WA_PHONE_NUMBER_ID && incomingPhoneId && incomingPhoneId !== process.env.WA_PHONE_NUMBER_ID) {
        console.warn(`[WhatsApp] Mensaje para phone_number_id desconocido: ${incomingPhoneId}`);
        return;
      }

      // Esta instalación soporta un único número de WhatsApp Business
      // (configuración global vía env), por lo que todos los tickets de
      // WhatsApp pertenecen a una única empresa designada explícitamente.
      // Antes se tomaba "la primera bandeja de email activa", lo cual
      // mezclaba tickets entre empresas de forma no determinística.
      const companyId = process.env.WA_DEFAULT_COMPANY_ID;
      if (!companyId) {
        console.error('[WhatsApp] WA_DEFAULT_COMPANY_ID no configurado; se descarta el mensaje entrante.');
        return;
      }

      for (const msg of value.messages) {
        const from    = msg.from;   // Número del usuario
        const msgId   = msg.id;
        const msgType = msg.type;   // text, image, document, etc.
        const content = msgType === 'text' ? msg.text?.body : `[${msgType}]`;
        const contact = value.contacts?.find(c => c.wa_id === from);
        const name    = contact?.profile?.name || from;

        // Buscar ticket existente por chat ID, dentro de la misma empresa
        let ticket = await Ticket.findOne({
          where: {
            whatsapp_chat_id: from,
            company_id: companyId,
            status: { [require('sequelize').Op.notIn]: ['closed'] },
          },
          order: [['created_at', 'DESC']],
        });

        if (!ticket) {
          const t = await sequelize.transaction();
          try {
            const ticket_number = await getNextTicketNumber(companyId, t);
            ticket = await Ticket.create({
              company_id:      companyId,
              ticket_number,
              subject:         `WhatsApp: ${name} - ${content?.substring(0, 100)}`,
              source:          'whatsapp',
              status:          'open',
              priority:        'medium',
              requester_name:  name,
              requester_phone: from,
              whatsapp_chat_id: from,
            }, { transaction: t });
            await t.commit();
          } catch (err) {
            await t.rollback();
            throw err;
          }
        }

        // Agregar mensaje
        await TicketMessage.create({
          ticket_id:     ticket.id,
          author_name:   name,
          author_type:   'customer',
          content,
          message_type:  'reply',
          channel:       'whatsapp',
          wa_message_id: msgId,
        });

        await ticket.update({ reply_count: (ticket.reply_count || 0) + 1 });
      }
    } catch (err) {
      console.error('[WhatsApp] Error procesando webhook:', err.message);
    }
  },
};

module.exports = { whatsappService };
