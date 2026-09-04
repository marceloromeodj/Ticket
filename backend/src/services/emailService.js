const nodemailer = require('nodemailer');
const Imap = require('imap');
const { simpleParser } = require('mailparser');
const { sequelize, EmailInbox, Ticket, TicketMessage, Company } = require('../models');
const { getNextTicketNumber } = require('../utils/ticketNumber');

// Transporte por defecto (se sobreescribe por bandeja de entrada)
function createTransport(inbox) {
  return nodemailer.createTransport({
    host: inbox.smtp_host,
    port: inbox.smtp_port,
    secure: inbox.smtp_port === 465,
    auth: { user: inbox.smtp_user, pass: inbox.smtp_pass },
    tls: { rejectUnauthorized: false },
  });
}

const emailService = {
  /**
   * Enviar respuesta de un ticket por email
   */
  async sendTicketReply({ ticket, message, inbox, toEmail, toName }) {
    if (!inbox) {
      console.warn('[Email] Sin bandeja de entrada configurada');
      return;
    }

    const transport = createTransport(inbox);
    const subject   = ticket.email_message_id
      ? `Re: ${ticket.subject}`
      : `[Ticket #${ticket.ticket_number}] ${ticket.subject}`;

    await transport.sendMail({
      from:    `"${inbox.from_name || inbox.name}" <${inbox.email}>`,
      to:      `${toName || ''} <${toEmail}>`,
      subject,
      html:    message.content_html || `<p>${message.content}</p>`,
      text:    message.content,
      headers: {
        'X-Ticket-ID':   ticket.id,
        'X-Ticket-Num':  ticket.ticket_number,
        'Message-ID':    `<ticket-${ticket.id}-${Date.now()}@helpdesk>`,
        ...(ticket.email_message_id && {
          'In-Reply-To':  ticket.email_message_id,
          'References':   ticket.email_message_id,
        }),
      },
    });
  },

  /**
   * Enviar notificación genérica
   */
  async sendRaw({ to, subject, html, text, companyId, attachments }) {
    // Si se pasa companyId, usa una bandeja de esa empresa; si no, la
    // primera activa que encuentre (compatibilidad con llamadas previas
    // sin contexto de empresa, ej. reset de contraseña).
    const inbox = await EmailInbox.findOne({ where: { active: true, ...(companyId ? { company_id: companyId } : {}) } });
    if (!inbox) return console.warn('[Email] Sin SMTP configurado');

    const transport = createTransport(inbox);
    await transport.sendMail({
      from:    `"HelpDesk" <${inbox.email}>`,
      to,
      subject,
      html,
      text,
      attachments, // [{ filename, content: Buffer }]
    });
  },

  /**
   * Enviar enlace de restablecimiento de contraseña
   */
  async sendPasswordReset(user, resetUrl) {
    await this.sendRaw({
      to:      user.email,
      subject: 'Restablecer contraseña - HelpDesk',
      html:    `
        <h2>Restablecer contraseña</h2>
        <p>Hola ${user.name},</p>
        <p>Hacé clic en el enlace para restablecer tu contraseña:</p>
        <p><a href="${resetUrl}">${resetUrl}</a></p>
        <p>El enlace expira en 1 hora.</p>
      `,
    });
  },

  /**
   * Escuchar bandeja IMAP y convertir emails en tickets
   */
  async listenInbox(inbox) {
    return new Promise((resolve, reject) => {
      const imap = new Imap({
        user:     inbox.imap_user,
        password: inbox.imap_pass,
        host:     inbox.imap_host,
        port:     inbox.imap_port,
        tls:      inbox.imap_use_ssl,
        tlsOptions: { rejectUnauthorized: false },
      });

      imap.once('ready', () => {
        imap.openBox('INBOX', false, (err, box) => {
          if (err) return reject(err);

          // Buscar emails no leídos desde la última sync
          imap.search(['UNSEEN'], async (err, results) => {
            if (err || !results.length) {
              imap.end();
              return resolve({ processed: 0 });
            }

            const fetch = imap.fetch(results, { bodies: '' });
            let processed = 0;

            fetch.on('message', (msg) => {
              msg.on('body', async (stream) => {
                try {
                  const parsed = await simpleParser(stream);
                  await this.processIncomingEmail(parsed, inbox);
                  processed++;
                } catch (e) {
                  console.error('[IMAP] Error procesando email:', e.message);
                }
              });
            });

            fetch.once('end', () => {
              // Marcar como leídos
              imap.addFlags(results, ['\\Seen'], () => {
                imap.end();
                resolve({ processed });
              });
            });
          });
        });
      });

      imap.once('error', reject);
      imap.connect();
    });
  },

  /**
   * Procesar un email entrante y crear/actualizar ticket
   */
  async processIncomingEmail(parsed, inbox) {
    const fromEmail = parsed.from?.value?.[0]?.address || '';
    const fromName  = parsed.from?.value?.[0]?.name    || fromEmail;
    const subject   = parsed.subject || '(Sin asunto)';
    const content   = parsed.text    || parsed.html || '';
    const messageId = parsed.messageId;
    const inReplyTo = parsed.inReplyTo;

    // Ver si es respuesta a un ticket existente
    let ticket = null;

    if (inReplyTo) {
      // Buscar ticket por email_message_id
      ticket = await Ticket.findOne({ where: { email_message_id: inReplyTo } });
      // O buscar en mensajes anteriores
      if (!ticket) {
        const { TicketMessage } = require('../models');
        const prevMsg = await TicketMessage.findOne({ where: { email_message_id: inReplyTo } });
        if (prevMsg) ticket = await Ticket.findByPk(prevMsg.ticket_id);
      }
    }

    if (ticket) {
      // Agregar mensaje al ticket existente
      await TicketMessage.create({
        ticket_id:       ticket.id,
        author_name:     fromName,
        author_email:    fromEmail,
        author_type:     'customer',
        content:         content,
        message_type:    'reply',
        channel:         'email',
        email_message_id: messageId,
      });

      // Si estaba resuelto, reabrirlo
      if (['resolved', 'closed'].includes(ticket.status)) {
        await ticket.update({ status: 'open', resolved_at: null, reopen_count: ticket.reopen_count + 1 });
      }
    } else {
      // Crear nuevo ticket (numeración segura bajo concurrencia)
      const t = await sequelize.transaction();
      try {
        const ticket_number = await getNextTicketNumber(inbox.company_id, t);

        const newTicket = await Ticket.create({
          company_id:      inbox.company_id,
          branch_id:       inbox.branch_id,
          ticket_number,
          subject,
          description:     content,
          source:          'email',
          status:          'open',
          priority:        'medium',
          requester_name:  fromName,
          requester_email: fromEmail,
          agent_id:        inbox.auto_assign_to || null,
          category_id:     inbox.default_category_id || null,
          email_message_id: messageId,
        }, { transaction: t });

        await TicketMessage.create({
          ticket_id:       newTicket.id,
          author_name:     fromName,
          author_email:    fromEmail,
          author_type:     'customer',
          content,
          message_type:    'reply',
          channel:         'email',
          email_message_id: messageId,
        }, { transaction: t });

        await t.commit();
      } catch (err) {
        await t.rollback();
        throw err;
      }
    }
  },

  /**
   * Sincronizar todas las bandejas activas
   */
  async syncAllInboxes() {
    const inboxes = await EmailInbox.findAll({ where: { active: true } });
    for (const inbox of inboxes) {
      try {
        const result = await this.listenInbox(inbox);
        await inbox.update({ last_sync_at: new Date() });
        console.log(`[Email] Inbox ${inbox.email}: ${result.processed} emails procesados`);
      } catch (err) {
        console.error(`[Email] Error en inbox ${inbox.email}:`, err.message);
      }
    }
  },
};

module.exports = { emailService };
