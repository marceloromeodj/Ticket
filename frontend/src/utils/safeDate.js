import { format as fnsFormat, formatDistanceToNow as fnsFormatDistanceToNow } from 'date-fns';

// date-fns tira una excepción (RangeError: Invalid time value) si la fecha
// es inválida, y como la app no envuelve las páginas en un error boundary,
// una sola fecha rota en los datos puede dejar la pantalla entera en
// blanco. Estas versiones nunca tiran: devuelven un placeholder.
export function safeFormat(date, fmt, options) {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '—';
  try { return fnsFormat(d, fmt, options); } catch { return '—'; }
}

export function safeFormatDistanceToNow(date, options) {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '—';
  try { return fnsFormatDistanceToNow(d, options); } catch { return '—'; }
}
