import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, X, Building2, Users, GitBranch, ToggleLeft } from 'lucide-react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';

function CompanyModal({ company, onClose }) {
  const queryClient = useQueryClient();
  const isEdit = !!company?.id;
  const [form, setForm] = useState({
    name: company?.name || '',
    slug: company?.slug || '',
    domain: company?.domain || '',
    primary_color: company?.primary_color || '#6366f1',
    timezone: company?.timezone || 'America/Buenos_Aires',
    language: company?.language || 'es',
    plan: company?.plan || 'starter',
    max_agents: company?.max_agents || 10,
  });

  const mutation = useMutation({
    mutationFn: (data) => isEdit ? api.put(`/companies/${company.id}`, data) : api.post('/companies', data),
    onSuccess: () => {
      queryClient.invalidateQueries(['companies']);
      toast.success(isEdit ? 'Empresa actualizada' : 'Empresa creada');
      onClose();
    },
    onError: e => toast.error(e.response?.data?.error || 'Error'),
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">{isEdit ? 'Editar empresa' : 'Nueva empresa'}</h2>
          <button onClick={onClose}><X size={18} className="text-gray-400 hover:text-gray-600" /></button>
        </div>
        <form onSubmit={e => { e.preventDefault(); mutation.mutate(form); }} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Nombre *</label>
              <input required className="input" value={form.name} onChange={e => set('name', e.target.value)} />
            </div>
            <div>
              <label className="label">Slug (URL) *</label>
              <input
                required
                className="input"
                value={form.slug}
                onChange={e => set('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                placeholder="mi-empresa"
              />
              <p className="text-xs text-gray-400 mt-1">
                Si el login por subdominio está habilitado, esta empresa entra por <span className="font-mono">{form.slug || 'mi-empresa'}.tudominio.com</span>
              </p>
            </div>
            <div>
              <label className="label">Dominio</label>
              <input className="input" value={form.domain} onChange={e => set('domain', e.target.value)} placeholder="empresa.com" />
            </div>
            <div>
              <label className="label">Plan</label>
              <select className="input" value={form.plan} onChange={e => set('plan', e.target.value)}>
                {['free','starter','pro','enterprise'].map(p => <option key={p} value={p} className="capitalize">{p}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Máx. agentes</label>
              <input type="number" min={1} className="input" value={form.max_agents} onChange={e => set('max_agents', parseInt(e.target.value))} />
            </div>
            <div>
              <label className="label">Timezone</label>
              <select className="input" value={form.timezone} onChange={e => set('timezone', e.target.value)}>
                {['America/Buenos_Aires','America/Santiago','America/Lima','America/Bogota','America/Mexico_City','Europe/Madrid','UTC'].map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Color primario</label>
              <div className="flex gap-2">
                <input type="color" value={form.primary_color} onChange={e => set('primary_color', e.target.value)} className="h-9 w-12 rounded border border-gray-200 cursor-pointer" />
                <input className="input flex-1" value={form.primary_color} onChange={e => set('primary_color', e.target.value)} />
              </div>
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

function ModulesModal({ company, onClose }) {
  const queryClient = useQueryClient();
  const [modules, setModules] = useState(company.modules || {});

  const { data: defs = [] } = useQuery({
    queryKey: ['module-definitions'],
    queryFn: () => api.get('/companies/modules/definitions').then(r => r.data?.modules || []),
  });

  const mutation = useMutation({
    mutationFn: () => api.put(`/companies/${company.id}/modules`, modules),
    onSuccess: () => { queryClient.invalidateQueries(['companies']); toast.success('Módulos actualizados'); onClose(); },
    onError: e => toast.error(e.response?.data?.error || 'Error'),
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Módulos — {company.name}</h2>
          <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
        </div>
        <div className="p-6 space-y-1 max-h-96 overflow-y-auto">
          {defs.map(m => (
            <label key={m.key} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-gray-50 cursor-pointer">
              <span className="text-sm text-gray-700">{m.label}</span>
              <input
                type="checkbox"
                className="w-4 h-4 rounded"
                checked={modules[m.key] !== false}
                onChange={e => setModules(mods => ({ ...mods, [m.key]: e.target.checked }))}
              />
            </label>
          ))}
        </div>
        <div className="flex gap-3 justify-end px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="btn-ghost">Cancelar</button>
          <button onClick={() => mutation.mutate()} disabled={mutation.isLoading} className="btn-primary">
            {mutation.isLoading ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CompanyList() {
  const [modal, setModal] = useState(null);
  const [modulesFor, setModulesFor] = useState(null);
  const queryClient = useQueryClient();

  const { data = [], isLoading } = useQuery({
    queryKey: ['companies'],
    queryFn: () => api.get('/companies').then(r => r.data?.companies || r.data || []),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/companies/${id}`),
    onSuccess: () => { queryClient.invalidateQueries(['companies']); toast.success('Empresa eliminada'); },
  });

  const PLAN_COLORS = { free: 'bg-gray-100 text-gray-600', starter: 'bg-blue-100 text-blue-700', pro: 'bg-purple-100 text-purple-700', enterprise: 'bg-amber-100 text-amber-700' };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Empresas</h1>
        <button onClick={() => setModal({})} className="btn-primary">
          <Plus size={16} /> Nueva Empresa
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {isLoading && <div className="col-span-3 text-center text-gray-400 py-10">Cargando...</div>}
        {data.map(c => (
          <div key={c.id} className="card p-5 space-y-3 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold"
                  style={{ backgroundColor: c.primary_color || '#6366f1' }}
                >
                  {c.name?.charAt(0)}
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{c.name}</p>
                  <p className="text-xs text-gray-400">{c.slug}</p>
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => setModulesFor(c)} className="btn-ghost p-1.5" title="Módulos habilitados">
                  <ToggleLeft size={14} />
                </button>
                <button onClick={() => setModal(c)} className="btn-ghost p-1.5">
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => { if (confirm('¿Eliminar empresa? Esta acción no se puede deshacer.')) deleteMutation.mutate(c.id); }}
                  className="btn-ghost p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium capitalize', PLAN_COLORS[c.plan] || PLAN_COLORS.free)}>
                {c.plan}
              </span>
              {c.domain && <span className="text-xs text-gray-400">{c.domain}</span>}
            </div>

            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-100">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-gray-400 mb-1">
                  <Users size={12} />
                  <span className="text-xs">Agentes</span>
                </div>
                <p className="font-semibold text-gray-900 text-sm">{c._count?.users ?? '—'}/{c.max_agents}</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-gray-400 mb-1">
                  <GitBranch size={12} />
                  <span className="text-xs">Sucursales</span>
                </div>
                <p className="font-semibold text-gray-900 text-sm">{c._count?.branches ?? '—'}</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-gray-400 mb-1">
                  <Building2 size={12} />
                  <span className="text-xs">Tickets</span>
                </div>
                <p className="font-semibold text-gray-900 text-sm">{c._count?.tickets ?? '—'}</p>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className={clsx('flex items-center gap-1', c.active ? 'text-green-600' : 'text-gray-400')}>
                <span className={clsx('w-1.5 h-1.5 rounded-full', c.active ? 'bg-green-500' : 'bg-gray-300')} />
                {c.active ? 'Activa' : 'Inactiva'}
              </span>
              <span className="text-gray-400">{c.timezone}</span>
            </div>
          </div>
        ))}
      </div>

      {modal !== null && <CompanyModal company={modal} onClose={() => setModal(null)} />}
      {modulesFor && <ModulesModal company={modulesFor} onClose={() => setModulesFor(null)} />}
    </div>
  );
}
