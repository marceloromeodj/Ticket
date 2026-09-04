import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, X, Trash2, Send, Check, XCircle, PlayCircle, CheckCircle2, AlertTriangle, RotateCcw } from 'lucide-react';
import api from '../../api/axios';
import { useAuthStore } from '../../store/authStore';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const STATUS_LABELS = {
  draft: 'Borrador', pending_approval: 'Pendiente de aprobación', approved: 'Aprobado',
  rejected: 'Rechazado', scheduled: 'Programado', in_progress: 'En curso',
  completed: 'Completado', failed: 'Falló', rolled_back: 'Revertido',
};
const STATUS_COLORS = {
  draft: 'bg-gray-100 text-gray-600', pending_approval: 'bg-amber-100 text-amber-700',
  approved: 'bg-blue-100 text-blue-700', rejected: 'bg-red-100 text-red-700',
  scheduled: 'bg-indigo-100 text-indigo-700', in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700', failed: 'bg-red-100 text-red-700',
  rolled_back: 'bg-orange-100 text-orange-700',
};
const RISK_LABELS = { low: 'Bajo', medium: 'Medio', high: 'Alto' };
const TYPE_LABELS = { standard: 'Estándar', normal: 'Normal', emergency: 'Emergencia' };

function ChangeModal({ change, onClose }) {
  const queryClient = useQueryClient();
  const isEdit = !!change?.id;
  const [form, setForm] = useState({
    title: change?.title || '',
    description: change?.description || '',
    change_type: change?.change_type || 'normal',
    risk: change?.risk || 'medium',
    implementation_plan: change?.implementation_plan || '',
    rollback_plan: change?.rollback_plan || '',
    scheduled_start: change?.scheduled_start ? change.scheduled_start.slice(0, 16) : '',
    scheduled_end: change?.scheduled_end ? change.scheduled_end.slice(0, 16) : '',
  });

  const mutation = useMutation({
    mutationFn: (data) => isEdit ? api.put(`/changes/${change.id}`, data) : api.post('/changes', data),
    onSuccess: () => {
      queryClient.invalidateQueries(['changes']);
      toast.success(isEdit ? 'Cambio actualizado' : 'Cambio creado');
      onClose();
    },
    onError: e => toast.error(e.response?.data?.error || 'Error'),
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl my-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">{isEdit ? 'Editar solicitud de cambio' : 'Nueva solicitud de cambio (RFC)'}</h2>
          <button onClick={onClose}><X size={18} className="text-gray-400 hover:text-gray-600" /></button>
        </div>
        <form onSubmit={e => { e.preventDefault(); mutation.mutate(form); }} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          <div>
            <label className="label">Título *</label>
            <input required className="input" value={form.title} onChange={e => set('title', e.target.value)} placeholder="Ej: Actualización de firmware del firewall principal" />
          </div>
          <div>
            <label className="label">Descripción</label>
            <textarea className="input" rows={3} value={form.description} onChange={e => set('description', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Tipo</label>
              <select className="input" value={form.change_type} onChange={e => set('change_type', e.target.value)}>
                {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Riesgo</label>
              <select className="input" value={form.risk} onChange={e => set('risk', e.target.value)}>
                {Object.entries(RISK_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Ventana — inicio</label>
              <input type="datetime-local" className="input" value={form.scheduled_start} onChange={e => set('scheduled_start', e.target.value)} />
            </div>
            <div>
              <label className="label">Ventana — fin</label>
              <input type="datetime-local" className="input" value={form.scheduled_end} onChange={e => set('scheduled_end', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label">Plan de implementación</label>
            <textarea className="input" rows={3} value={form.implementation_plan} onChange={e => set('implementation_plan', e.target.value)} placeholder="Pasos a seguir..." />
          </div>
          <div>
            <label className="label">Plan de reversión (rollback)</label>
            <textarea className="input" rows={3} value={form.rollback_plan} onChange={e => set('rollback_plan', e.target.value)} placeholder="Cómo volver atrás si algo falla..." />
          </div>
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

export default function ChangeList() {
  const [modal, setModal] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const { user } = useAuthStore();
  const isApprover = ['super_admin', 'admin'].includes(user?.role);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['changes', statusFilter],
    queryFn: () => api.get('/changes', { params: { status: statusFilter } }).then(r => r.data),
  });

  const actionMutation = useMutation({
    mutationFn: ({ id, path, body }) => api.post(`/changes/${id}/${path}`, body || {}),
    onSuccess: () => { queryClient.invalidateQueries(['changes']); toast.success('Actualizado'); },
    onError: e => toast.error(e.response?.data?.error || 'Error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/changes/${id}`),
    onSuccess: () => { queryClient.invalidateQueries(['changes']); toast.success('Cambio eliminado'); },
  });

  const changes = data?.changes || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cambios (RFC)</h1>
          <p className="text-sm text-gray-500">Solicitudes de cambio con aprobación y ventana de mantenimiento</p>
        </div>
        <button onClick={() => setModal({})} className="btn-primary">
          <Plus size={16} /> Nueva Solicitud
        </button>
      </div>

      <div className="flex gap-1 flex-wrap">
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
        {!isLoading && changes.length === 0 && <div className="text-center text-gray-400 py-10">No hay solicitudes de cambio</div>}
        {changes.map(c => (
          <div key={c.id} className="card p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-xs text-gray-400 font-mono">#{c.change_number}</span>
                  <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', STATUS_COLORS[c.status])}>{STATUS_LABELS[c.status]}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 capitalize">{TYPE_LABELS[c.change_type]}</span>
                  {c.risk === 'high' && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-600 flex items-center gap-1">
                      <AlertTriangle size={10} /> Riesgo alto
                    </span>
                  )}
                </div>
                <p className="font-medium text-gray-900">{c.title}</p>
                {c.description && <p className="text-sm text-gray-500 mt-1 line-clamp-2">{c.description}</p>}
                <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                  {c.requester && <span>Solicitó: {c.requester.name}</span>}
                  {c.scheduled_start && <span>Ventana: {format(new Date(c.scheduled_start), "d MMM HH:mm", { locale: es })}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {c.status === 'draft' && (
                  <>
                    <button onClick={() => setModal(c)} className="btn-ghost h-8 text-xs">Editar</button>
                    <button onClick={() => actionMutation.mutate({ id: c.id, path: 'submit' })} className="btn-ghost h-8 text-xs text-blue-600">
                      <Send size={12} /> Enviar a aprobación
                    </button>
                  </>
                )}
                {c.status === 'pending_approval' && isApprover && (
                  <>
                    <button onClick={() => actionMutation.mutate({ id: c.id, path: 'approve' })} className="btn-ghost h-8 text-xs text-green-600">
                      <Check size={12} /> Aprobar
                    </button>
                    <button onClick={() => actionMutation.mutate({ id: c.id, path: 'reject' })} className="btn-ghost h-8 text-xs text-red-600">
                      <XCircle size={12} /> Rechazar
                    </button>
                  </>
                )}
                {['approved', 'scheduled'].includes(c.status) && (
                  <button onClick={() => actionMutation.mutate({ id: c.id, path: 'status', body: { status: 'in_progress' } })} className="btn-ghost h-8 text-xs text-blue-600">
                    <PlayCircle size={12} /> Iniciar
                  </button>
                )}
                {c.status === 'in_progress' && (
                  <>
                    <button onClick={() => actionMutation.mutate({ id: c.id, path: 'status', body: { status: 'completed' } })} className="btn-ghost h-8 text-xs text-green-600">
                      <CheckCircle2 size={12} /> Completar
                    </button>
                    <button onClick={() => actionMutation.mutate({ id: c.id, path: 'status', body: { status: 'failed' } })} className="btn-ghost h-8 text-xs text-red-600">
                      Falló
                    </button>
                  </>
                )}
                {c.status === 'failed' && (
                  <button onClick={() => actionMutation.mutate({ id: c.id, path: 'status', body: { status: 'rolled_back' } })} className="btn-ghost h-8 text-xs text-orange-600">
                    <RotateCcw size={12} /> Revertir
                  </button>
                )}
                {c.status === 'rejected' && (
                  <button onClick={() => setModal(c)} className="btn-ghost h-8 text-xs">Editar y reenviar</button>
                )}
                <button
                  onClick={() => { if (confirm('¿Eliminar esta solicitud de cambio?')) deleteMutation.mutate(c.id); }}
                  className="btn-ghost p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {modal !== null && <ChangeModal change={modal} onClose={() => setModal(null)} />}
    </div>
  );
}
