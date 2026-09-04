import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, X, Trash2, Link2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';

const STATUS_LABELS = {
  investigating: 'Investigando', root_cause_identified: 'Causa identificada',
  workaround_available: 'Con workaround', resolved: 'Resuelto', closed: 'Cerrado',
};
const STATUS_COLORS = {
  investigating: 'bg-red-100 text-red-700', root_cause_identified: 'bg-amber-100 text-amber-700',
  workaround_available: 'bg-blue-100 text-blue-700', resolved: 'bg-green-100 text-green-700',
  closed: 'bg-gray-100 text-gray-600',
};
const PRIORITY_LABELS = { low: 'Baja', medium: 'Media', high: 'Alta', urgent: 'Urgente' };

function ProblemModal({ problem, onClose }) {
  const queryClient = useQueryClient();
  const isEdit = !!problem?.id;
  const [form, setForm] = useState({
    title: problem?.title || '',
    description: problem?.description || '',
    priority: problem?.priority || 'medium',
    status: problem?.status || 'investigating',
    root_cause: problem?.root_cause || '',
    workaround: problem?.workaround || '',
    solution: problem?.solution || '',
    agent_id: problem?.agent_id || '',
  });

  const { data: agents = [] } = useQuery({
    queryKey: ['agents-list'],
    queryFn: () => api.get('/agents', { params: { limit: 100 } }).then(r => r.data?.agents || []),
  });

  const mutation = useMutation({
    mutationFn: (data) => isEdit ? api.put(`/problems/${problem.id}`, data) : api.post('/problems', data),
    onSuccess: () => {
      queryClient.invalidateQueries(['problems']);
      toast.success(isEdit ? 'Problema actualizado' : 'Problema creado');
      onClose();
    },
    onError: e => toast.error(e.response?.data?.error || 'Error'),
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl my-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">{isEdit ? 'Editar problema' : 'Nuevo problema'}</h2>
          <button onClick={onClose}><X size={18} className="text-gray-400 hover:text-gray-600" /></button>
        </div>
        <form onSubmit={e => { e.preventDefault(); mutation.mutate(form); }} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          <div>
            <label className="label">Título *</label>
            <input required className="input" value={form.title} onChange={e => set('title', e.target.value)} placeholder="Ej: Caídas intermitentes del servidor de archivos" />
          </div>
          <div>
            <label className="label">Descripción</label>
            <textarea className="input" rows={3} value={form.description} onChange={e => set('description', e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">Prioridad</label>
              <select className="input" value={form.priority} onChange={e => set('priority', e.target.value)}>
                {Object.entries(PRIORITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            {isEdit && (
              <div>
                <label className="label">Estado</label>
                <select className="input" value={form.status} onChange={e => set('status', e.target.value)}>
                  {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="label">Responsable</label>
              <select className="input" value={form.agent_id} onChange={e => set('agent_id', e.target.value)}>
                <option value="">Sin asignar</option>
                {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          </div>
          {isEdit && (
            <>
              <div>
                <label className="label">Causa raíz</label>
                <textarea className="input" rows={2} value={form.root_cause} onChange={e => set('root_cause', e.target.value)} />
              </div>
              <div>
                <label className="label">Workaround (solución temporal)</label>
                <textarea className="input" rows={2} value={form.workaround} onChange={e => set('workaround', e.target.value)} />
              </div>
              <div>
                <label className="label">Solución definitiva</label>
                <textarea className="input" rows={2} value={form.solution} onChange={e => set('solution', e.target.value)} />
              </div>
            </>
          )}
          <div className="flex gap-3 justify-end pt-2 border-t border-gray-100">
            <button type="button" onClick={onClose} className="btn-ghost">Cancelar</button>
            <button type="submit" disabled={mutation.isLoading} className="btn-primary">
              {mutation.isLoading ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ProblemList() {
  const [modal, setModal] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['problems', statusFilter],
    queryFn: () => api.get('/problems', { params: { status: statusFilter } }).then(r => r.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/problems/${id}`),
    onSuccess: () => { queryClient.invalidateQueries(['problems']); toast.success('Problema eliminado'); },
  });

  const problems = data?.problems || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Problemas</h1>
          <p className="text-sm text-gray-500">Incidentes recurrentes agrupados por causa raíz</p>
        </div>
        <button onClick={() => setModal({})} className="btn-primary">
          <Plus size={16} /> Nuevo Problema
        </button>
      </div>

      <div className="flex gap-1">
        {['', ...Object.keys(STATUS_LABELS)].map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={clsx(
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
              statusFilter === s ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            )}
          >
            {s ? STATUS_LABELS[s] : 'Todos'}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {isLoading && <div className="text-center text-gray-400 py-10">Cargando...</div>}
        {!isLoading && problems.length === 0 && <div className="text-center text-gray-400 py-10">No hay problemas registrados</div>}
        {problems.map(p => (
          <div key={p.id} className="card p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-gray-400 font-mono">#{p.problem_number}</span>
                  <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', STATUS_COLORS[p.status])}>
                    {STATUS_LABELS[p.status]}
                  </span>
                  <span className="badge badge-pending text-xs capitalize">{PRIORITY_LABELS[p.priority]}</span>
                </div>
                <button onClick={() => setModal(p)} className="font-medium text-gray-900 hover:text-primary-600 text-left">
                  {p.title}
                </button>
                {p.description && <p className="text-sm text-gray-500 mt-1 line-clamp-2">{p.description}</p>}
                {p.tickets?.length > 0 && (
                  <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                    <Link2 size={12} /> {p.tickets.length} ticket(s) vinculado(s): {' '}
                    {p.tickets.map((t, i) => (
                      <React.Fragment key={t.id}>
                        {i > 0 && ', '}
                        <Link to={`/tickets/${t.id}`} className="text-primary-600 hover:underline">#{t.ticket_number}</Link>
                      </React.Fragment>
                    ))}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {p.agent && <span className="text-xs text-gray-500">{p.agent.name}</span>}
                <button
                  onClick={() => { if (confirm('¿Eliminar problema?')) deleteMutation.mutate(p.id); }}
                  className="btn-ghost p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {modal !== null && <ProblemModal problem={modal} onClose={() => setModal(null)} />}
    </div>
  );
}
