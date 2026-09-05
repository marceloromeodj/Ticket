import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Settings2 } from 'lucide-react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';

const PRIORITY_COLORS = { low: 'badge-low', medium: 'badge-medium', high: 'badge-high', urgent: 'badge-urgent' };
const PRIORITY_LABELS = { low: 'Baja', medium: 'Media', high: 'Alta', urgent: 'Urgente' };

function TicketCard({ ticket, onDragStart, dragging }) {
  return (
    <Link
      to={`/tickets/${ticket.id}`}
      draggable
      onDragStart={(e) => onDragStart(e, ticket)}
      className={clsx(
        'block bg-white border border-gray-200 rounded-xl p-3 shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing',
        dragging && 'opacity-40'
      )}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-mono text-gray-400">#{ticket.ticket_number}</span>
        <span className={clsx('badge text-[10px] px-1.5 py-0', PRIORITY_COLORS[ticket.priority])}>
          {PRIORITY_LABELS[ticket.priority] || ticket.priority}
        </span>
      </div>
      <p className="text-sm font-medium text-gray-900 line-clamp-2">{ticket.subject}</p>
      <div className="flex items-center justify-between mt-2">
        <span className="text-xs text-gray-400 truncate">{ticket.requester_name || ticket.requester_email || '—'}</span>
        {ticket.agent && (
          <div className="w-5 h-5 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0" title={ticket.agent.name}>
            {ticket.agent.name?.charAt(0)}
          </div>
        )}
      </div>
    </Link>
  );
}

export default function TicketBoard() {
  const queryClient = useQueryClient();
  const [draggedTicket, setDraggedTicket] = useState(null);
  const [dragOverColumn, setDragOverColumn] = useState(null);

  const { data: statusesData, isLoading: loadingStatuses } = useQuery({
    queryKey: ['ticket-statuses'],
    queryFn: () => api.get('/ticket-statuses').then(r => r.data?.statuses || []),
  });

  const { data: ticketsData, isLoading: loadingTickets } = useQuery({
    queryKey: ['tickets-board'],
    queryFn: () => api.get('/tickets', { params: { limit: 500 } }).then(r => r.data),
    refetchInterval: 30000,
  });

  const moveMutation = useMutation({
    mutationFn: ({ id, status }) => api.put(`/tickets/${id}`, { status }),
    onSuccess: () => { queryClient.invalidateQueries(['tickets-board']); },
    onError: (e) => {
      toast.error(e.response?.data?.error || 'No se pudo mover el ticket');
      queryClient.invalidateQueries(['tickets-board']);
    },
  });

  const statuses = statusesData || [];
  const tickets = ticketsData?.data || [];

  const handleDragStart = (e, ticket) => {
    setDraggedTicket(ticket);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = (e, statusKey) => {
    e.preventDefault();
    setDragOverColumn(null);
    if (!draggedTicket || draggedTicket.status === statusKey) { setDraggedTicket(null); return; }
    moveMutation.mutate({ id: draggedTicket.id, status: statusKey });
    setDraggedTicket(null);
  };

  if (loadingStatuses || loadingTickets) {
    return <div className="text-center text-gray-400 py-16">Cargando tablero...</div>;
  }

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tablero de tickets</h1>
          <p className="text-sm text-gray-500">Arrastrá una tarjeta a otra columna para cambiar el estado</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => queryClient.invalidateQueries(['tickets-board'])} className="btn-ghost text-sm">
            <RefreshCw size={14} /> Actualizar
          </button>
          <Link to="/settings?tab=statuses" className="btn-ghost text-sm">
            <Settings2 size={14} /> Configurar estados
          </Link>
        </div>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4 flex-1 min-h-0">
        {statuses.map(status => {
          const columnTickets = tickets.filter(t => t.status === status.key);
          return (
            <div
              key={status.id}
              onDragOver={(e) => { e.preventDefault(); setDragOverColumn(status.key); }}
              onDragLeave={() => setDragOverColumn(null)}
              onDrop={(e) => handleDrop(e, status.key)}
              className={clsx(
                'flex flex-col bg-gray-50 rounded-xl border-2 w-72 flex-shrink-0 transition-colors',
                dragOverColumn === status.key ? 'border-primary-400 bg-primary-50' : 'border-transparent'
              )}
            >
              <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-200">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: status.color }} />
                <span className="font-semibold text-sm text-gray-900">{status.label}</span>
                <span className="text-xs text-gray-400 ml-auto">{columnTickets.length}</span>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[100px]">
                {columnTickets.map(ticket => (
                  <TicketCard key={ticket.id} ticket={ticket} onDragStart={handleDragStart} dragging={draggedTicket?.id === ticket.id} />
                ))}
                {columnTickets.length === 0 && (
                  <p className="text-xs text-gray-300 text-center py-6">Sin tickets</p>
                )}
              </div>
            </div>
          );
        })}
        {statuses.length === 0 && (
          <p className="text-center text-gray-400 py-16 w-full">No hay estados configurados</p>
        )}
      </div>
    </div>
  );
}
