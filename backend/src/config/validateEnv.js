/**
 * Valida que los secretos requeridos estén definidos y no usen los
 * valores de ejemplo de .env.example. Se ejecuta al arrancar el
 * proceso, antes de conectar a cualquier servicio, para fallar rápido
 * en vez de correr en producción con credenciales por defecto.
 */
const KNOWN_INSECURE_VALUES = new Set([
  'change_me_super_secret_jwt_key_2024',
  'change_me_refresh_secret_2024',
  'helpdesk_secret',
  'redis_secret',
  'minioadmin',
  'minioadmin123',
  'your_verify_token_here',
  'your_whatsapp_access_token',
  'your_phone_number_id',
  'Admin1234!',
]);

const REQUIRED = [
  { key: 'JWT_SECRET', minLength: 32 },
  { key: 'JWT_REFRESH_SECRET', minLength: 32 },
  { key: 'DB_PASSWORD', minLength: 8 },
  { key: 'MINIO_SECRET_KEY', minLength: 8 },
  { key: 'SUPER_ADMIN_PASSWORD', minLength: 8 },
  { key: 'ENCRYPTION_KEY', minLength: 64 },
];

function validateEnv() {
  const errors = [];

  for (const { key, minLength } of REQUIRED) {
    const value = process.env[key];
    if (!value) {
      errors.push(`${key} no está definida.`);
      continue;
    }
    if (KNOWN_INSECURE_VALUES.has(value)) {
      errors.push(`${key} usa un valor de ejemplo inseguro. Generá uno propio (ej: openssl rand -base64 64).`);
      continue;
    }
    if (value.length < minLength) {
      errors.push(`${key} es demasiado corta (mínimo ${minLength} caracteres).`);
    }
  }

  if (process.env.ENCRYPTION_KEY && !/^[0-9a-f]{64}$/i.test(process.env.ENCRYPTION_KEY)) {
    errors.push('ENCRYPTION_KEY debe ser una cadena hexadecimal de 64 caracteres (32 bytes). Generala con: openssl rand -hex 32');
  }

  if (process.env.WA_WEBHOOK_VERIFY_TOKEN && KNOWN_INSECURE_VALUES.has(process.env.WA_WEBHOOK_VERIFY_TOKEN)) {
    errors.push('WA_WEBHOOK_VERIFY_TOKEN usa el valor de ejemplo. Generá uno propio.');
  }

  if (errors.length > 0) {
    console.error('\n[FATAL] Configuración insegura o incompleta:\n');
    errors.forEach(e => console.error(`  - ${e}`));
    console.error('\nRevisá tu archivo .env antes de continuar.\n');
    process.exit(1);
  }
}

module.exports = { validateEnv };
