/**
 * Migración única: cifra las contraseñas IMAP/SMTP de las bandejas de email
 * que hoy están en texto plano en la base (instalaciones creadas antes de
 * agregar utils/crypto.js). Se corre una sola vez con:
 *   docker compose exec backend node src/scripts/encryptInboxSecrets.js
 *
 * Es seguro correrlo más de una vez: encrypt() no vuelve a cifrar un valor
 * que ya tiene el prefijo "enc:".
 */
require('dotenv').config();
const { EmailInbox } = require('../models');
const { encrypt } = require('../utils/crypto');

async function run() {
  const inboxes = await EmailInbox.findAll();
  let updated = 0;

  for (const inbox of inboxes) {
    const rawImap = inbox.getDataValue('imap_pass');
    const rawSmtp = inbox.getDataValue('smtp_pass');
    const alreadyEncrypted = (v) => typeof v === 'string' && v.startsWith('enc:');

    if (alreadyEncrypted(rawImap) && alreadyEncrypted(rawSmtp)) continue;

    await EmailInbox.update(
      {
        imap_pass: alreadyEncrypted(rawImap) ? rawImap : encrypt(rawImap),
        smtp_pass: alreadyEncrypted(rawSmtp) ? rawSmtp : encrypt(rawSmtp),
      },
      { where: { id: inbox.id }, hooks: false } // hooks:false: ya cifrado acá, no cifrar dos veces
    );
    updated++;
  }

  console.log(`[Migración] ${updated} bandeja(s) actualizada(s) de ${inboxes.length} total.`);
  process.exit(0);
}

run().catch((err) => {
  console.error('[Migración] Error:', err.message);
  process.exit(1);
});
