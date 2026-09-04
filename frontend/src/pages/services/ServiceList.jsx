import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, X } from 'lucide-react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';

const CATEGORY_LABELS = {
  infraestructura: 'Infraestructura', sistemas: 'Sistemas', conectividad: 'Conectividad',
  correo: 'Correo', hardware: 'Hardware', aplicaciones: 'Aplicaciones', otro: 'Otro',
};
const CRITICALITY_LABELS = { low: 'Baja', medium: 'Media', high: 'Alta', critical: 'Crítica' };
const CRITICALITY_COLORS = {
  low: 'bg-gray-100 text-gray-600', medium: 'bg-blue-100 text-blue-700',
  high: 'bg-amber-100 text-amber-700', critical: 'bg-red-100 text-red-700',
};

function ServiceModal({ service, onClose }) {
  const queryClient = useQueryClient();
  const isEdit = !!service?.id;
  const [form, setForm] = useState({
    name: service?.name || '',
    description: service?.description || '',
    category: service?.category || 'otro',
    criticality: service?.criticality || 'medium',
    owner_id: service?.owner_id || '',
    cost: service?.cost || '',
  });

  const { data: agents = [] } = useQuery({
    queryKey: ['agents-list'],
    queryFn: () => api.get('/agents', { params: { limit: 100 } }).then(r => r.data?.agents || []),
  });

  const mutation = useMutation({
    mutationFn: (data) => isEdit ? api.put(`/services/${service.id}`, data) : api.post('/services', data),
    onSuccess: () => { queryClient.invalidateQueries(['services']); toast.success(isEdit ? 'Servicio actualizado' : 'Servicio creado'); onClose(); },
    onError: e => toast.error(e.response?.data?.error || 'Error'),
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">{isEdit ? 'Editar servicio' : 'Nuevo servicio'}</h2>
          <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
        </div>
        <form onSubmit={e => { e.preventDefault(); mutation.mutate(form); }} className="p-6 space-y-4">
          <div>
            <label className="label">Nombre *</label>
            <input required className="input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Correo corporativo" />
          </div>
          <div>
            <label className="label">Descripción</label>
            <textarea className="input" rows={2} value={form.description} onChange={e => set('description', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Categoría</label>
              <select className="input" value={form.category} onChange={e => set('category', e.target.value)}>
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Criticidad</label>
              <select className="input" value={form.criticality} onChange={e => set('criticality', e.target.value)}>
                {Object.entries(CRITICALITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Responsable</label>
              <select className="input" value={form.owner_id} onChange={e => set('owner_id', e.target.value)}>
                <option value="">Sin asignar</option>
                {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Costo mensual</label>
              <input type="number" step="0.01" className="input" value={form.cost} onChange={e => set('cost', e.target.value)} />
            </div>
          </div>
          <div className="flex gap-3 justify-end pt-2 border-t border-gray-100">
            <button type="button" onClick={onClose} className="btn-ghost">Cancelar</button>
            <button type="submit" disabled={mutation.isLoading} className="btn-primary">{mutation.isLoading ? 'Guardando...' : 'Guardar'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ServiceList() {
  const [modal, setModal] = useState(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['services'],
    queryFn: () => api.get('/services').then(r => r.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/services/${id}`),
    onSuccess: () => { queryClient.invalidateQueries(['services']); toast.success('Servicio desactivado'); },
  });

  const services = data?.services || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Catálogo de servicios</h1>
          <p className="text-sm text-gray-500">Servicios de TI que se pueden asociar a un ticket</p>
        </div>
        <button onClick={() => setModal({})} className="btn-primary"><Plus size={16} /> Nuevo Servicio</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {isLoading && <div className="col-span-3 text-center text-gray-400 py-10">Cargando...</div>}
        {!isLoading && services.length === 0 && <div className="col-span-3 text-center text-gray-400 py-10">No hay servicios cargados</div>}
        {services.map(s => (
          <div key={s.id} className="card p-5 space-y-2">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-gray-900">{s.name}</p>
                <p className="text-xs text-gray-400">{CATEGORY_LABELS[s.category]}</p>
              </div>
              <div className="flex gap-1">
                <button onClick={() => setModal(s)} className="btn-ghost p-1.5"><Pencil size={14} /></button>
                <button onClick={() => { if (confirm('¿Desactivar servicio?')) deleteMutation.mutate(s.id); }} className="btn-ghost p-1.5 text-red-400"><Trash2 size={14} /></button>
              </div>
            </div>
            {s.description && <p className="text-sm text-gray-500 line-clamp-2">{s.description}</p>}
            <div className="flex items-center gap-2 pt-2">
              <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', CRITICALITY_COLORS[s.criticality])}>
                {CRITICALITY_LABELS[s.criticality]}
              </span>
              {s.owner && <span className="text-xs text-gray-400">Responsable: {s.owner.name}</span>}
            </div>
          </div>
        ))}
      </div>

      {modal !== null && <ServiceModal service={modal} onClose={() => setModal(null)} />}
    </div>
  );
}
