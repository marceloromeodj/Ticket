const sanitizeHtml = require('sanitize-html');

/**
 * Sanitiza HTML de origen externo (emails entrantes, WhatsApp, portal)
 * antes de guardarlo. Se usa en la escritura, no solo en la lectura,
 * para que cualquier consumidor futuro (email saliente, exportaciones,
 * etc.) también quede protegido.
 */
function sanitizeMessageHtml(html) {
  if (!html) return html;
  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'span']),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      img: ['src', 'alt', 'width', 'height'],
      '*': ['style'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: { img: ['http', 'https', 'data'] },
    disallowedTagsMode: 'discard',
  });
}

module.exports = { sanitizeMessageHtml };
