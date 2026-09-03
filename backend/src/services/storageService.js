const Minio = require('minio');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

let minioClient;

function getMinioClient() {
  if (!minioClient) {
    if (!process.env.MINIO_ACCESS_KEY || !process.env.MINIO_SECRET_KEY) {
      throw new Error('MINIO_ACCESS_KEY / MINIO_SECRET_KEY no configuradas');
    }
    minioClient = new Minio.Client({
      endPoint:  process.env.MINIO_ENDPOINT || 'localhost',
      port:      parseInt(process.env.MINIO_PORT) || 9000,
      useSSL:    process.env.MINIO_USE_SSL === 'true',
      accessKey: process.env.MINIO_ACCESS_KEY,
      secretKey: process.env.MINIO_SECRET_KEY,
    });
  }
  return minioClient;
}

const BUCKET = process.env.MINIO_BUCKET || 'helpdesk-files';

const storageService = {
  async ensureBucket() {
    const client = getMinioClient();
    const exists = await client.bucketExists(BUCKET);
    if (!exists) {
      await client.makeBucket(BUCKET, 'us-east-1');
      // Bucket privado: los adjuntos pertenecen a empresas distintas y
      // solo deben ser accesibles vía URL firmada, generada después de
      // verificar que el ticket pertenece a la empresa del usuario.
    }
  },

  async upload(file) {
    await this.ensureBucket();
    const client   = getMinioClient();
    const ext      = path.extname(file.originalname || file.filename);
    const filename = `${uuidv4()}${ext}`;
    const filePath = `tickets/${new Date().getFullYear()}/${filename}`;

    await client.fPutObject(BUCKET, filePath, file.path, {
      'Content-Type': file.mimetype,
    });

    // Limpiar archivo temporal
    fs.unlink(file.path, () => {});

    return {
      filename,
      path: filePath,
      url: null, // se resuelve bajo demanda con getPresignedUrl tras validar permisos
    };
  },

  async delete(storagePath) {
    const client = getMinioClient();
    await client.removeObject(BUCKET, storagePath);
  },

  async getPresignedUrl(storagePath, expirySeconds = 900) {
    if (!storagePath) return null;
    const client = getMinioClient();
    return client.presignedGetObject(BUCKET, storagePath, expirySeconds);
  },
};

module.exports = { storageService };
