import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, X, Check } from 'lucide-react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';

const ROLES = ['admin', 'supervisor', 'agent'];
const ROLE_LABELS = { admin: 'Admin', supervisor: 'Supervisor', agent: 'Agente' };
const AVAIL_COLORS = { online: 'bg-green-400', busy: 'bg-amber-400', offline: 'bg-gray-300' };

function AgentModal({ agent, onClose }) {
  const queryClient = useQueryClient();
  const isEdit = !!agent?.id;
  const [form, setForm] = useState({
    name: agent?.name || '',
    email: agent?.email || '',
    password: '',
    role: agent?.role || 'agent',
    phone: agent?.phone || '',
    branch_id: agent?.branch_id || '',
  });

  const { data: branches = [] } = useQuery({
    queryKey: ['branches-list'],
    queryFn: () => api.get('/branches').then(r => r.data?.branches || r.data || []),
  });

  const mutation = useMutation({
    mutationFn: (data) => isEdit ? api.put(`/agents/${agent.id}`, data) : api.post('/agents', data),
    onSuccess: () => {
      queryClient.invalidateQueries(['agents']);
      toast.success(isEdit ? 'Agente actualizado' : 'Agente creado');
      onClose();
    },
    onError: e => toast.error(e.response?.data?.error || 'Error'),
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">{isEdit ? 'Editar agente' : 'Nuevo agente'}</h2>
          <button onClick={onClose}><X size={18} className="text-gray-400 hover:text-gray-600" /></button>
        </div>
        <form onSubmit={e => { e.preventDefault(); mutation.mutate(form); }} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Nombre *</label>
              <input required className="input" value={form.name} onChange={e => set('name', e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="label">Email *</label>
              <input required type="email" className="input" value={form.email} onChange={e => set('email', e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="label">{isEdit ? 'Nueva contraseña (dejar vacío para no cambiar)' : 'Contraseña *'}</label>
              <input
                type="password"
                required={!isEdit}
                className="input"
                value={form.password}
                onChange={e => set('password', e.target.value)}
              />
            </div>
            <div>
              <label className="label">Rol</label>
              <select className="input" value={form.role} onChange={e => set('role', e.target.value)}>
                {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Sucursal</label>
              <select className="input" value={form.branch_id} onChange={e => set('branch_id', e.target.value)}>
                <option value="">Todas</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="label">Teléfono</label>
              <input className="input" value={form.phone} onChange={e => set('phone', e.target.value)} />
            </div>
          </div>
          <div className="flex gap-3 justify-end pt-2">
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

export default function AgentList() {
  const [modal, setModal] = useState(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['agents'],
    queryFn: () => api.get('/agents', { params: { limit: 100 } }).then(r => r.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/agents/${id}`),
    onSuccess: () => { queryClient.invalidateQueries(['agents']); toast.success('Agente eliminado'); },
  });

  const agents = data?.agents || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Agentes</h1>
        <button onClick={() => setModal({})} className="btn-primary">
          <Plus size={16} /> Nuevo Agente
        </button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100 text-left">
              <th className="px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Agente</th>
              <th className="px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Rol</th>
              <th className="px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Sucursal</th>
              <th className="px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Estado</th>
              <th className="px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Activo</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading && <tr><td colSpan={6} className="py-10 text-center text-gray-400">Cargando...</td></tr>}
            {agents.map(a => (
              <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-9 h-9 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-sm font-bold">
                        {a.name?.charAt(0)}
                      </div>
                      <span className={clsx('absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white', AVAIL_COLORS[a.availability] || 'bg-gray-300')} />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{a.name}</p>
                      <p className="text-xs text-gray-400">{a.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="badge badge-pending capitalize">{ROLE_LABELS[a.role] || a.role}</span>
                </td>
                <td className="px-4 py-3 text-gray-600 text-xs">{a.branch?.name || '—'}</td>
                <td className="px-4 py-3">
                  <span className="capitalize text-xs text-gray-500">{a.availability}</span>
                </td>
                <td className="px-4 py-3">
                  {a.active
                    ? <Check size={16} className="text-green-500" />
                    : <X size={16} className="text-gray-300" />}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 justify-end">
                    <button onClick={() => setModal(a)} className="btn-ghost p-1.5">
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => { if (confirm('¿Eliminar agente?')) deleteMutation.mutate(a.id); }}
                      className="btn-ghost p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal !== null && <AgentModal agent={modal} onClose={() => setModal(null)} />}
    </div>
  );
}
