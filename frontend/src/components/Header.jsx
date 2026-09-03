import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Plus, Search, X } from 'lucide-react';
import { useNotificationStore } from '../store/notificationStore';
import { clsx } from 'clsx';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

export default function Header() {
  const navigate = useNavigate();
  const [showNotifs, setShowNotifs] = useState(false);
  const [search, setSearch] = useState('');
  const { notifications, unread, markRead, markAllRead } = useNotificationStore();

  const handleSearch = (e) => {
    e.preventDefault();
    if (search.trim()) navigate(`/tickets?search=${encodeURIComponent(search)}`);
  };

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4">
      {/* Search */}
      <form onSubmit={handleSearch} className="flex-1 max-w-md">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar tickets, clientes..."
            className="input pl-9 h-9 bg-gray-50"
          />
        </div>
      </form>

      <div className="flex items-center gap-2 ml-auto">
        {/* Nuevo ticket */}
        <button
          onClick={() => navigate('/tickets/new')}
          className="btn-primary h-9 text-sm"
        >
          <Plus size={16} /> Nuevo Ticket
        </button>

        {/* Notificaciones */}
        <div className="relative">
          <button
            onClick={() => setShowNotifs(v => !v)}
            className="relative p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Bell size={20} />
            {unread > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold leading-none">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>

          {showNotifs && (
            <div className="absolute right-0 top-full mt-1 w-80 card shadow-lg z-50 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <span className="font-semibold text-sm">Notificaciones</span>
                <div className="flex items-center gap-2">
                  {unread > 0 && (
                    <button onClick={markAllRead} className="text-xs text-primary-600 hover:underline">
                      Marcar todo leído
                    </button>
                  )}
                  <button onClick={() => setShowNotifs(false)}>
                    <X size={14} className="text-gray-400 hover:text-gray-600" />
                  </button>
                </div>
              </div>
              <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
                {notifications.length === 0 && (
                  <p className="text-center text-sm text-gray-500 py-6">Sin notificaciones</p>
                )}
                {notifications.map(n => (
                  <button
                    key={n.id}
                    onClick={() => {
                      markRead(n.id);
                      if (n.link) navigate(n.link);
                      setShowNotifs(false);
                    }}
                    className={clsx(
                      'w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors',
                      !n.read && 'bg-blue-50/50'
                    )}
                  >
                    <p className={clsx('text-sm font-medium', !n.read ? 'text-gray-900' : 'text-gray-600')}>
                      {n.title}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: es })}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
