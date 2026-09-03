import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Filter, Search, ChevronDown, ChevronUp, RefreshCw, Trash2, CheckSquare } from 'lucide-react';
import api from '../../api/axios';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';

const STATUS_COLORS = {
  open: 'badge-open', pending: 'badge-pending',
  waiting_customer: 'badge-waiting', resolved: 'badge-resolved', closed: 'badge-closed',
};
const STATUS_LABELS = {
  open: 'Abierto', pending: 'Pendiente',
  waiting_customer: 'Esperando cliente', resolved: 'Resuelto', closed: 'Cerrado',
};
const PRIORITY_COLORS = {
  low: 'badge-low', medium: 'badge-medium', high: 'badge-high', urgent: 'badge-urgent',
};
const PRIORITY_LABELS = { low: 'Baja', medium: 'Media', high: 'Alta', urgent: 'Urgente' };

function Badge({ type, value, map, colorMap }) {
  return (
    <span className={clsx('badge', colorMap[value])}>
      {map[value] || value}
    </span>
  );
}

export default function TicketList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selected, setSelected] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const queryClient = useQueryClient();

  const filters = {
    status: searchParams.get('status') || '',
    priority: searchParams.get('priority') || '',
    search: searchParams.get('search') || '',
    page: parseInt(searchParams.get('page') || '1'),
    sort: searchParams.get('sort') || 'created_at',
    order: searchParams.get('order') || 'DESC',
  };

  const setFilter = (key, val) => {
    const p = new URLSearchParams(searchParams);
    if (val) p.set(key, val); else p.delete(key);
    if (key !== 'page') p.set('page', '1');
    setSearchParams(p);
    setSelected([]);
  };

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['tickets', Object.fromEntries(searchParams)],
    queryFn: () => api.get('/tickets', { params: Object.fromEntries(searchParams) }).then(r => r.data),
    keepPreviousData: true,
  });

  const bulkMutation = useMutation({
    mutationFn: ({ ids, updates }) => api.post('/tickets/bulk', { ids, updates }),
    onSuccess: () => {
      queryClient.invalidateQueries(['tickets']);
      setSelected([]);
      toast.success('Tickets actualizados');
    },
  });

  const tickets = data?.tickets || [];
  const total = data?.total || 0;
  const pages = Math.ceil(total / (data?.limit || 25));

  const toggleSelect = (id) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  const toggleAll = () => setSelected(selected.length === tickets.length ? [] : tickets.map(t => t.id));

  const sortToggle = (col) => {
    if (filters.sort === col) {
      setFilter('order', filters.order === 'ASC' ? 'DESC' : 'ASC');
    } else {
      const p = new URLSearchParams(searchParams);
      p.set('sort', col); p.set('order', 'DESC'); p.set('page', '1');
      setSearchParams(p);
    }
  };

  const SortIcon = ({ col }) => {
    if (filters.sort !== col) return null;
    return filters.order === 'ASC' ? <ChevronUp size={12} /> : <ChevronDown size={12} />;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Tickets</h1>
        <Link to="/tickets/new" className="btn-primary">
          <Plus size={16} /> Nuevo Ticket
        </Link>
      </div>

      {/* Toolbar */}
      <div className="card p-3 flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            placeholder="Buscar tickets..."
            className="input pl-8 h-8 text-sm"
            defaultValue={filters.search}
            onKeyDown={e => e.key === 'Enter' && setFilter('search', e.target.value)}
          />
        </div>

        {/* Quick status filters */}
        <div className="flex gap-1">
          {['', 'open', 'pending', 'resolved', 'closed'].map(s => (
            <button
              key={s}
              onClick={() => setFilter('status', s)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                filters.status === s
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
            >
              {s ? STATUS_LABELS[s] : 'Todos'}
            </button>
          ))}
        </div>

        <button
          onClick={() => setShowFilters(v => !v)}
          className={clsx('btn-ghost h-8 text-sm', showFilters && 'bg-gray-100')}
        >
          <Filter size={14} /> Filtros
        </button>

        <button onClick={() => refetch()} className="btn-ghost h-8 text-sm">
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Expanded filters */}
      {showFilters && (
        <div className="card p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="label text-xs">Prioridad</label>
            <select className="input h-8 text-sm" value={filters.priority} onChange={e => setFilter('priority', e.target.value)}>
              <option value="">Todas</option>
              {Object.entries(PRIORITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="label text-xs">Estado</label>
            <select className="input h-8 text-sm" value={filters.status} onChange={e => setFilter('status', e.target.value)}>
              <option value="">Todos</option>
              {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="label text-xs">Ordenar por</label>
            <select className="input h-8 text-sm" value={filters.sort} onChange={e => setFilter('sort', e.target.value)}>
              <option value="created_at">Fecha creación</option>
              <option value="updated_at">Última actualización</option>
              <option value="priority">Prioridad</option>
              <option value="status">Estado</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => { setSearchParams({}); setSelected([]); }}
              className="btn-ghost h-8 text-sm w-full justify-center"
            >
              Limpiar filtros
            </button>
          </div>
        </div>
      )}

      {/* Bulk actions */}
      {selected.length > 0 && (
        <div className="card p-3 flex items-center gap-3 bg-primary-50 border border-primary-200">
          <CheckSquare size={16} className="text-primary-600" />
          <span className="text-sm font-medium text-primary-700">{selected.length} seleccionados</span>
          <div className="flex gap-2 ml-auto">
            {[['open','Abrir'],['resolved','Resolver'],['closed','Cerrar']].map(([s, label]) => (
              <button
                key={s}
                onClick={() => bulkMutation.mutate({ ids: selected, updates: { status: s } })}
                className="btn-ghost h-7 text-xs"
              >
                {label}
              </button>
            ))}
            <button
              onClick={() => bulkMutation.mutate({ ids: selected, updates: { spam: true } })}
              className="btn-danger h-7 text-xs"
            >
              <Trash2 size={12} /> Marcar spam
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-left">
                <th className="pl-4 py-3 w-8">
                  <input
                    type="checkbox"
                    checked={selected.length === tickets.length && tickets.length > 0}
                    onChange={toggleAll}
                    className="rounded"
                  />
                </th>
                <th className="py-3 px-2 font-medium text-gray-500 text-xs uppercase tracking-wide w-20">
                  <button className="flex items-center gap-1" onClick={() => sortToggle('ticket_number')}>
                    # <SortIcon col="ticket_number" />
                  </button>
                </th>
                <th className="py-3 px-2 font-medium text-gray-500 text-xs uppercase tracking-wide">
                  <button className="flex items-center gap-1" onClick={() => sortToggle('subject')}>
                    Asunto <SortIcon col="subject" />
                  </button>
                </th>
                <th className="py-3 px-2 font-medium text-gray-500 text-xs uppercase tracking-wide">Estado</th>
                <th className="py-3 px-2 font-medium text-gray-500 text-xs uppercase tracking-wide">Prioridad</th>
                <th className="py-3 px-2 font-medium text-gray-500 text-xs uppercase tracking-wide">Agente</th>
                <th className="py-3 px-2 font-medium text-gray-500 text-xs uppercase tracking-wide">
                  <button className="flex items-center gap-1" onClick={() => sortToggle('created_at')}>
                    Creado <SortIcon col="created_at" />
                  </button>
                </th>
                <th className="py-3 px-2 font-medium text-gray-500 text-xs uppercase tracking-wide">SLA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading && (
                <tr><td colSpan={8} className="py-12 text-center text-gray-400">Cargando...</td></tr>
              )}
              {!isLoading && tickets.length === 0 && (
                <tr><td colSpan={8} className="py-12 text-center text-gray-400">No hay tickets</td></tr>
              )}
              {tickets.map(ticket => (
                <tr
                  key={ticket.id}
                  className={clsx(
                    'hover:bg-gray-50 transition-colors',
                    selected.includes(ticket.id) && 'bg-primary-50/50'
                  )}
                >
                  <td className="pl-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.includes(ticket.id)}
                      onChange={() => toggleSelect(ticket.id)}
                      className="rounded"
                      onClick={e => e.stopPropagation()}
                    />
                  </td>
                  <td className="py-3 px-2 text-gray-400 font-mono text-xs">
                    #{ticket.ticket_number}
                  </td>
                  <td className="py-3 px-2">
                    <Link
                      to={`/tickets/${ticket.id}`}
                      className="font-medium text-gray-900 hover:text-primary-600 line-clamp-1"
                    >
                      {ticket.subject}
                    </Link>
                    <p className="text-xs text-gray-400 mt-0.5 truncate">
                      {ticket.requester_name || ticket.requester?.name} · {ticket.source}
                    </p>
                  </td>
                  <td className="py-3 px-2">
                    <Badge value={ticket.status} map={STATUS_LABELS} colorMap={STATUS_COLORS} />
                  </td>
                  <td className="py-3 px-2">
                    <Badge value={ticket.priority} map={PRIORITY_LABELS} colorMap={PRIORITY_COLORS} />
                  </td>
                  <td className="py-3 px-2">
                    {ticket.agent ? (
                      <div className="flex items-center gap-1.5">
                        <div className="w-6 h-6 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold">
                          {ticket.agent.name?.charAt(0)}
                        </div>
                        <span className="text-xs text-gray-600">{ticket.agent.name}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">Sin asignar</span>
                    )}
                  </td>
                  <td className="py-3 px-2 text-xs text-gray-500">
                    {ticket.created_at
                      ? format(new Date(ticket.created_at), 'd MMM yy', { locale: es })
                      : '—'}
                  </td>
                  <td className="py-3 px-2">
                    <span className={clsx(
                      'text-xs font-medium',
                      ticket.sla_status === 'breached' && 'text-red-600',
                      ticket.sla_status === 'warning' && 'text-orange-500',
                      ticket.sla_status === 'ok' && 'text-green-600',
                    )}>
                      {ticket.sla_status === 'breached' ? '⚠ Incumplido'
                        : ticket.sla_status === 'warning' ? '⏰ En riesgo'
                        : ticket.sla_status === 'ok' ? '✓ OK' : '—'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-500">
              Mostrando {tickets.length} de {total} tickets
            </p>
            <div className="flex gap-1">
              <button
                disabled={filters.page <= 1}
                onClick={() => setFilter('page', filters.page - 1)}
                className="btn-ghost h-7 text-xs disabled:opacity-40"
              >
                Anterior
              </button>
              {Array.from({ length: Math.min(pages, 7) }, (_, i) => {
                const p = filters.page <= 4 ? i + 1 : filters.page - 3 + i;
                if (p < 1 || p > pages) return null;
                return (
                  <button
                    key={p}
                    onClick={() => setFilter('page', p)}
                    className={clsx(
                      'h-7 w-7 rounded-lg text-xs font-medium',
                      p === filters.page
                        ? 'bg-primary-600 text-white'
                        : 'text-gray-600 hover:bg-gray-100'
                    )}
                  >
                    {p}
                  </button>
                );
              })}
              <button
                disabled={filters.page >= pages}
                onClick={() => setFilter('page', filters.page + 1)}
                className="btn-ghost h-7 text-xs disabled:opacity-40"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
