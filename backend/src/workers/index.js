const Queue = require('bull');
const { getRedis } = require('../config/redis');

let emailQueue;

function createQueue(name) {
  const redisOpts = {
    host:     process.env.REDIS_HOST || 'localhost',
    port:     parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
  };
  return new Queue(name, { redis: redisOpts });
}

async function startWorkers() {
  emailQueue = createQueue('email-sync');

  // Procesar emails cada 5 minutos
  emailQueue.process(async () => {
    const { emailService } = require('../services/emailService');
    await emailService.syncAllInboxes();
  });

  // Encolar sincronización periódica
  await emailQueue.add({}, { repeat: { every: 5 * 60 * 1000 } });

  console.log('[Workers] Cola de email iniciada');
}

function getEmailQueue() { return emailQueue; }

module.exports = { startWorkers, getEmailQueue };
