const router = require('express').Router();
const { TicketMessage, TicketAttachment, Ticket } = require('../models');
const { authenticate, tenantMiddleware } = require('../middleware/auth');

router.use(authenticate, tenantMiddleware);

// Carga el mensaje junto con su ticket y valida que pertenezca a la
// empresa del usuario (o que sea super_admin). Sin esto, un admin de la
// empresa A podía editar/borrar mensajes de tickets de la empresa B con
// solo conocer el UUID del mensaje.
async function loadOwnedMessage(req, res) {
  const msg = await TicketMessage.findByPk(req.params.id, {
    include: [{ model: Ticket, as: 'ticket', attributes: ['id', 'company_id'] }],
  });
  if (!msg || !msg.ticket) {
    res.status(404).json({ error: 'Mensaje no encontrado' });
    return null;
  }
  if (req.user.role !== 'super_admin' && msg.ticket.company_id !== req.companyId) {
    res.status(404).json({ error: 'Mensaje no encontrado' });
    return null;
  }
  if (msg.user_id !== req.user.id && !['super_admin', 'admin'].includes(req.user.role)) {
    res.status(403).json({ error: 'Sin permisos' });
    return null;
  }
  return msg;
}

router.put('/:id', async (req, res, next) => {
  try {
    const msg = await loadOwnedMessage(req, res);
    if (!msg) return;
    await msg.update({ content: req.body.content });
    res.json(msg);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const msg = await loadOwnedMessage(req, res);
    if (!msg) return;
    // Soft delete: reemplazar contenido
    await msg.update({ content: '[Mensaje eliminado]', author_type: 'system' });
    res.json({ message: 'Mensaje eliminado' });
  } catch (err) { next(err); }
});

module.exports = router;
