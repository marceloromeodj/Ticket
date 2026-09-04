const crypto = require('crypto');
const { TicketSurvey } = require('../models');
const { emailService } = require('./emailService');

const surveyService = {
  /**
   * Crea (si no existe ya) la encuesta CSAT de un ticket al resolverse o
   * cerrarse, y hace un intento best-effort de mandarla por email -- si no
   * hay bandeja configurada para la empresa, la encuesta igual queda
   * creada y se puede compartir el link manualmente desde el ticket.
   */
  async maybeCreateSurvey(ticket) {
    if (!['resolved', 'closed'].includes(ticket.status)) return null;
    if (!ticket.requester_email) return null;

    const existing = await TicketSurvey.findOne({ where: { ticket_id: ticket.id } });
    if (existing) return existing;

    const token = crypto.randomBytes(24).toString('hex');
    const survey = await TicketSurvey.create({
      company_id: ticket.company_id,
      ticket_id:  ticket.id,
      token,
      sent_at: new Date(),
    });

    const surveyUrl = `${process.env.FRONTEND_URL}/portal/survey/${token}`;
    try {
      await emailService.sendRaw({
        to: ticket.requester_email,
        companyId: ticket.company_id,
        subject: `¿Cómo fue tu experiencia? — Ticket #${ticket.ticket_number}`,
        html: `
          <p>Hola ${ticket.requester_name || ''},</p>
          <p>Tu ticket <strong>#${ticket.ticket_number}</strong> (${ticket.subject}) fue marcado como
          <strong>${ticket.status === 'closed' ? 'cerrado' : 'resuelto'}</strong>.</p>
          <p>¿Podrías calificar la atención que recibiste?</p>
          <p><a href="${surveyUrl}">Calificar ahora</a></p>
        `,
        text: `Calificá la atención que recibiste en el ticket #${ticket.ticket_number}: ${surveyUrl}`,
      });
    } catch (err) {
      console.error('[Survey] No se pudo enviar el email de la encuesta:', err.message);
    }

    return survey;
  },
};

module.exports = { surveyService };
