require('dotenv').config();
const { validateEnv } = require('./config/validateEnv');
validateEnv();

const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const { sequelize } = require('./models');
const { initSocket } = require('./config/socket');
const { initRedis } = require('./config/redis');
const { startWorkers } = require('./workers');
const { startCronJobs } = require('./workers/cronJobs');
const { buildOriginChecker } = require('./utils/allowedOrigin');

// ─── Routes ─────────────────────────────────────────────────────
const authRoutes       = require('./routes/auth');
const ticketRoutes     = require('./routes/tickets');
const messageRoutes    = require('./routes/messages');
const agentRoutes      = require('./routes/agents');
const companyRoutes    = require('./routes/companies');
const branchRoutes     = require('./routes/branches');
const categoryRoutes   = require('./routes/categories');
const tagRoutes        = require('./routes/tags');
const slaRoutes        = require('./routes/sla');
const automationRoutes = require('./routes/automation');
const knowledgeRoutes  = require('./routes/knowledge');
const cannedRoutes     = require('./routes/canned');
const reportRoutes     = require('./routes/reports');
const settingsRoutes   = require('./routes/settings');
const notifRoutes      = require('./routes/notifications');
const inboxRoutes      = require('./routes/inboxes');
const chatRoutes       = require('./routes/chat');
const webhookRoutes    = require('./routes/webhook');
const portalRoutes     = require('./routes/portal');
const assetRoutes      = require('./routes/assets');
const problemRoutes    = require('./routes/problems');
const changeRoutes     = require('./routes/changes');
const auditRoutes      = require('./routes/audit');
const serviceRoutes    = require('./routes/services');
const maintenanceRoutes = require('./routes/maintenance');
const notificationChannelRoutes = require('./routes/notificationChannels');
const scheduledReportRoutes = require('./routes/scheduledReports');
const vendorRoutes      = require('./routes/vendors');
const contractRoutes    = require('./routes/contracts');
const apiTokenRoutes    = require('./routes/apiTokens');
const assetTypeRoutes   = require('./routes/assetTypes');
const externalRoutes    = require('./routes/external');
const swaggerUi         = require('swagger-ui-express');
const openapiSpec       = require('./config/openapi');

const app    = express();
const server = http.createServer(app);

// Solo confía en el primer proxy (nginx delante del backend). Necesario
// para que req.ip refleje la IP real del cliente (X-Forwarded-For) en vez
// de la IP interna de nginx -- afecta el rate limiting y el log de
// auditoría por IP.
app.set('trust proxy', 1);

// ─── Middlewares globales ────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(compression());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// origin dinámico: además de FRONTEND_URL, acepta cualquier subdominio de
// APP_BASE_DOMAIN (una empresa por subdominio comparte el mismo backend).
const isAllowedOrigin = buildOriginChecker();
app.use(cors({
  origin: (origin, cb) => cb(null, isAllowedOrigin(origin)),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Company-ID', 'X-Branch-ID'],
}));

// Se guarda el body crudo (solo para /webhook) para poder verificar la
// firma HMAC de WhatsApp antes de que express.json() lo parsee.
app.use(express.json({
  limit: '10mb',
  verify: (req, res, buf) => {
    if (req.originalUrl.startsWith('/webhook')) req.rawBody = buf;
  },
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static('/app/uploads'));

// Rate limiting general
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes, intentá más tarde.' },
});
app.use('/api/', limiter);

// Rate limiting específico y más estricto para intentos de login,
// para dificultar ataques de fuerza bruta de contraseñas.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: 'Demasiados intentos de inicio de sesión, intentá más tarde.' },
});
app.use('/api/auth/login', loginLimiter);

// ─── Health check ────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// ─── API Routes ──────────────────────────────────────────────────
const api = '/api';
app.use(`${api}/auth`,         authRoutes);
app.use(`${api}/tickets`,      ticketRoutes);
app.use(`${api}/messages`,     messageRoutes);
app.use(`${api}/agents`,       agentRoutes);
app.use(`${api}/companies`,    companyRoutes);
app.use(`${api}/branches`,     branchRoutes);
app.use(`${api}/categories`,   categoryRoutes);
app.use(`${api}/tags`,         tagRoutes);
app.use(`${api}/sla`,          slaRoutes);
app.use(`${api}/automation`,   automationRoutes);
app.use(`${api}/knowledge`,    knowledgeRoutes);
app.use(`${api}/canned`,       cannedRoutes);
app.use(`${api}/reports`,      reportRoutes);
app.use(`${api}/settings`,     settingsRoutes);
app.use(`${api}/notifications`, notifRoutes);
app.use(`${api}/inboxes`,      inboxRoutes);
app.use(`${api}/chat`,         chatRoutes);
app.use(`${api}/portal`,       portalRoutes);
app.use(`${api}/assets`,       assetRoutes);
app.use(`${api}/problems`,     problemRoutes);
app.use(`${api}/changes`,      changeRoutes);
app.use(`${api}/audit`,        auditRoutes);
app.use(`${api}/services`,     serviceRoutes);
app.use(`${api}/maintenance`,  maintenanceRoutes);
app.use(`${api}/notification-channels`, notificationChannelRoutes);
app.use(`${api}/scheduled-reports`, scheduledReportRoutes);
app.use(`${api}/vendors`,      vendorRoutes);
app.use(`${api}/contracts`,    contractRoutes);
app.use(`${api}/api-tokens`,   apiTokenRoutes);
app.use(`${api}/asset-types`,  assetTypeRoutes);
app.use(`${api}/external`,     externalRoutes);
app.use(`${api}/docs`,         swaggerUi.serve, swaggerUi.setup(openapiSpec));

// WhatsApp & Email webhooks (fuera del prefijo /api)
app.use('/webhook', webhookRoutes);

// ─── Error handler global ────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message, err.stack);
  const status = err.status || 500;
  res.status(status).json({
    error: err.message || 'Error interno del servidor',
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
});

// ─── Startup ─────────────────────────────────────────────────────
async function start() {
  try {
    // Init Redis
    await initRedis();
    console.log('[Redis] Conectado');

    // Init Socket.io
    initSocket(server);
    console.log('[Socket.io] Inicializado');

    // Sync DB (alter:true en dev, false en prod)
    await sequelize.authenticate();
    await sequelize.sync({ alter: process.env.NODE_ENV !== 'production' });
    console.log('[PostgreSQL] Base de datos sincronizada');

    // Seed superadmin si no existe
    const { seedSuperAdmin } = require('./seeders/superAdmin');
    await seedSuperAdmin();

    // Workers & Cron jobs
    startWorkers();
    startCronJobs();
    console.log('[Workers] Iniciados');

    const PORT = process.env.PORT || 3001;
    server.listen(PORT, () => {
      console.log(`[API] Servidor corriendo en puerto ${PORT}`);
    });
  } catch (err) {
    console.error('[FATAL] No se pudo iniciar el servidor:', err);
    process.exit(1);
  }
}

start();
