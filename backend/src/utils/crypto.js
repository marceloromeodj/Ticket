const crypto = require('crypto');

// Cifrado simétrico para secretos guardados en la base (contraseñas IMAP/SMTP
// de las bandejas de email). Antes se guardaban en texto plano; esto los
// cifra en reposo con AES-256-GCM usando una clave de 32 bytes en
// ENCRYPTION_KEY (env). El prefijo "enc:" marca un valor ya cifrado, para
// poder migrar filas existentes sin cifrarlas dos veces.
const PREFIX = 'enc:';

function getKey() {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) throw new Error('ENCRYPTION_KEY no está definida');
  const key = Buffer.from(raw, 'hex');
  if (key.length !== 32) throw new Error('ENCRYPTION_KEY debe ser una cadena hex de 32 bytes (64 caracteres) — generala con: openssl rand -hex 32');
  return key;
}

function encrypt(plainText) {
  if (plainText === null || plainText === undefined || plainText === '') return plainText;
  if (typeof plainText === 'string' && plainText.startsWith(PREFIX)) return plainText; // ya cifrado

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(plainText), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return PREFIX + Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

function decrypt(value) {
  if (value === null || value === undefined || value === '') return value;
  if (typeof value !== 'string' || !value.startsWith(PREFIX)) return value; // no cifrado (legado)

  const buf = Buffer.from(value.slice(PREFIX.length), 'base64');
  const iv = buf.subarray(0, 12);
  const authTag = buf.subarray(12, 28);
  const encrypted = buf.subarray(28);

  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

module.exports = { encrypt, decrypt };
