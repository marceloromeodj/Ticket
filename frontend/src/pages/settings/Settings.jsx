import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, X, Save, Mail, Shield, Zap, Clock } from 'lucide-react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';

const TABS = [
  { id: 'general', label: 'General', icon: Shield },
  { id: 'sla', label: 'Políticas SLA', icon: Clock },
  { id: 'automation', label: 'Automatizaciones', icon: Zap },
  { id: 'inboxes', label: 'Bandejas Email', icon: Mail },
];

// ─── General ────────────────────────────────────────────────────────────────
function GeneralSettings() {
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useQuery({
    queryKey: ['company-settings'],
    queryFn: () => api.get('/settings').then(r => r.data),
  });

  const [form, setForm] = useState(null);
  React.useEffect(() => { if (settings && !form) setForm(settings); }, [settings]);

  const mutation = useMutation({
    mutationFn: (data) => api.put('/settings', data),
    onSuccess: () => { queryClient.invalidateQueries(['company-settings']); toast.success('Configuración guardada'); },
  });

  if (isLoading || !form) return <div className="text-center text-gray-400 py-10">Cargando...</div>;
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="card p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">Datos de la empresa</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="label">Nombre de la empresa</label>
            <input className="input" value={form.name || ''} onChange={e => set('name', e.target.value)} />
          </div>
          <div>
            <label className="label">Color primario</label>
            <div className="flex gap-2">
              <input type="color" value={form.primary_color || '#6366f1'} onChange={e => set('primary_color', e.target.value)} className="h-9 w-12 rounded border border-gray-200 cursor-pointer" />
              <input className="input flex-1" value={form.primary_color || ''} onChange={e => set('primary_color', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label">Timezone</label>
            <select className="input" value={form.timezone || ''} onChange={e => set('timezone', e.target.value)}>
              {['America/Buenos_Aires','America/Santiago','America/Lima','America/Mexico_City','Europe/Madrid','UTC'].map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="card p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">Configuración de tickets</h2>
        <div className="space-y-3">
          {[
            { key: 'settings.auto_assign', label: 'Auto-asignar tickets a agentes disponibles' },
            { key: 'settings.email_enabled', label: 'Canal Email habilitado' },
            { key: 'settings.chat_enabled', label: 'Canal Chat habilitado' },
            { key: 'settings.whatsapp_enabled', label: 'Canal WhatsApp habilitado' },
          ].map(({ key, label }) => {
            const [obj, field] = key.split('.');
            const val = obj === 'settings' ? form.settings?.[field] : form[key];
            return (
              <label key={key} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 cursor-pointer">
                <span className="text-sm text-gray-700">{label}</span>
                <input
                  type="checkbox"
                  checked={!!val}
                  onChange={e => {
                    if (obj === 'settings') {
                      set('settings', { ...form.settings, [field]: e.target.checked });
                    } else {
                      set(field, e.target.checked);
                    }
                  }}
                  className="w-4 h-4 rounded"
                />
              </label>
            );
          })}
        </div>
        <div>
          <label className="label">Prefijo de ticket</label>
          <input className="input max-w-xs" value={form.settings?.ticket_prefix || ''} onChange={e => set('settings', { ...form.settings, ticket_prefix: e.target.value })} placeholder="TKT" />
        </div>
      </div>

      <button onClick={() => mutation.mutate(form)} disabled={mutation.isLoading} className="btn-primary">
        <Save size={16} /> {mutation.isLoading ? 'Guardando...' : 'Guardar cambios'}
      </button>
    </div>
  );
}

// ─── SLA ────────────────────────────────────────────────────────────────────
function SLASettings() {
  const queryClient = useQueryClient();
  const [modal, setModal] = useState(null);

  const { data = [], isLoading } = useQuery({
    queryKey: ['sla-policies'],
    queryFn: () => api.get('/sla').then(r => r.data || []),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/sla/${id}`),
    onSuccess: () => { queryClient.invalidateQueries(['sla-policies']); toast.success('Política eliminada'); },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setModal({})} className="btn-primary"><Plus size={16} /> Nueva Política</button>
      </div>
      <div className="space-y-3">
        {isLoading && <div className="text-center text-gray-400 py-8">Cargando...</div>}
        {data.map(sla => (
          <div key={sla.id} className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-gray-900">{sla.name}</h3>
                {sla.is_default && <span className="badge badge-open text-xs">Por defecto</span>}
              </div>
              <div className="flex gap-1">
                <button onClick={() => setModal(sla)} className="btn-ghost p-1.5"><Pencil size={14} /></button>
                <button
                  onClick={() => { if (confirm('¿Eliminar política SLA?')) deleteMutation.mutate(sla.id); }}
                  className="btn-ghost p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-3 text-xs">
              {['urgent','high','medium','low'].map(p => (
                <div key={p} className="bg-gray-50 rounded-lg p-2.5">
                  <p className="text-gray-500 capitalize mb-1">{p}</p>
                  <p className="font-medium text-gray-900">
                    1ª resp: {sla.first_response_time?.[p] || '—'}m
                  </p>
                  <p className="text-gray-500">
                    Resolución: {sla.resolution_time?.[p] || '—'}m
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {modal !== null && <SLAModal sla={modal} onClose={() => setModal(null)} />}
    </div>
  );
}

function SLAModal({ sla, onClose }) {
  const queryClient = useQueryClient();
  const isEdit = !!sla?.id;
  const [form, setForm] = useState({
    name: sla?.name || '',
    is_default: sla?.is_default || false,
    business_hours_only: sla?.business_hours_only || false,
    first_response_time: sla?.first_response_time || { urgent: 60, high: 240, medium: 480, low: 1440 },
    resolution_time: sla?.resolution_time || { urgent: 240, high: 480, medium: 1440, low: 2880 },
  });

  const mutation = useMutation({
    mutationFn: (data) => isEdit ? api.put(`/sla/${sla.id}`, data) : api.post('/sla', data),
    onSuccess: () => { queryClient.invalidateQueries(['sla-policies']); toast.success(isEdit ? 'SLA actualizado' : 'SLA creado'); onClose(); },
    onError: e => toast.error(e.response?.data?.error || 'Error'),
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">{isEdit ? 'Editar política SLA' : 'Nueva política SLA'}</h2>
          <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
        </div>
        <form onSubmit={e => { e.preventDefault(); mutation.mutate(form); }} className="p-6 space-y-4">
          <div>
            <label className="label">Nombre *</label>
            <input required className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.is_default} onChange={e => setForm(f => ({ ...f, is_default: e.target.checked }))} className="rounded" />
              <span className="text-sm">Por defecto</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.business_hours_only} onChange={e => setForm(f => ({ ...f, business_hours_only: e.target.checked }))} className="rounded" />
              <span className="text-sm">Solo horario laboral</span>
            </label>
          </div>
          <div>
            <p className="label mb-2">Tiempos de primera respuesta (minutos)</p>
            <div className="grid grid-cols-4 gap-2">
              {['urgent','high','medium','low'].map(p => (
                <div key={p}>
                  <label className="text-xs text-gray-500 capitalize">{p}</label>
                  <input type="number" min={1} className="input text-sm h-8" value={form.first_response_time[p]} onChange={e => setForm(f => ({ ...f, first_response_time: { ...f.first_response_time, [p]: parseInt(e.target.value) } }))} />
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="label mb-2">Tiempos de resolución (minutos)</p>
            <div className="grid grid-cols-4 gap-2">
              {['urgent','high','medium','low'].map(p => (
                <div key={p}>
                  <label className="text-xs text-gray-500 capitalize">{p}</label>
                  <input type="number" min={1} className="input text-sm h-8" value={form.resolution_time[p]} onChange={e => setForm(f => ({ ...f, resolution_time: { ...f.resolution_time, [p]: parseInt(e.target.value) } }))} />
                </div>
              ))}
            </div>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={onClose} className="btn-ghost">Cancelar</button>
            <button type="submit" disabled={mutation.isLoading} className="btn-primary">{mutation.isLoading ? 'Guardando...' : 'Guardar'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Automations ────────────────────────────────────────────────────────────
function AutomationSettings() {
  const queryClient = useQueryClient();
  const { data = [], isLoading } = useQuery({
    queryKey: ['automations'],
    queryFn: () => api.get('/automation').then(r => r.data || []),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }) => api.put(`/automation/${id}`, { active }),
    onSuccess: () => queryClient.invalidateQueries(['automations']),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/automation/${id}`),
    onSuccess: () => { queryClient.invalidateQueries(['automations']); toast.success('Regla eliminada'); },
  });

  const EVENT_LABELS = {
    ticket_created: 'Ticket creado', ticket_updated: 'Ticket actualizado',
    ticket_assigned: 'Ticket asignado', ticket_resolved: 'Ticket resuelto',
    reply_received: 'Respuesta recibida', time_based: 'Basado en tiempo',
  };

  return (
    <div className="space-y-4">
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100 text-left">
              <th className="px-4 py-3 font-medium text-gray-500 text-xs uppercase">Nombre</th>
              <th className="px-4 py-3 font-medium text-gray-500 text-xs uppercase">Evento</th>
              <th className="px-4 py-3 font-medium text-gray-500 text-xs uppercase">Acciones</th>
              <th className="px-4 py-3 font-medium text-gray-500 text-xs uppercase">Ejecuciones</th>
              <th className="px-4 py-3 font-medium text-gray-500 text-xs uppercase">Activa</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading && <tr><td colSpan={6} className="py-8 text-center text-gray-400">Cargando...</td></tr>}
            {data.map(rule => (
              <tr key={rule.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{rule.name}</td>
                <td className="px-4 py-3">
                  <span className="badge badge-pending text-xs">{EVENT_LABELS[rule.event] || rule.event}</span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">{rule.actions?.length || 0} acción(es)</td>
                <td className="px-4 py-3 text-xs text-gray-500">{rule.run_count || 0}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => toggleMutation.mutate({ id: rule.id, active: !rule.active })}
                    className={clsx('w-10 h-5 rounded-full transition-colors relative', rule.active ? 'bg-primary-600' : 'bg-gray-200')}
                  >
                    <span className={clsx('absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform', rule.active ? 'translate-x-5' : 'translate-x-0.5')} />
                  </button>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => { if (confirm('¿Eliminar esta regla?')) deleteMutation.mutate(rule.id); }}
                    className="btn-ghost p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50"
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
            {!isLoading && data.length === 0 && (
              <tr><td colSpan={6} className="py-10 text-center text-gray-400">No hay automatizaciones configuradas</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Inboxes ─────────────────────────────────────────────────────────────────
function InboxSettings() {
  const queryClient = useQueryClient();
  const [modal, setModal] = useState(null);

  const { data = [], isLoading } = useQuery({
    queryKey: ['inboxes'],
    queryFn: () => api.get('/inboxes').then(r => r.data || []),
  });

  const syncMutation = useMutation({
    mutationFn: (id) => api.post(`/inboxes/${id}/sync`),
    onSuccess: () => toast.success('Sincronización iniciada'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/inboxes/${id}`),
    onSuccess: () => { queryClient.invalidateQueries(['inboxes']); toast.success('Bandeja eliminada'); },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setModal({})} className="btn-primary"><Plus size={16} /> Nueva Bandeja</button>
      </div>
      <div className="space-y-3">
        {isLoading && <div className="text-center text-gray-400 py-8">Cargando...</div>}
        {data.map(inbox => (
          <div key={inbox.id} className="card p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                <Mail size={18} className="text-blue-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">{inbox.name}</p>
                <p className="text-xs text-gray-400">{inbox.imap_user} · IMAP: {inbox.imap_host}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => syncMutation.mutate(inbox.id)} className="btn-ghost h-8 text-xs">
                Sincronizar
              </button>
              <button onClick={() => setModal(inbox)} className="btn-ghost p-2"><Pencil size={14} /></button>
              <button
                onClick={() => { if (confirm('¿Eliminar bandeja?')) deleteMutation.mutate(inbox.id); }}
                className="btn-ghost p-2 text-red-400 hover:text-red-600 hover:bg-red-50"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
        {!isLoading && data.length === 0 && (
          <div className="text-center text-gray-400 py-10">No hay bandejas configuradas</div>
        )}
      </div>
      {modal !== null && <InboxModal inbox={modal} onClose={() => setModal(null)} />}
    </div>
  );
}

function InboxModal({ inbox, onClose }) {
  const queryClient = useQueryClient();
  const isEdit = !!inbox?.id;
  const [form, setForm] = useState({
    name: inbox?.name || '',
    imap_host: inbox?.imap_host || '',
    imap_port: inbox?.imap_port || 993,
    imap_user: inbox?.imap_user || '',
    imap_pass: inbox?.imap_pass || '',
    imap_use_ssl: inbox?.imap_use_ssl ?? true,
    smtp_host: inbox?.smtp_host || '',
    smtp_port: inbox?.smtp_port || 587,
    smtp_user: inbox?.smtp_user || '',
    smtp_pass: inbox?.smtp_pass || '',
    from_name: inbox?.from_name || '',
  });

  const mutation = useMutation({
    mutationFn: (data) => isEdit ? api.put(`/inboxes/${inbox.id}`, data) : api.post('/inboxes', data),
    onSuccess: () => { queryClient.invalidateQueries(['inboxes']); toast.success(isEdit ? 'Bandeja actualizada' : 'Bandeja creada'); onClose(); },
    onError: e => toast.error(e.response?.data?.error || 'Error'),
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">{isEdit ? 'Editar bandeja' : 'Nueva bandeja de email'}</h2>
          <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
        </div>
        <form onSubmit={e => { e.preventDefault(); mutation.mutate(form); }} className="p-6 space-y-4">
          <div>
            <label className="label">Nombre *</label>
            <input required className="input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Soporte Principal" />
          </div>
          <div>
            <label className="label">Nombre del remitente</label>
            <input className="input" value={form.from_name} onChange={e => set('from_name', e.target.value)} placeholder="Soporte HelpDesk" />
          </div>
          <hr className="border-gray-100" />
          <p className="font-medium text-gray-700 text-sm">Configuración IMAP (entrada)</p>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="label text-xs">Host</label>
              <input className="input text-sm h-8" value={form.imap_host} onChange={e => set('imap_host', e.target.value)} placeholder="imap.gmail.com" />
            </div>
            <div>
              <label className="label text-xs">Puerto</label>
              <input type="number" className="input text-sm h-8" value={form.imap_port} onChange={e => set('imap_port', parseInt(e.target.value))} />
            </div>
            <div>
              <label className="label text-xs">Usuario</label>
              <input className="input text-sm h-8" value={form.imap_user} onChange={e => set('imap_user', e.target.value)} />
            </div>
            <div>
              <label className="label text-xs">Contraseña</label>
              <input type="password" className="input text-sm h-8" value={form.imap_pass} onChange={e => set('imap_pass', e.target.value)} />
            </div>
            <div className="flex items-end pb-0.5">
              <label className="flex items-center gap-1.5 cursor-pointer text-sm">
                <input type="checkbox" checked={form.imap_use_ssl} onChange={e => set('imap_use_ssl', e.target.checked)} className="rounded" />
                SSL
              </label>
            </div>
          </div>
          <hr className="border-gray-100" />
          <p className="font-medium text-gray-700 text-sm">Configuración SMTP (salida)</p>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="label text-xs">Host</label>
              <input className="input text-sm h-8" value={form.smtp_host} onChange={e => set('smtp_host', e.target.value)} placeholder="smtp.gmail.com" />
            </div>
            <div>
              <label className="label text-xs">Puerto</label>
              <input type="number" className="input text-sm h-8" value={form.smtp_port} onChange={e => set('smtp_port', parseInt(e.target.value))} />
            </div>
            <div>
              <label className="label text-xs">Usuario</label>
              <input className="input text-sm h-8" value={form.smtp_user} onChange={e => set('smtp_user', e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="label text-xs">Contraseña</label>
              <input type="password" className="input text-sm h-8" value={form.smtp_pass} onChange={e => set('smtp_pass', e.target.value)} />
            </div>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={onClose} className="btn-ghost">Cancelar</button>
            <button type="submit" disabled={mutation.isLoading} className="btn-primary">{mutation.isLoading ? 'Guardando...' : 'Guardar'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────
export default function Settings() {
  const [activeTab, setActiveTab] = useState('general');
  const ActiveTab = { general: GeneralSettings, sla: SLASettings, automation: AutomationSettings, inboxes: InboxSettings }[activeTab];

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-gray-900">Configuración</h1>
      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors -mb-px border-b-2',
              activeTab === id
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>
      <ActiveTab />
    </div>
  );
}
