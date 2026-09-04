/**
 * Resuelve el slug de empresa a partir del subdominio de la URL, para
 * despliegues donde cada empresa entra por su propia URL
 * (ej. empresa1.ticket.ucp.edu.ar). Requiere APP_BASE_DOMAIN definido
 * con el dominio base (ej. ticket.ucp.edu.ar); si no está configurado,
 * o el host no es un subdominio de ese dominio, no hay slug implícito.
 */
function getSubdomainSlug(req) {
  const base = process.env.APP_BASE_DOMAIN;
  if (!base) return null;

  const host = String(req.hostname || '').toLowerCase();
  const baseLower = base.toLowerCase();

  if (host === baseLower) return null; // dominio raíz, sin subdominio
  if (!host.endsWith('.' + baseLower)) return null;

  const slug = host.slice(0, host.length - baseLower.length - 1);
  // Evita falsos positivos con subdominios de infraestructura reservados
  if (!slug || slug.includes('.') || ['www', 'api'].includes(slug)) return null;
  return slug;
}

module.exports = { getSubdomainSlug };
