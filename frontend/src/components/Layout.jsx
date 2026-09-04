import React, { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { io } from 'socket.io-client';
import { useAuthStore } from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';
import Sidebar from './Sidebar';
import Header from './Header';
import ErrorBoundary from './ErrorBoundary';
import toast from 'react-hot-toast';

let socket;

export default function Layout() {
  const { user, token } = useAuthStore();
  const { addNew, fetch: fetchNotifs } = useNotificationStore();
  const location = useLocation();

  // Inicializar notificaciones
  useEffect(() => {
    fetchNotifs();
  }, []);

  // Conectar Socket.io
  useEffect(() => {
    if (!token) return;

    socket = io(import.meta.env.VITE_WS_URL || '', {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => console.log('[Socket] Conectado'));
    socket.on('disconnect', () => console.log('[Socket] Desconectado'));

    socket.on('notification:new', (notif) => {
      addNew(notif);
      toast(notif.title || 'Nueva notificación', { icon: '🔔' });
    });

    socket.on('ticket:created', (ticket) => {
      if (['super_admin','admin','supervisor'].includes(user?.role)) {
        toast(`Nuevo ticket #${ticket.ticket_number}: ${ticket.subject}`, { icon: '🎫', duration: 6000 });
      }
    });

    return () => { socket?.disconnect(); };
  }, [token]);

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-1 overflow-auto p-6">
          <ErrorBoundary key={location.pathname}>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}

export { socket };
