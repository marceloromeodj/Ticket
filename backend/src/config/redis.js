const { createClient } = require('redis');

let client;

async function initRedis() {
  client = createClient({
    socket: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT) || 6379,
    },
    password: process.env.REDIS_PASSWORD || undefined,
    retry_strategy: (options) => {
      if (options.attempt > 10) return undefined;
      return Math.min(options.attempt * 100, 3000);
    },
  });

  client.on('error', (err) => console.error('[Redis] Error:', err));
  client.on('reconnecting', () => console.log('[Redis] Reconectando...'));

  await client.connect();
  return client;
}

function getRedis() {
  if (!client) throw new Error('Redis no inicializado');
  return client;
}

async function setCache(key, value, ttlSeconds = 300) {
  await client.setEx(key, ttlSeconds, JSON.stringify(value));
}

async function getCache(key) {
  const data = await client.get(key);
  return data ? JSON.parse(data) : null;
}

async function delCache(key) {
  await client.del(key);
}

async function delPattern(pattern) {
  const keys = await client.keys(pattern);
  if (keys.length > 0) await client.del(keys);
}

module.exports = { initRedis, getRedis, setCache, getCache, delCache, delPattern };
