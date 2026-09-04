import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../api/axios';
import { es } from 'date-fns/locale';
import { safeFormat } from '../../utils/safeDate';
import { clsx } from 'clsx';

const ACTION_COLORS = {
  create: 'bg-green-100 text-green-700', update: 'bg-blue-100 text-blue-700',
  delete: 'bg-red-100 text-red-700', deactivate: 'bg-red-100 text-red-700',
  login: 'bg-gray-100 text-gray-600', login_failed: 'bg-red-100 text-red-700',
  approve: 'bg-green-100 text-green-700', reject: 'bg-red-100 text-red-700',
  status_change: 'bg-amber-100 text-amber-700',
};

export default function AuditLogPage() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ entity_type: '', action: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['audit-log', page, filters],
    queryFn: () => api.get('/audit', { params: { page, ...filters } }).then(r => r.data),
  });

  const logs = data?.data || [];
  const meta = data?.meta || { pages: 0, total: 0 };

  const set = (k, v) => { setFilters(f => ({ ...f, [k]: v })); setPage(1); };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Auditoría</h1>
        <p className="text-sm text-gray-500">Quién hizo qué, cuándo y desde dónde — {meta.total || 0} eventos registrados</p>
      </div>

      <div className="card p-3 flex flex-wrap gap-3">
        <select className="input h-9 text-sm w-auto" value={filters.entity_type} onChange={e => set('entity_type', e.target.value)}>
          <option value="">Todas las entidades</option>
          {['Ticket', 'User', 'Company', 'Asset', 'Problem', 'ChangeRequest'].map(e => <option key={e} value={e}>{e}</option>)}
        </select>
        <select className="input h-9 text-sm w-auto" value={filters.action} onChange={e => set('action', e.target.value)}>
          <option value="">Todas las acciones</option>
          {['create', 'update', 'delete', 'deactivate', 'login', 'login_failed', 'approve', 'reject', 'status_change'].map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-left">
                <th className="px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Fecha</th>
                <th className="px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Usuario</th>
                <th className="px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Acción</th>
                <th className="px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Entidad</th>
                <th className="px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading && <tr><td colSpan={5} className="py-10 text-center text-gray-400">Cargando...</td></tr>}
              {!isLoading && logs.length === 0 && <tr><td colSpan={5} className="py-10 text-center text-gray-400">Sin eventos</td></tr>}
              {logs.map(log => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                    {safeFormat(log.created_at, "d MMM yyyy HH:mm:ss", { locale: es })}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-700">{log.user?.name || log.user_name || 'Sistema'}</td>
                  <td className="px-4 py-3">
                    <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', ACTION_COLORS[log.action] || 'bg-gray-100 text-gray-600')}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">{log.entity_type} {log.entity_id ? `#${log.entity_id.slice(0, 8)}` : ''}</td>
                  <td className="px-4 py-3 text-xs text-gray-400 font-mono">{log.ip_address || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {meta.pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-500">Página {page} de {meta.pages}</p>
            <div className="flex gap-1">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="btn-ghost h-7 text-xs disabled:opacity-40">Anterior</button>
              <button disabled={page >= meta.pages} onClick={() => setPage(p => p + 1)} className="btn-ghost h-7 text-xs disabled:opacity-40">Siguiente</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
