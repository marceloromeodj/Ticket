// Estados de ticket configurables por empresa -- ver models/TicketStatus.js
// para por qué `category` existe. Este servicio es el único lugar que
// debería saber que "resuelto"/"cerrado" son conceptos, no strings fijos:
// SLA, encuesta CSAT y reapertura automática consultan acá en vez de
// comparar contra ['resolved','closed'] directamente.
const DEFAULT_STATUSES = [
  { key: 'open',              label: 'Abierto',            color: '#3b82f6', category: 'open',     position: 0, is_initial: true },
  { key: 'pending',           label: 'Pendiente',          color: '#f59e0b', category: 'open',     position: 1 },
  { key: 'waiting_customer',  label: 'Esperando cliente',  color: '#a855f7', category: 'open',     position: 2 },
  { key: 'resolved',          label: 'Resuelto',           color: '#10b981', category: 'resolved', position: 3 },
  { key: 'closed',            label: 'Cerrado',            color: '#6b7280', category: 'closed',   position: 4 },
];

// Cache corto en memoria: estas listas se consultan en cada creación/
// actualización de ticket y en el cron de SLA cada 10 minutos -- no vale
// la pena pegarle a la base en cada ticket. Se invalida por company_id
// cuando se edita la configuración (ver routes/ticketStatuses.js).
const cache = new Map();
const CACHE_TTL_MS = 60_000;

function invalidateCache(companyId) {
  cache.delete(companyId);
}

async function getStatuses(companyId) {
  const cached = cache.get(companyId);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.statuses;

  const { TicketStatus } = require('../models');
  let statuses = await TicketStatus.findAll({ where: { company_id: companyId }, order: [['position', 'ASC']] });

  if (statuses.length === 0) {
    await TicketStatus.bulkCreate(DEFAULT_STATUSES.map(s => ({ ...s, company_id: companyId })));
    statuses = await TicketStatus.findAll({ where: { company_id: companyId }, order: [['position', 'ASC']] });
  }

  cache.set(companyId, { statuses, at: Date.now() });
  return statuses;
}

async function getKeysByCategory(companyId, categories) {
  const statuses = await getStatuses(companyId);
  return statuses.filter(s => categories.includes(s.category)).map(s => s.key);
}

/** Los estados que "no están terminados" -- reemplaza el viejo NOT IN ('resolved','closed'). */
async function getNonFinalKeys(companyId) {
  return getKeysByCategory(companyId, ['open']);
}

async function getInitialStatusKey(companyId) {
  const statuses = await getStatuses(companyId);
  return statuses.find(s => s.is_initial && s.active)?.key
    || statuses.find(s => s.category === 'open' && s.active)?.key
    || 'open';
}

async function isFinalStatus(companyId, key) {
  const statuses = await getStatuses(companyId);
  const status = statuses.find(s => s.key === key);
  return status ? status.category !== 'open' : false;
}

/** Vacío en allowed_next = sin restricción (compatibilidad con empresas que no configuraron el flujo). */
async function isTransitionAllowed(companyId, fromKey, toKey) {
  if (!fromKey || fromKey === toKey) return true;
  const statuses = await getStatuses(companyId);
  const from = statuses.find(s => s.key === fromKey);
  if (!from || !from.allowed_next || from.allowed_next.length === 0) return true;
  return from.allowed_next.includes(toKey);
}

module.exports = {
  getStatuses, getKeysByCategory, getNonFinalKeys, getInitialStatusKey,
  isFinalStatus, isTransitionAllowed, invalidateCache,
};
