const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

let io;

function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost',
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Middleware de autenticación para sockets
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) return next(new Error('Sin token de autenticación'));

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded;
      next();
    } catch {
      // Permitir portal de clientes sin auth
      if (socket.handshake.query?.visitor === 'true') {
        socket.user = { id: 'visitor_' + Date.now(), role: 'visitor' };
        return next();
      }
      next(new Error('Token inválido'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.user;
    console.log(`[Socket] Conectado: ${user.id} (${user.role})`);

    // Unirse a rooms según rol
    if (user.company_id) socket.join(`company:${user.company_id}`);
    if (user.branch_id)  socket.join(`branch:${user.branch_id}`);
    socket.join(`user:${user.id}`);

    // Unirse a un ticket específico
    socket.on('join:ticket', (ticketId) => {
      socket.join(`ticket:${ticketId}`);
    });

    socket.on('leave:ticket', (ticketId) => {
      socket.leave(`ticket:${ticketId}`);
    });

    // Escritura en tiempo real
    socket.on('typing:start', ({ ticketId }) => {
      socket.to(`ticket:${ticketId}`).emit('typing:start', { userId: user.id, userName: user.name });
    });

    socket.on('typing:stop', ({ ticketId }) => {
      socket.to(`ticket:${ticketId}`).emit('typing:stop', { userId: user.id });
    });

    // Chat en vivo - visitante
    socket.on('chat:join', ({ sessionId }) => {
      socket.join(`chat:${sessionId}`);
    });

    socket.on('chat:message', (data) => {
      io.to(`chat:${data.sessionId}`).emit('chat:message', {
        ...data,
        userId: user.id,
        userName: user.name || 'Visitante',
        timestamp: new Date(),
      });
    });

    socket.on('disconnect', () => {
      console.log(`[Socket] Desconectado: ${user.id}`);
    });
  });

  return io;
}

function getIO() {
  if (!io) throw new Error('Socket.io no inicializado');
  return io;
}

// Emitir a una empresa completa
function emitToCompany(companyId, event, data) {
  getIO().to(`company:${companyId}`).emit(event, data);
}

// Emitir a una sucursal
function emitToBranch(branchId, event, data) {
  getIO().to(`branch:${branchId}`).emit(event, data);
}

// Emitir a un usuario específico
function emitToUser(userId, event, data) {
  getIO().to(`user:${userId}`).emit(event, data);
}

// Emitir a todos en un ticket
function emitToTicket(ticketId, event, data) {
  getIO().to(`ticket:${ticketId}`).emit(event, data);
}

module.exports = { initSocket, getIO, emitToCompany, emitToBranch, emitToUser, emitToTicket };
