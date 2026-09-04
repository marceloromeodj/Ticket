import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, X, Building2, FileText, AlertTriangle } from 'lucide-react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { safeFormat as format } from '../../utils/safeDate';
import { clsx } from 'clsx';

const TYPE_LABELS = { license: 'Licencia', warranty: 'Garantía', service: 'Servicio', lease: 'Alquiler/Leasing', other: 'Otro' };

function VendorModal({ vendor, onClose }) {
  const queryClient = useQueryClient();
  const isEdit = !!vendor?.id;
  const [form, setForm] = useState({
    name: vendor?.name || '', contact_name: vendor?.contact_name || '',
    contact_email: vendor?.contact_email || '', contact_phone: vendor?.contact_phone || '',
    notes: vendor?.notes || '',
  });

  const mutation = useMutation({
    mutationFn: (data) => isEdit ? api.put(`/vendors/${vendor.id}`, data) : api.post('/vendors', data),
    onSuccess: () => { queryClient.invalidateQueries(['vendors']); toast.success(isEdit ? 'Proveedor actualizado' : 'Proveedor creado'); onClose(); },
    onError: e => toast.error(e.response?.data?.error || 'Error'),
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">{isEdit ? 'Editar proveedor' : 'Nuevo proveedor'}</h2>
          <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
        </div>
        <form onSubmit={e => { e.preventDefault(); mutation.mutate(form); }} className="p-6 space-y-4">
          <div>
            <label className="label">Nombre *</label>
            <input required className="input" value={form.name} onChange={e => set('name', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Contacto</label>
              <input className="input" value={form.contact_name} onChange={e => set('contact_name', e.target.value)} />
            </div>
            <div>
              <label className="label">Teléfono</label>
              <input className="input" value={form.contact_phone} onChange={e => set('contact_phone', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label">Email de contacto</label>
            <input type="email" className="input" value={form.contact_email} onChange={e => set('contact_email', e.target.value)} />
          </div>
          <div>
            <label className="label">Notas</label>
            <textarea className="input" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} />
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

function ContractModal({ contract, onClose }) {
  const queryClient = useQueryClient();
  const isEdit = !!contract?.id;
  const [form, setForm] = useState({
    name: contract?.name || '', type: contract?.type || 'other', vendor_id: contract?.vendor_id || '',
    cost: contract?.cost || '', currency: contract?.currency || 'ARS',
    start_date: contract?.start_date || '', end_date: contract?.end_date || '',
    renewal_alert_days: contract?.renewal_alert_days ?? 30, notes: contract?.notes || '',
  });

  const { data: vendorsData } = useQuery({
    queryKey: ['vendors-list'],
    queryFn: () => api.get('/vendors').then(r => r.data?.vendors || []),
  });

  const mutation = useMutation({
    mutationFn: (data) => isEdit ? api.put(`/contracts/${contract.id}`, data) : api.post('/contracts', data),
    onSuccess: () => { queryClient.invalidateQueries(['contracts']); toast.success(isEdit ? 'Contrato actualizado' : 'Contrato creado'); onClose(); },
    onError: e => toast.error(e.response?.data?.error || 'Error'),
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">{isEdit ? 'Editar contrato/licencia' : 'Nuevo contrato/licencia'}</h2>
          <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
        </div>
        <form onSubmit={e => { e.preventDefault(); mutation.mutate(form); }} className="p-6 space-y-4">
          <div>
            <label className="label">Nombre *</label>
            <input required className="input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Licencia Microsoft 365, Garantía servidor HP..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Tipo</label>
              <select className="input" value={form.type} onChange={e => set('type', e.target.value)}>
                {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Proveedor</label>
              <select className="input" value={form.vendor_id} onChange={e => set('vendor_id', e.target.value)}>
                <option value="">Sin asignar</option>
                {(vendorsData || []).map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Costo</label>
              <input type="number" step="0.01" className="input" value={form.cost} onChange={e => set('cost', e.target.value)} />
            </div>
            <div>
              <label className="label">Moneda</label>
              <input className="input" value={form.currency} onChange={e => set('currency', e.target.value)} placeholder="ARS" />
            </div>
            <div>
              <label className="label">Avisar (días antes)</label>
              <input type="number" min={1} className="input" value={form.renewal_alert_days} onChange={e => set('renewal_alert_days', parseInt(e.target.value) || 30)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Inicio</label>
              <input type="date" className="input" value={form.start_date || ''} onChange={e => set('start_date', e.target.value)} />
            </div>
            <div>
              <label className="label">Vencimiento</label>
              <input type="date" className="input" value={form.end_date || ''} onChange={e => set('end_date', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label">Notas</label>
            <textarea className="input" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} />
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

function VendorsTab() {
  const queryClient = useQueryClient();
  const [modal, setModal] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['vendors'],
    queryFn: () => api.get('/vendors').then(r => r.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/vendors/${id}`),
    onSuccess: () => { queryClient.invalidateQueries(['vendors']); toast.success('Proveedor desactivado'); },
  });

  const vendors = data?.vendors || [];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setModal({})} className="btn-primary"><Plus size={16} /> Nuevo proveedor</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {isLoading && <div className="col-span-2 text-center text-gray-400 py-8">Cargando...</div>}
        {!isLoading && vendors.length === 0 && <div className="col-span-2 text-center text-gray-400 py-8">Sin proveedores cargados</div>}
        {vendors.map(v => (
          <div key={v.id} className="card p-4 flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0"><Building2 size={16} className="text-gray-500" /></div>
              <div>
                <p className="font-medium text-gray-900">{v.name}</p>
                <p className="text-xs text-gray-400">{v.contact_name} {v.contact_email && `· ${v.contact_email}`}</p>
              </div>
            </div>
            <div className="flex gap-1">
              <button onClick={() => setModal(v)} className="btn-ghost p-1.5"><Pencil size={14} /></button>
              <button onClick={() => { if (confirm('¿Desactivar proveedor?')) deleteMutation.mutate(v.id); }} className="btn-ghost p-1.5 text-red-400"><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
      </div>
      {modal !== null && <VendorModal vendor={modal} onClose={() => setModal(null)} />}
    </div>
  );
}

function ContractsTab() {
  const queryClient = useQueryClient();
  const [modal, setModal] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['contracts'],
    queryFn: () => api.get('/contracts').then(r => r.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/contracts/${id}`),
    onSuccess: () => { queryClient.invalidateQueries(['contracts']); toast.success('Contrato desactivado'); },
  });

  const contracts = data?.contracts || [];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setModal({})} className="btn-primary"><Plus size={16} /> Nuevo contrato/licencia</button>
      </div>
      <div className="space-y-3">
        {isLoading && <div className="text-center text-gray-400 py-8">Cargando...</div>}
        {!isLoading && contracts.length === 0 && <div className="text-center text-gray-400 py-8">Sin contratos cargados</div>}
        {contracts.map(c => {
          const expiringSoon = c.end_date && new Date(c.end_date) < new Date(Date.now() + c.renewal_alert_days * 86400000);
          const expired = c.end_date && new Date(c.end_date) < new Date();
          return (
            <div key={c.id} className="card p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0"><FileText size={16} className="text-gray-500" /></div>
                <div>
                  <p className="font-medium text-gray-900 flex items-center gap-2">
                    {c.name}
                    <span className="text-xs font-normal text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{TYPE_LABELS[c.type]}</span>
                  </p>
                  <p className="text-xs text-gray-400">
                    {c.vendor?.name || 'Sin proveedor'} {c.cost && `· ${c.currency} ${c.cost}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {c.end_date && (
                  <span className={clsx('text-xs flex items-center gap-1', expired ? 'text-red-600 font-medium' : expiringSoon ? 'text-amber-600 font-medium' : 'text-gray-500')}>
                    {(expired || expiringSoon) && <AlertTriangle size={12} />}
                    Vence: {format(c.end_date, 'd MMM yyyy')}
                  </span>
                )}
                <button onClick={() => setModal(c)} className="btn-ghost p-1.5"><Pencil size={14} /></button>
                <button onClick={() => { if (confirm('¿Desactivar contrato?')) deleteMutation.mutate(c.id); }} className="btn-ghost p-1.5 text-red-400"><Trash2 size={14} /></button>
              </div>
            </div>
          );
        })}
      </div>
      {modal !== null && <ContractModal contract={modal} onClose={() => setModal(null)} />}
    </div>
  );
}

export default function ContractList() {
  const [tab, setTab] = useState('contracts');

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Contratos y proveedores</h1>
        <p className="text-sm text-gray-500">Licencias, garantías y contratos con alertas de vencimiento</p>
      </div>
      <div className="flex gap-1 border-b border-gray-200">
        {[['contracts', 'Contratos y licencias'], ['vendors', 'Proveedores']].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={clsx(
              'px-4 py-2 text-sm font-medium transition-colors -mb-px border-b-2',
              tab === id ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'contracts' ? <ContractsTab /> : <VendorsTab />}
    </div>
  );
}
