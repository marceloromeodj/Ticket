const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Almacenamiento temporal en disco
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, '/app/uploads/tmp');
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const allowedMimeTypes = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain', 'text/csv',
  'application/zip', 'application/x-rar-compressed',
  'video/mp4', 'audio/mpeg',
];

const fileFilter = (req, file, cb) => {
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Tipo de archivo no permitido: ${file.mimetype}`), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
});

// ─── Verificación de firma binaria (magic bytes) ──────────────────
// El mimetype declarado por el cliente en fileFilter es falsificable.
// Una vez que multer escribió el archivo en disco, verificamos que su
// contenido real corresponda a un tipo permitido antes de continuar.
const SIGNATURES = [
  { mime: 'image/jpeg', bytes: [0xFF, 0xD8, 0xFF] },
  { mime: 'image/png',  bytes: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A] },
  { mime: 'image/gif',  bytes: [0x47, 0x49, 0x46, 0x38] },
  { mime: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46] },
  { mime: 'video/mp4',  bytes: [0x66, 0x74, 0x79, 0x70], offset: 4 },
  { mime: 'audio/mpeg', bytes: [0xFF, 0xFB] },
  { mime: 'audio/mpeg', bytes: [0x49, 0x44, 0x33] }, // ID3
];
// image/webp (RIFF....WEBP), zip-based (docx/xlsx/zip) y rar comparten
// firma de contenedor genérica: se validan por prefijo aparte.
const CONTAINER_SIGNATURES = {
  'image/webp': { bytes: [0x52, 0x49, 0x46, 0x46] }, // RIFF
  'application/zip': { bytes: [0x50, 0x4B, 0x03, 0x04] },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { bytes: [0x50, 0x4B, 0x03, 0x04] },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { bytes: [0x50, 0x4B, 0x03, 0x04] },
  'application/x-rar-compressed': { bytes: [0x52, 0x61, 0x72, 0x21] },
  'application/msword': { bytes: [0xD0, 0xCF, 0x11, 0xE0] }, // OLE (doc/xls legacy)
  'application/vnd.ms-excel': { bytes: [0xD0, 0xCF, 0x11, 0xE0] },
};
// Sin firma binaria fiable (texto plano): se dejan pasar sin chequeo de bytes.
const NO_SIGNATURE_CHECK = new Set(['text/plain', 'text/csv']);

function matchesSignature(buffer, sig) {
  const offset = sig.offset || 0;
  return sig.bytes.every((b, i) => buffer[offset + i] === b);
}

function isValidSignature(buffer, mimetype) {
  if (NO_SIGNATURE_CHECK.has(mimetype)) return true;

  const direct = SIGNATURES.filter(s => s.mime === mimetype);
  if (direct.some(s => matchesSignature(buffer, s))) return true;

  const container = CONTAINER_SIGNATURES[mimetype];
  if (container && matchesSignature(buffer, container)) return true;

  return false;
}

function verifyFileSignatures(req, res, next) {
  const files = req.files || (req.file ? [req.file] : []);
  if (files.length === 0) return next();

  try {
    for (const file of files) {
      const fd = fs.openSync(file.path, 'r');
      const buffer = Buffer.alloc(16);
      fs.readSync(fd, buffer, 0, 16, 0);
      fs.closeSync(fd);

      if (!isValidSignature(buffer, file.mimetype)) {
        // Limpiar todos los temporales de esta subida antes de rechazar
        files.forEach(f => fs.unlink(f.path, () => {}));
        return res.status(400).json({
          error: `El contenido del archivo "${file.originalname}" no coincide con su tipo declarado (${file.mimetype}).`,
        });
      }
    }
    next();
  } catch (err) {
    files.forEach(f => fs.unlink(f.path, () => {}));
    next(err);
  }
}

module.exports = { upload, verifyFileSignatures };
