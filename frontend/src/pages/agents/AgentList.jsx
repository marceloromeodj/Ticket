import React, { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, X, Check, Download, Upload } from 'lucide-react';
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

function ImportResultsModal({ result, onClose }) {
  const { created = [], errors = [], total = 0 } = result;
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-semibold text-gray-900">Resultado de la importación</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {total} filas · {created.length} creados · {errors.length} con error
            </p>
          </div>
          <button onClick={onClose}><X size={18} className="text-gray-400 hover:text-gray-600" /></button>
        </div>
        <div className="p-6 space-y-6 overflow-y-auto">
          {created.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Agentes creados</h3>
              <div className="border border-gray-100 rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 text-left text-gray-500">
                      <th className="px-3 py-2">Fila</th>
                      <th className="px-3 py-2">Nombre</th>
                      <th className="px-3 py-2">Email</th>
                      <th className="px-3 py-2">Rol</th>
                      <th className="px-3 py-2">Contraseña temporal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {created.map(c => (
                      <tr key={c.row}>
                        <td className="px-3 py-2 text-gray-400">{c.row}</td>
                        <td className="px-3 py-2">{c.name}</td>
                        <td className="px-3 py-2">{c.email}</td>
                        <td className="px-3 py-2 capitalize">{c.role}</td>
                        <td className="px-3 py-2 font-mono">{c.temp_password || <span className="text-gray-400">(la del CSV)</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-amber-600 mt-2">
                Guardá estas contraseñas temporales ahora — no se muestran de nuevo. Pedile a cada agente que la cambie al ingresar.
              </p>
            </div>
          )}
          {errors.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-red-600 mb-2">Filas con error</h3>
              <div className="border border-red-100 rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-red-50 text-left text-red-600">
                      <th className="px-3 py-2">Fila</th>
                      <th className="px-3 py-2">Email</th>
                      <th className="px-3 py-2">Motivo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-red-50">
                    {errors.map((e, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 text-gray-400">{e.row}</td>
                        <td className="px-3 py-2">{e.email || '—'}</td>
                        <td className="px-3 py-2 text-red-600">{e.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
        <div className="flex justify-end px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="btn-primary">Cerrar</button>
        </div>
      </div>
    </div>
  );
}

export default function AgentList() {
  const [modal, setModal] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const fileInputRef = useRef(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['agents'],
    queryFn: () => api.get('/agents', { params: { limit: 100 } }).then(r => r.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/agents/${id}`),
    onSuccess: () => { queryClient.invalidateQueries(['agents']); toast.success('Agente eliminado'); },
  });

  const importMutation = useMutation({
    mutationFn: (file) => {
      const fd = new FormData();
      fd.append('file', file);
      return api.post('/agents/import', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries(['agents']);
      setImportResult(res.data);
      const { created = [], errors = [] } = res.data;
      if (created.length > 0) toast.success(`${created.length} agente(s) importado(s)`);
      if (errors.length > 0 && created.length === 0) toast.error('No se pudo importar ninguna fila');
    },
    onError: e => toast.error(e.response?.data?.error || 'Error al importar el CSV'),
  });

  const handleDownloadTemplate = async () => {
    try {
      const res = await api.get('/agents/csv-template', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'plantilla_agentes.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('No se pudo descargar la plantilla');
    }
  };

  const handleFileSelected = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite volver a elegir el mismo archivo
    if (file) importMutation.mutate(file);
  };

  const agents = data?.agents || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Agentes</h1>
        <div className="flex items-center gap-2">
          <button onClick={handleDownloadTemplate} className="btn-ghost">
            <Download size={16} /> Descargar modelo CSV
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importMutation.isLoading}
            className="btn-ghost"
          >
            <Upload size={16} /> {importMutation.isLoading ? 'Importando...' : 'Importar CSV'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            hidden
            onChange={handleFileSelected}
          />
          <button onClick={() => setModal({})} className="btn-primary">
            <Plus size={16} /> Nuevo Agente
          </button>
        </div>
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
      {importResult && <ImportResultsModal result={importResult} onClose={() => setImportResult(null)} />}
    </div>
  );
}
