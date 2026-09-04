/**
 * Construye un validador de Origin que acepta FRONTEND_URL (compatibilidad
 * con despliegues de dominio único) y, si está configurado
 * APP_BASE_DOMAIN, cualquier subdominio de ese dominio — necesario para
 * que cada empresa entre por su propia URL (empresa1.dominio.com,
 * empresa2.dominio.com, ...) sin que CORS ni el handshake de Socket.io
 * los rechacen.
 */
function buildOriginChecker() {
  const fallback = process.env.FRONTEND_URL || 'http://localhost';
  const base = process.env.APP_BASE_DOMAIN;

  return function isAllowedOrigin(origin) {
    if (!origin) return true; // sin Origin: curl, health checks, server-to-server
    if (origin === fallback) return true;
    if (!base) return false;

    try {
      const { hostname } = new URL(origin);
      const baseLower = base.toLowerCase();
      return hostname.toLowerCase() === baseLower || hostname.toLowerCase().endsWith('.' + baseLower);
    } catch {
      return false;
    }
  };
}

module.exports = { buildOriginChecker };
