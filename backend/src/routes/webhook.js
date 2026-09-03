const router = require('express').Router();
const crypto = require('crypto');
const { whatsappService } = require('../services/whatsappService');

// WhatsApp Webhook verification
router.get('/whatsapp', (req, res) => {
  const mode      = req.query['hub.mode'];
  const token     = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.WA_WEBHOOK_VERIFY_TOKEN) {
    console.log('[WhatsApp] Webhook verificado');
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

// Verifica que el POST provenga realmente de Meta comparando la firma
// HMAC-SHA256 del body crudo con el header X-Hub-Signature-256, usando
// el App Secret de la app de Meta. Sin esto, cualquiera podía hacer POST
// directo a este endpoint simulando mensajes entrantes.
function verifyMetaSignature(req, res, next) {
  const appSecret = process.env.WA_APP_SECRET;
  if (!appSecret) {
    console.error('[WhatsApp] WA_APP_SECRET no configurado; se rechaza el webhook.');
    return res.sendStatus(503);
  }

  const signatureHeader = req.headers['x-hub-signature-256'];
  if (!signatureHeader || !req.rawBody) {
    return res.sendStatus(401);
  }

  const expected = 'sha256=' + crypto
    .createHmac('sha256', appSecret)
    .update(req.rawBody)
    .digest('hex');

  const received = Buffer.from(signatureHeader);
  const expectedBuf = Buffer.from(expected);
  if (received.length !== expectedBuf.length || !crypto.timingSafeEqual(received, expectedBuf)) {
    return res.sendStatus(401);
  }

  next();
}

// WhatsApp incoming messages
router.post('/whatsapp', verifyMetaSignature, async (req, res) => {
  try {
    res.sendStatus(200); // Responder inmediatamente a Meta
    await whatsappService.processWebhook(req.body);
  } catch (err) {
    console.error('[WhatsApp] Webhook error:', err.message);
  }
});

module.exports = router;
