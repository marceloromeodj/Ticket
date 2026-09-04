const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

// SSO es a nivel plataforma (una sola app de Google / Azure AD para todo
// HelpDesk, no por empresa): el usuario debe existir de antemano en
// HelpDesk con ese email -- SSO solo reemplaza el paso de contraseña, no
// crea cuentas nuevas.

const googleClient = process.env.GOOGLE_CLIENT_ID ? new OAuth2Client(process.env.GOOGLE_CLIENT_ID) : null;

async function verifyGoogleIdToken(idToken) {
  if (!googleClient) throw new Error('SSO de Google no está configurado (falta GOOGLE_CLIENT_ID)');
  const ticket = await googleClient.verifyIdToken({ idToken, audience: process.env.GOOGLE_CLIENT_ID });
  const payload = ticket.getPayload();
  if (!payload?.email_verified) throw new Error('El email de Google no está verificado');
  return { email: payload.email, name: payload.name };
}

const msJwks = process.env.AZURE_TENANT_ID
  ? jwksClient({ jwksUri: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/discovery/v2.0/keys` })
  : null;

function getMsSigningKey(header, callback) {
  msJwks.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    callback(null, key.getPublicKey());
  });
}

async function verifyMicrosoftIdToken(idToken) {
  if (!msJwks || !process.env.AZURE_CLIENT_ID) throw new Error('SSO de Microsoft no está configurado (falta AZURE_TENANT_ID/AZURE_CLIENT_ID)');

  const payload = await new Promise((resolve, reject) => {
    jwt.verify(idToken, getMsSigningKey, { audience: process.env.AZURE_CLIENT_ID }, (err, decoded) => {
      if (err) return reject(err);
      resolve(decoded);
    });
  });

  const email = payload.preferred_username || payload.email;
  if (!email) throw new Error('El token de Microsoft no incluye un email');
  return { email, name: payload.name };
}

module.exports = {
  ssoConfig: {
    google: !!process.env.GOOGLE_CLIENT_ID,
    microsoft: !!(process.env.AZURE_TENANT_ID && process.env.AZURE_CLIENT_ID),
    google_client_id: process.env.GOOGLE_CLIENT_ID || null,
    azure_client_id: process.env.AZURE_CLIENT_ID || null,
    azure_tenant_id: process.env.AZURE_TENANT_ID || null,
  },
  verifyGoogleIdToken,
  verifyMicrosoftIdToken,
};
