import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, X, MapPin, Phone, Mail } from 'lucide-react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

function BranchModal({ branch, onClose }) {
  const queryClient = useQueryClient();
  const isEdit = !!branch?.id;
  const [form, setForm] = useState({
    name: branch?.name || '',
    code: branch?.code || '',
    address: branch?.address || '',
    phone: branch?.phone || '',
    email: branch?.email || '',
    timezone: branch?.timezone || 'America/Buenos_Aires',
  });

  const mutation = useMutation({
    mutationFn: (data) => isEdit ? api.put(`/branches/${branch.id}`, data) : api.post('/branches', data),
    onSuccess: () => {
      queryClient.invalidateQueries(['branches']);
      toast.success(isEdit ? 'Sucursal actualizada' : 'Sucursal creada');
      onClose();
    },
    onError: e => toast.error(e.response?.data?.error || 'Error'),
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">{isEdit ? 'Editar sucursal' : 'Nueva sucursal'}</h2>
          <button onClick={onClose}><X size={18} className="text-gray-400 hover:text-gray-600" /></button>
        </div>
        <form onSubmit={e => { e.preventDefault(); mutation.mutate(form); }} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Nombre *</label>
              <input required className="input" value={form.name} onChange={e => set('name', e.target.value)} />
            </div>
            <div>
              <label className="label">Código</label>
              <input className="input" value={form.code} onChange={e => set('code', e.target.value)} placeholder="SUC-001" />
            </div>
            <div>
              <label className="label">Timezone</label>
              <select className="input" value={form.timezone} onChange={e => set('timezone', e.target.value)}>
                {['America/Buenos_Aires','America/Santiago','America/Lima','America/Bogota','America/Mexico_City','Europe/Madrid','UTC'].map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="label">Dirección</label>
              <input className="input" value={form.address} onChange={e => set('address', e.target.value)} />
            </div>
            <div>
              <label className="label">Teléfono</label>
              <input className="input" value={form.phone} onChange={e => set('phone', e.target.value)} />
            </div>
            <div>
              <label className="label">Email</label>
              <input type="email" className="input" value={form.email} onChange={e => set('email', e.target.value)} />
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

export default function BranchList() {
  const [modal, setModal] = useState(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['branches'],
    queryFn: () => api.get('/branches').then(r => r.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/branches/${id}`),
    onSuccess: () => { queryClient.invalidateQueries(['branches']); toast.success('Sucursal eliminada'); },
  });

  const branches = Array.isArray(data) ? data : (data?.branches || []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Sucursales</h1>
        <button onClick={() => setModal({})} className="btn-primary">
          <Plus size={16} /> Nueva Sucursal
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {isLoading && <div className="col-span-3 text-center text-gray-400 py-10">Cargando...</div>}
        {branches.map(b => (
          <div key={b.id} className="card p-5 space-y-3 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-gray-900">{b.name}</p>
                {b.code && <p className="text-xs text-gray-400 font-mono">{b.code}</p>}
              </div>
              <div className="flex gap-1">
                <button onClick={() => setModal(b)} className="btn-ghost p-1.5">
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => { if (confirm('¿Eliminar sucursal?')) deleteMutation.mutate(b.id); }}
                  className="btn-ghost p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            <div className="space-y-1.5 text-xs text-gray-500">
              {b.address && (
                <div className="flex items-start gap-1.5">
                  <MapPin size={12} className="flex-shrink-0 mt-0.5" />
                  <span>{b.address}</span>
                </div>
              )}
              {b.phone && (
                <div className="flex items-center gap-1.5">
                  <Phone size={12} />
                  <span>{b.phone}</span>
                </div>
              )}
              {b.email && (
                <div className="flex items-center gap-1.5">
                  <Mail size={12} />
                  <span>{b.email}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
              <span className={`text-xs flex items-center gap-1 ${b.active ? 'text-green-600' : 'text-gray-400'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${b.active ? 'bg-green-500' : 'bg-gray-300'}`} />
                {b.active ? 'Activa' : 'Inactiva'}
              </span>
              {b.timezone && <span className="text-xs text-gray-400">{b.timezone.split('/')[1]}</span>}
            </div>
          </div>
        ))}
      </div>

      {modal !== null && <BranchModal branch={modal} onClose={() => setModal(null)} />}
    </div>
  );
}
