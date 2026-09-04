/**
 * Backup de base de datos (pg_dump) + adjuntos (MinIO) a
 * /app/backups/<fecha>/, con retención configurable. Pensado para
 * correr solo (vía cron, ver workers/cronJobs.js) o a mano:
 *   docker compose exec backend node src/scripts/backup.js
 *
 * El volumen /app/backups debe estar montado en el host (ver
 * docker-compose.yml, servicio backend) para que los backups sobrevivan
 * a que se recree el contenedor -- y conviene copiarlos fuera del
 * servidor periódicamente, esto NO reemplaza un backup off-site.
 */
require('dotenv').config();
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { pipeline } = require('stream/promises');

const BACKUP_ROOT = process.env.BACKUP_DIR || '/app/backups';
const RETENTION_DAYS = parseInt(process.env.BACKUP_RETENTION_DAYS) || 14;

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

async function backupDatabase(destDir) {
  const outFile = path.join(destDir, 'database.sql.gz');
  await new Promise((resolve, reject) => {
    const env = { ...process.env, PGPASSWORD: process.env.DB_PASSWORD };
    const cmd = `pg_dump -h ${process.env.DB_HOST} -p ${process.env.DB_PORT || 5432} -U ${process.env.DB_USER} -d ${process.env.DB_NAME}`;
    const dump = exec(cmd, { env, maxBuffer: 1024 * 1024 * 1024 });
    const gzip = zlib.createGzip();
    const out = fs.createWriteStream(outFile);

    let stderr = '';
    dump.stderr.on('data', (d) => { stderr += d; });
    dump.on('error', reject);
    dump.on('close', (code) => {
      if (code !== 0) return reject(new Error(`pg_dump salió con código ${code}: ${stderr}`));
    });

    pipeline(dump.stdout, gzip, out).then(resolve).catch(reject);
  });
  const { size } = fs.statSync(outFile);
  console.log(`[Backup] Base de datos: ${outFile} (${(size / 1024 / 1024).toFixed(1)} MB)`);
}

async function backupFiles(destDir) {
  const { getMinioClient, BUCKET } = require('../services/storageService');
  const client = getMinioClient();
  const exists = await client.bucketExists(BUCKET).catch(() => false);
  if (!exists) {
    console.log('[Backup] Bucket de MinIO no existe todavía, se omite');
    return;
  }

  const filesDir = path.join(destDir, 'files');
  fs.mkdirSync(filesDir, { recursive: true });

  let count = 0;
  await new Promise((resolve, reject) => {
    const stream = client.listObjectsV2(BUCKET, '', true);
    stream.on('data', (obj) => {
      stream.pause();
      const destPath = path.join(filesDir, obj.name);
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      client.fGetObject(BUCKET, obj.name, destPath)
        .then(() => { count++; stream.resume(); })
        .catch(reject);
    });
    stream.on('end', resolve);
    stream.on('error', reject);
  });
  console.log(`[Backup] Adjuntos: ${count} archivo(s) copiados a ${filesDir}`);
}

function cleanOldBackups() {
  if (!fs.existsSync(BACKUP_ROOT)) return;
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  for (const name of fs.readdirSync(BACKUP_ROOT)) {
    const full = path.join(BACKUP_ROOT, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory() && stat.mtimeMs < cutoff) {
      fs.rmSync(full, { recursive: true, force: true });
      console.log(`[Backup] Eliminado backup viejo: ${name}`);
    }
  }
}

async function runBackup() {
  const destDir = path.join(BACKUP_ROOT, timestamp());
  fs.mkdirSync(destDir, { recursive: true });

  await backupDatabase(destDir);
  await backupFiles(destDir);
  cleanOldBackups();

  console.log(`[Backup] Completado: ${destDir}`);
  return destDir;
}

if (require.main === module) {
  runBackup()
    .then(() => process.exit(0))
    .catch((err) => { console.error('[Backup] Error:', err.message); process.exit(1); });
}

module.exports = { runBackup };
