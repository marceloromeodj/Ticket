const crypto = require('crypto');
const { TicketSurvey } = require('../models');
const { emailService } = require('./emailService');
const { renderTemplate } = require('./templateService');

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
      const { subject, body } = await renderTemplate(ticket.company_id, 'survey_invite', {
        requester_name: ticket.requester_name || '',
        ticket_number:  ticket.ticket_number,
        subject:        ticket.subject,
        status_label:   ticket.status === 'closed' ? 'cerrado' : 'resuelto',
        survey_url:     surveyUrl,
      });
      await emailService.sendRaw({
        to: ticket.requester_email,
        companyId: ticket.company_id,
        subject,
        html: body,
        text: `Calificá la atención que recibiste en el ticket #${ticket.ticket_number}: ${surveyUrl}`,
      });
    } catch (err) {
      console.error('[Survey] No se pudo enviar el email de la encuesta:', err.message);
    }

    return survey;
  },
};

module.exports = { surveyService };
