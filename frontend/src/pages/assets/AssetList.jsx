import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Plus, Pencil, Trash2, X, Search, QrCode } from 'lucide-react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';

const TYPE_LABELS = {
  pc: 'PC', notebook: 'Notebook', server: 'Servidor', vm: 'Máquina virtual',
  printer: 'Impresora', switch: 'Switch', router: 'Router', firewall: 'Firewall',
  ap: 'Access Point', ups: 'UPS', camera: 'Cámara', phone: 'Teléfono', other: 'Otro',
};
const STATUS_LABELS = { active: 'Activo', maintenance: 'Mantenimiento', stored: 'Guardado', retired: 'De baja' };
const STATUS_COLORS = {
  active: 'bg-green-100 text-green-700', maintenance: 'bg-amber-100 text-amber-700',
  stored: 'bg-gray-100 text-gray-600', retired: 'bg-red-100 text-red-700',
};

function AssetModal({ asset, onClose }) {
  const queryClient = useQueryClient();
  const isEdit = !!asset?.id;
  const [form, setForm] = useState({
    asset_tag: asset?.asset_tag || '',
    name: asset?.name || '',
    type: asset?.type || 'pc',
    status: asset?.status || 'active',
    brand: asset?.brand || '',
    model: asset?.model || '',
    serial_number: asset?.serial_number || '',
    ip_address: asset?.ip_address || '',
    mac_address: asset?.mac_address || '',
    os: asset?.os || '',
    owner_id: asset?.owner_id || '',
    branch_id: asset?.branch_id || '',
    location: asset?.location || '',
    vendor: asset?.vendor || '',
    purchase_date: asset?.purchase_date || '',
    warranty_until: asset?.warranty_until || '',
    notes: asset?.notes || '',
  });

  const { data: branches = [] } = useQuery({
    queryKey: ['branches-list'],
    queryFn: () => api.get('/branches').then(r => r.data?.branches || r.data || []),
  });
  const { data: agents = [] } = useQuery({
    queryKey: ['agents-list'],
    queryFn: () => api.get('/agents', { params: { limit: 100 } }).then(r => r.data?.agents || []),
  });

  const mutation = useMutation({
    mutationFn: (data) => isEdit ? api.put(`/assets/${asset.id}`, data) : api.post('/assets', data),
    onSuccess: () => {
      queryClient.invalidateQueries(['assets']);
      toast.success(isEdit ? 'Activo actualizado' : 'Activo creado');
      onClose();
    },
    onError: e => toast.error(e.response?.data?.error || 'Error'),
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">{isEdit ? 'Editar activo' : 'Nuevo activo'}</h2>
          <button onClick={onClose}><X size={18} className="text-gray-400 hover:text-gray-600" /></button>
        </div>
        <form onSubmit={e => { e.preventDefault(); mutation.mutate(form); }} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">Código / etiqueta *</label>
              <input required className="input" value={form.asset_tag} onChange={e => set('asset_tag', e.target.value)} placeholder="AC-0001" />
            </div>
            <div className="col-span-2">
              <label className="label">Nombre *</label>
              <input required className="input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Notebook Recepción" />
            </div>
            <div>
              <label className="label">Tipo</label>
              <select className="input" value={form.type} onChange={e => set('type', e.target.value)}>
                {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Estado</label>
              <select className="input" value={form.status} onChange={e => set('status', e.target.value)}>
                {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Sucursal</label>
              <select className="input" value={form.branch_id} onChange={e => set('branch_id', e.target.value)}>
                <option value="">Sin asignar</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Marca</label>
              <input className="input" value={form.brand} onChange={e => set('brand', e.target.value)} />
            </div>
            <div>
              <label className="label">Modelo</label>
              <input className="input" value={form.model} onChange={e => set('model', e.target.value)} />
            </div>
            <div>
              <label className="label">Nº de serie</label>
              <input className="input" value={form.serial_number} onChange={e => set('serial_number', e.target.value)} />
            </div>
            <div>
              <label className="label">Dirección IP</label>
              <input className="input" value={form.ip_address} onChange={e => set('ip_address', e.target.value)} placeholder="192.168.1.10" />
            </div>
            <div>
              <label className="label">Dirección MAC</label>
              <input className="input" value={form.mac_address} onChange={e => set('mac_address', e.target.value)} />
            </div>
            <div>
              <label className="label">Sistema operativo</label>
              <input className="input" value={form.os} onChange={e => set('os', e.target.value)} />
            </div>
            <div>
              <label className="label">Asignado a</label>
              <select className="input" value={form.owner_id} onChange={e => set('owner_id', e.target.value)}>
                <option value="">Sin asignar</option>
                {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="label">Ubicación</label>
              <input className="input" value={form.location} onChange={e => set('location', e.target.value)} placeholder="Piso 2, oficina 204" />
            </div>
            <div>
              <label className="label">Proveedor</label>
              <input className="input" value={form.vendor} onChange={e => set('vendor', e.target.value)} />
            </div>
            <div>
              <label className="label">Fecha de compra</label>
              <input type="date" className="input" value={form.purchase_date || ''} onChange={e => set('purchase_date', e.target.value)} />
            </div>
            <div>
              <label className="label">Garantía hasta</label>
              <input type="date" className="input" value={form.warranty_until || ''} onChange={e => set('warranty_until', e.target.value)} />
            </div>
            <div className="col-span-3">
              <label className="label">Notas</label>
              <textarea className="input" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} />
            </div>
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

export default function AssetList() {
  const [modal, setModal] = useState(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['assets', search, typeFilter],
    queryFn: () => api.get('/assets', { params: { search, type: typeFilter } }).then(r => r.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/assets/${id}`),
    onSuccess: () => { queryClient.invalidateQueries(['assets']); toast.success('Activo eliminado'); },
  });

  const assets = data?.assets || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Activos (CMDB)</h1>
          <p className="text-sm text-gray-500">Inventario de equipos y su relación con tickets</p>
        </div>
        <button onClick={() => setModal({})} className="btn-primary">
          <Plus size={16} /> Nuevo Activo
        </button>
      </div>

      <div className="card p-3 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-8 h-9 text-sm"
            placeholder="Buscar por nombre, código, serie o IP..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select className="input h-9 text-sm w-auto" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="">Todos los tipos</option>
          {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100 text-left">
              <th className="px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Código</th>
              <th className="px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Nombre</th>
              <th className="px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Tipo</th>
              <th className="px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Sucursal</th>
              <th className="px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Asignado a</th>
              <th className="px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Estado</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading && <tr><td colSpan={7} className="py-10 text-center text-gray-400">Cargando...</td></tr>}
            {!isLoading && assets.length === 0 && <tr><td colSpan={7} className="py-10 text-center text-gray-400">No hay activos cargados</td></tr>}
            {assets.map(a => (
              <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{a.asset_tag}</td>
                <td className="px-4 py-3">
                  <Link to={`/assets/${a.id}`} className="font-medium text-gray-900 hover:text-primary-600">{a.name}</Link>
                  <p className="text-xs text-gray-400">{a.brand} {a.model}</p>
                </td>
                <td className="px-4 py-3 text-xs text-gray-600">{TYPE_LABELS[a.type] || a.type}</td>
                <td className="px-4 py-3 text-xs text-gray-600">{a.branch?.name || '—'}</td>
                <td className="px-4 py-3 text-xs text-gray-600">{a.owner?.name || '—'}</td>
                <td className="px-4 py-3">
                  <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', STATUS_COLORS[a.status])}>
                    {STATUS_LABELS[a.status]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 justify-end">
                    <Link to={`/assets/${a.id}`} className="btn-ghost p-1.5">
                      <QrCode size={14} />
                    </Link>
                    <button onClick={() => setModal(a)} className="btn-ghost p-1.5">
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => { if (confirm('¿Eliminar activo?')) deleteMutation.mutate(a.id); }}
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

      {modal !== null && <AssetModal asset={modal} onClose={() => setModal(null)} />}
    </div>
  );
}
