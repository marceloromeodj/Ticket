import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, X, Save, Mail, Shield, Zap, Clock, Activity, Copy, RefreshCw, Send, FileSpreadsheet, Key, Eye, EyeOff, CalendarOff, FileText, RotateCcw } from 'lucide-react';
import api from '../../api/axios';
import { useAuthStore } from '../../store/authStore';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';

const TABS = [
  { id: 'general', label: 'General', icon: Shield },
  { id: 'sla', label: 'Políticas SLA', icon: Clock },
  { id: 'automation', label: 'Automatizaciones', icon: Zap },
  { id: 'inboxes', label: 'Bandejas Email', icon: Mail },
  { id: 'channels', label: 'Notificaciones', icon: Send },
  { id: 'scheduled-reports', label: 'Reportes programados', icon: FileSpreadsheet },
  { id: 'templates', label: 'Plantillas', icon: FileText },
  { id: 'api', label: 'API', icon: Key },
];

// ─── Webhook de monitoreo (Zabbix/PRTG) ──────────────────────────────────────
function MonitoringWebhookCard() {
  const { user, activeCompanyId } = useAuthStore();
  const companyId = activeCompanyId || user?.company?.id;
  const queryClient = useQueryClient();

  const { data: company, isLoading } = useQuery({
    queryKey: ['company-webhook', companyId],
    queryFn: () => api.get(`/companies/${companyId}`).then(r => r.data),
    enabled: !!companyId,
  });

  const regenMutation = useMutation({
    mutationFn: () => api.post(`/companies/${companyId}/regenerate-webhook-token`),
    onSuccess: () => { queryClient.invalidateQueries(['company-webhook']); toast.success('Token regenerado'); },
  });

  if (isLoading || !company) return null;

  const webhookUrl = `${window.location.origin}/webhook/monitoring/${company.monitoring_webhook_token}`;

  const copy = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast.success('URL copiada');
  };

  return (
    <div className="card p-6 space-y-3">
      <h2 className="font-semibold text-gray-900 flex items-center gap-2"><Activity size={16} /> Integración con monitoreo (Zabbix / PRTG)</h2>
      <p className="text-sm text-gray-500">
        Configurá esta URL como notificación webhook en Zabbix (Media type: Webhook) o PRTG (Notification: HTTP request)
        para que las alertas creen y resuelvan tickets automáticamente.
      </p>
      <div className="flex items-center gap-2">
        <input readOnly className="input font-mono text-xs" value={webhookUrl} />
        <button type="button" onClick={copy} className="btn-ghost h-9 px-3"><Copy size={14} /></button>
        <button
          type="button"
          onClick={() => { if (confirm('¿Regenerar el token? La URL anterior dejará de funcionar.')) regenMutation.mutate(); }}
          className="btn-ghost h-9 px-3"
        >
          <RefreshCw size={14} />
        </button>
      </div>
      <p className="text-xs text-gray-400">
        El cuerpo (body) del webhook debe tener este formato JSON:{' '}
        <code className="bg-gray-50 px-1 rounded">{'{ "source": "zabbix", "status": "problem", "external_id": "...", "host": "...", "message": "...", "severity": "high" }'}</code>
        {' '}(usá <code className="bg-gray-50 px-1 rounded">"status": "resolved"</code> con el mismo <code className="bg-gray-50 px-1 rounded">external_id</code> para cerrar el ticket automáticamente).
      </p>
    </div>
  );
}

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
          <div className="col-span-2">
            <label className="label">URL del logo</label>
            <input className="input" value={form.logo_url || ''} onChange={e => set('logo_url', e.target.value)} placeholder="https://.../logo.png" />
          </div>
          <div className="col-span-2">
            <label className="label">Dominio (para recibir emails / SSO)</label>
            <input className="input" value={form.domain || ''} onChange={e => set('domain', e.target.value)} placeholder="empresa.com" />
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

      <BusinessHoursCard />
      <HolidaysCard />
      <MonitoringWebhookCard />
    </div>
  );
}

const WEEKDAYS = [
  ['monday', 'Lunes'], ['tuesday', 'Martes'], ['wednesday', 'Miércoles'],
  ['thursday', 'Jueves'], ['friday', 'Viernes'], ['saturday', 'Sábado'], ['sunday', 'Domingo'],
];

function BusinessHoursCard() {
  const queryClient = useQueryClient();
  const { data: hours, isLoading: loadingHours } = useQuery({
    queryKey: ['business-hours-detail'],
    queryFn: () => api.get('/settings/business-hours').then(r => r.data).catch(() => null),
  });

  const [form, setForm] = useState(null);
  React.useEffect(() => { if (hours && !form) setForm(hours); }, [hours]);

  const mutation = useMutation({
    mutationFn: (data) => api.put('/settings/business-hours', data),
    onSuccess: () => { queryClient.invalidateQueries(['business-hours-detail']); toast.success('Horario guardado'); },
  });

  if (loadingHours || !form) return null;

  const setDay = (day, patch) => setForm(f => ({ ...f, [day]: { ...f[day], ...patch } }));

  return (
    <div className="card p-6 space-y-4">
      <h2 className="font-semibold text-gray-900 flex items-center gap-2"><Clock size={16} /> Horario de atención</h2>
      <p className="text-sm text-gray-500">Usado para el vencimiento de SLA en políticas marcadas "Solo horario laboral".</p>
      <div className="space-y-2">
        {WEEKDAYS.map(([key, label]) => (
          <div key={key} className="flex items-center gap-3">
            <label className="flex items-center gap-2 w-32 flex-shrink-0">
              <input type="checkbox" checked={!!form[key]?.active} onChange={e => setDay(key, { active: e.target.checked })} className="rounded" />
              <span className="text-sm text-gray-700">{label}</span>
            </label>
            <input type="time" className="input h-8 text-sm w-32" value={form[key]?.open || '09:00'} disabled={!form[key]?.active} onChange={e => setDay(key, { open: e.target.value })} />
            <span className="text-xs text-gray-400">a</span>
            <input type="time" className="input h-8 text-sm w-32" value={form[key]?.close || '18:00'} disabled={!form[key]?.active} onChange={e => setDay(key, { close: e.target.value })} />
          </div>
        ))}
      </div>
      <button onClick={() => mutation.mutate(form)} disabled={mutation.isLoading} className="btn-primary">
        <Save size={14} /> {mutation.isLoading ? 'Guardando...' : 'Guardar horario'}
      </button>
    </div>
  );
}

function HolidaysCard() {
  const queryClient = useQueryClient();
  const [newDate, setNewDate] = useState('');

  const { data: holidays = [], isLoading } = useQuery({
    queryKey: ['holidays'],
    queryFn: () => api.get('/settings/holidays').then(r => r.data || []),
  });

  const saveMutation = useMutation({
    mutationFn: (list) => api.put('/settings/holidays', list),
    onSuccess: () => queryClient.invalidateQueries(['holidays']),
  });

  const addHoliday = () => {
    if (!newDate || holidays.includes(newDate)) return;
    saveMutation.mutate([...holidays, newDate].sort());
    setNewDate('');
  };
  const removeHoliday = (date) => saveMutation.mutate(holidays.filter(d => d !== date));

  return (
    <div className="card p-6 space-y-4">
      <h2 className="font-semibold text-gray-900 flex items-center gap-2"><CalendarOff size={16} /> Feriados</h2>
      <p className="text-sm text-gray-500">Días puntuales sin atención (además del horario semanal), para el cálculo de SLA.</p>
      <div className="flex gap-2">
        <input type="date" className="input w-auto" value={newDate} onChange={e => setNewDate(e.target.value)} />
        <button onClick={addHoliday} disabled={!newDate} className="btn-ghost"><Plus size={14} /> Agregar</button>
      </div>
      {isLoading ? (
        <p className="text-sm text-gray-400">Cargando...</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {holidays.map(date => (
            <span key={date} className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-700 text-xs px-2.5 py-1 rounded-full">
              {date}
              <button onClick={() => removeHoliday(date)}><X size={11} className="text-gray-400 hover:text-red-500" /></button>
            </span>
          ))}
          {holidays.length === 0 && <p className="text-sm text-gray-400">Sin feriados cargados</p>}
        </div>
      )}
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
// Solo se ofrecen los eventos que el backend realmente dispara:
// ticket_created/ticket_updated (ticketController) y time_based (cron cada
// hora, workers/cronJobs.js). Otros nombres de evento no ejecutan nada.
const AUTOMATION_EVENTS = {
  ticket_created: 'Ticket creado',
  ticket_updated: 'Ticket actualizado',
  time_based:     'Basado en tiempo (revisión horaria)',
};
const CONDITION_FIELDS = ['status', 'priority', 'source', 'type', 'category_id', 'service_id', 'branch_id', 'subject', 'requester_email'];
const CONDITION_OPERATORS = {
  is: 'es', is_not: 'no es', contains: 'contiene', not_contains: 'no contiene',
  in: 'está en (separado por comas)', not_in: 'no está en (separado por comas)',
  is_null: 'está vacío', is_not_null: 'no está vacío',
};
const ACTION_TYPES = {
  assign_agent: 'Asignar agente', set_priority: 'Cambiar prioridad', set_status: 'Cambiar estado',
  set_category: 'Cambiar categoría', add_note: 'Agregar nota interna', notify_agent: 'Notificar a un agente',
  send_email: 'Enviar email', call_webhook: 'Llamar a una URL externa (webhook)',
  assign_group: 'Asignar a un grupo/equipo',
};

function AutomationSettings() {
  const queryClient = useQueryClient();
  const [modal, setModal] = useState(null);

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

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setModal({})} className="btn-primary"><Plus size={16} /> Nueva Automatización</button>
      </div>
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
                  <span className="badge badge-pending text-xs">{AUTOMATION_EVENTS[rule.event] || rule.event}</span>
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
                  <div className="flex items-center gap-1 justify-end">
                    <button onClick={() => setModal(rule)} className="btn-ghost p-1.5">
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => { if (confirm('¿Eliminar esta regla?')) deleteMutation.mutate(rule.id); }}
                      className="btn-ghost p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && data.length === 0 && (
              <tr><td colSpan={6} className="py-10 text-center text-gray-400">No hay automatizaciones configuradas</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {modal !== null && <AutomationModal rule={modal} onClose={() => setModal(null)} />}
    </div>
  );
}

function defaultActionValue(type) {
  if (type === 'send_email') return { to: 'requester', subject: '', body: '' };
  if (type === 'call_webhook') return { url: '' };
  return '';
}

function AutomationModal({ rule, onClose }) {
  const queryClient = useQueryClient();
  const isEdit = !!rule?.id;

  const { data: agents = [] } = useQuery({
    queryKey: ['agents-list'],
    queryFn: () => api.get('/agents', { params: { limit: 100 } }).then(r => r.data?.agents || []),
  });
  const { data: categories = [] } = useQuery({
    queryKey: ['categories-list'],
    queryFn: () => api.get('/categories').then(r => r.data || []),
  });
  const availableGroups = [...new Set(agents.flatMap(a => a.groups || []))];

  const [form, setForm] = useState({
    name: rule?.name || '',
    description: rule?.description || '',
    event: rule?.event || 'ticket_created',
    condition_type: rule?.condition_type || 'all',
    conditions: (rule?.conditions || []).map(c => ({ ...c, value: Array.isArray(c.value) ? c.value.join(', ') : c.value ?? '' })),
    actions: rule?.actions || [],
    active: rule?.active ?? true,
    time_condition: rule?.time_condition || { hours: 24, field: 'created_at', status_is: '' },
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const addCondition = () => set('conditions', [...form.conditions, { field: 'status', operator: 'is', value: '' }]);
  const updateCondition = (i, patch) => set('conditions', form.conditions.map((c, idx) => idx === i ? { ...c, ...patch } : c));
  const removeCondition = (i) => set('conditions', form.conditions.filter((_, idx) => idx !== i));

  const addAction = () => set('actions', [...form.actions, { type: 'assign_agent', value: defaultActionValue('assign_agent') }]);
  const updateAction = (i, patch) => set('actions', form.actions.map((a, idx) => idx === i ? { ...a, ...patch } : a));
  const removeAction = (i) => set('actions', form.actions.filter((_, idx) => idx !== i));

  const mutation = useMutation({
    mutationFn: (data) => isEdit ? api.put(`/automation/${rule.id}`, data) : api.post('/automation', data),
    onSuccess: () => { queryClient.invalidateQueries(['automations']); toast.success(isEdit ? 'Automatización actualizada' : 'Automatización creada'); onClose(); },
    onError: e => toast.error(e.response?.data?.error || 'Error'),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      ...form,
      conditions: form.conditions.map(c => ({
        ...c,
        value: ['in', 'not_in'].includes(c.operator) ? c.value.split(',').map(v => v.trim()).filter(Boolean) : c.value,
      })),
    };
    if (form.event !== 'time_based') delete payload.time_condition;
    mutation.mutate(payload);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">{isEdit ? 'Editar automatización' : 'Nueva automatización'}</h2>
          <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Nombre *</label>
              <input required className="input" value={form.name} onChange={e => set('name', e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="label">Descripción</label>
              <input className="input" value={form.description} onChange={e => set('description', e.target.value)} />
            </div>
            <div>
              <label className="label">Evento disparador</label>
              <select className="input" value={form.event} onChange={e => set('event', e.target.value)}>
                {Object.entries(AUTOMATION_EVENTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.active} onChange={e => set('active', e.target.checked)} className="rounded" />
                <span className="text-sm">Activa</span>
              </label>
            </div>
          </div>

          {form.event === 'time_based' && (
            <div className="bg-gray-50 rounded-lg p-3 grid grid-cols-3 gap-3">
              <div>
                <label className="label text-xs">Después de (horas)</label>
                <input type="number" min={1} className="input text-sm h-8" value={form.time_condition.hours}
                  onChange={e => set('time_condition', { ...form.time_condition, hours: parseInt(e.target.value) || 1 })} />
              </div>
              <div>
                <label className="label text-xs">Contado desde</label>
                <select className="input text-sm h-8" value={form.time_condition.field}
                  onChange={e => set('time_condition', { ...form.time_condition, field: e.target.value })}>
                  <option value="created_at">Creación</option>
                  <option value="updated_at">Última actualización</option>
                </select>
              </div>
              <div>
                <label className="label text-xs">Solo si el estado es</label>
                <select className="input text-sm h-8" value={form.time_condition.status_is}
                  onChange={e => set('time_condition', { ...form.time_condition, status_is: e.target.value })}>
                  <option value="">Cualquiera (no resuelto/cerrado)</option>
                  {['open','pending','waiting_customer'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* Condiciones */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="label mb-0">Condiciones</p>
              {form.conditions.length > 1 && (
                <select className="input text-xs h-7 w-auto" value={form.condition_type} onChange={e => set('condition_type', e.target.value)}>
                  <option value="all">Cumplir todas</option>
                  <option value="any">Cumplir alguna</option>
                </select>
              )}
            </div>
            <div className="space-y-2">
              {form.conditions.map((c, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <select className="input text-sm h-8 flex-1" value={c.field} onChange={e => updateCondition(i, { field: e.target.value })}>
                    {CONDITION_FIELDS.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                  <select className="input text-sm h-8 flex-1" value={c.operator} onChange={e => updateCondition(i, { operator: e.target.value })}>
                    {Object.entries(CONDITION_OPERATORS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  {!['is_null', 'is_not_null'].includes(c.operator) && (
                    <input className="input text-sm h-8 flex-1" value={c.value} onChange={e => updateCondition(i, { value: e.target.value })} placeholder="valor" />
                  )}
                  <button type="button" onClick={() => removeCondition(i)} className="btn-ghost p-1.5 text-red-400 flex-shrink-0"><X size={14} /></button>
                </div>
              ))}
              <button type="button" onClick={addCondition} className="text-xs text-primary-600 hover:underline">+ Agregar condición</button>
              {form.conditions.length === 0 && <p className="text-xs text-gray-400">Sin condiciones: se ejecuta siempre que ocurra el evento.</p>}
            </div>
          </div>

          {/* Acciones */}
          <div>
            <p className="label mb-2">Acciones *</p>
            <div className="space-y-2">
              {form.actions.map((a, i) => (
                <div key={i} className="border border-gray-100 rounded-lg p-3 space-y-2">
                  <div className="flex gap-2 items-center">
                    <select
                      className="input text-sm h-8 flex-1"
                      value={a.type}
                      onChange={e => updateAction(i, { type: e.target.value, value: defaultActionValue(e.target.value) })}
                    >
                      {Object.entries(ACTION_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                    <button type="button" onClick={() => removeAction(i)} className="btn-ghost p-1.5 text-red-400 flex-shrink-0"><X size={14} /></button>
                  </div>

                  {a.type === 'assign_agent' && (
                    <select className="input text-sm h-8" value={a.value} onChange={e => updateAction(i, { value: e.target.value })}>
                      <option value="">Elegir agente...</option>
                      {agents.map(ag => <option key={ag.id} value={ag.id}>{ag.name}</option>)}
                    </select>
                  )}
                  {a.type === 'set_priority' && (
                    <select className="input text-sm h-8" value={a.value} onChange={e => updateAction(i, { value: e.target.value })}>
                      {['low','medium','high','urgent'].map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  )}
                  {a.type === 'set_status' && (
                    <select className="input text-sm h-8" value={a.value} onChange={e => updateAction(i, { value: e.target.value })}>
                      {['open','pending','waiting_customer','resolved','closed'].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  )}
                  {a.type === 'set_category' && (
                    <select className="input text-sm h-8" value={a.value} onChange={e => updateAction(i, { value: e.target.value })}>
                      <option value="">Elegir categoría...</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  )}
                  {a.type === 'add_note' && (
                    <textarea className="input text-sm" rows={2} value={a.value} onChange={e => updateAction(i, { value: e.target.value })} placeholder="Texto de la nota interna" />
                  )}
                  {a.type === 'notify_agent' && (
                    <select className="input text-sm h-8" value={a.value} onChange={e => updateAction(i, { value: e.target.value })}>
                      <option value="assigned">Al agente asignado</option>
                      {agents.map(ag => <option key={ag.id} value={ag.id}>{ag.name}</option>)}
                    </select>
                  )}
                  {a.type === 'send_email' && (
                    <div className="grid grid-cols-3 gap-2">
                      <select className="input text-sm h-8" value={a.value.to} onChange={e => updateAction(i, { value: { ...a.value, to: e.target.value } })}>
                        <option value="requester">Al solicitante</option>
                        <option value="agent">Al agente asignado</option>
                        <option value="specific">Email específico</option>
                      </select>
                      {a.value.to === 'specific' && (
                        <input className="input text-sm h-8" placeholder="email@dominio.com" value={a.value.email || ''} onChange={e => updateAction(i, { value: { ...a.value, email: e.target.value } })} />
                      )}
                      <input className={clsx('input text-sm h-8', a.value.to === 'specific' ? 'col-span-1' : 'col-span-2')} placeholder="Asunto" value={a.value.subject} onChange={e => updateAction(i, { value: { ...a.value, subject: e.target.value } })} />
                      <textarea className="input text-sm col-span-3" rows={2} placeholder="Cuerpo del mensaje" value={a.value.body} onChange={e => updateAction(i, { value: { ...a.value, body: e.target.value } })} />
                    </div>
                  )}
                  {a.type === 'assign_group' && (
                    availableGroups.length > 0 ? (
                      <select className="input text-sm h-8" value={a.value} onChange={e => updateAction(i, { value: e.target.value })}>
                        <option value="">Elegir grupo...</option>
                        {availableGroups.map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                    ) : (
                      <p className="text-xs text-amber-600">No hay grupos configurados todavía — asignale un grupo a algún agente en Agentes primero.</p>
                    )
                  )}
                  {a.type === 'call_webhook' && (
                    <div>
                      <input className="input text-sm h-8" placeholder="https://tu-sistema.com/webhook" value={a.value.url || ''} onChange={e => updateAction(i, { value: { url: e.target.value } })} />
                      <p className="text-xs text-gray-400 mt-1">Se manda un POST con JSON: evento, regla y datos básicos del ticket.</p>
                    </div>
                  )}
                </div>
              ))}
              <button type="button" onClick={addAction} className="text-xs text-primary-600 hover:underline">+ Agregar acción</button>
              {form.actions.length === 0 && <p className="text-xs text-amber-600">Agregá al menos una acción para que la regla haga algo.</p>}
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-2 border-t border-gray-100">
            <button type="button" onClick={onClose} className="btn-ghost">Cancelar</button>
            <button type="submit" disabled={mutation.isLoading || form.actions.length === 0} className="btn-primary">
              {mutation.isLoading ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
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
                <p className="font-medium text-gray-900 flex items-center gap-2">
                  {inbox.name}
                  <span className="text-xs font-normal text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                    {inbox.branch?.name || 'Toda la empresa'}
                  </span>
                </p>
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

  const { data: branches = [] } = useQuery({
    queryKey: ['branches-list'],
    queryFn: () => api.get('/branches').then(r => r.data?.branches || r.data || []),
  });

  const [form, setForm] = useState({
    name: inbox?.name || '',
    branch_id: inbox?.branch_id || '',
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Nombre del remitente</label>
              <input className="input" value={form.from_name} onChange={e => set('from_name', e.target.value)} placeholder="Soporte HelpDesk" />
            </div>
            <div>
              <label className="label">Sucursal</label>
              <select className="input" value={form.branch_id} onChange={e => set('branch_id', e.target.value)}>
                <option value="">Toda la empresa</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          </div>
          <p className="text-xs text-gray-400 -mt-2">
            Los tickets creados por correos que lleguen a esta bandeja quedan asociados a la sucursal elegida (o a toda la empresa si no elegís ninguna).
          </p>
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

// ─── Canales de notificación (Slack / Telegram) ──────────────────────────────
function ChannelSettings() {
  const queryClient = useQueryClient();
  const [modal, setModal] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['notification-channels'],
    queryFn: () => api.get('/notification-channels').then(r => r.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/notification-channels/${id}`),
    onSuccess: () => { queryClient.invalidateQueries(['notification-channels']); toast.success('Canal eliminado'); },
  });
  const testMutation = useMutation({
    mutationFn: (id) => api.post(`/notification-channels/${id}/test`),
    onSuccess: (res) => toast.success(res.data.message),
    onError: e => toast.error(e.response?.data?.error || 'Error al enviar la prueba'),
  });

  const channels = data?.channels || [];

  return (
    <div className="space-y-4 max-w-2xl">
      <p className="text-sm text-gray-500">
        Avisos a nivel empresa (no por agente individual) para tickets urgentes, incumplimiento de SLA e incidentes mayores.
      </p>
      <div className="flex justify-end">
        <button onClick={() => setModal({})} className="btn-primary"><Plus size={16} /> Nuevo canal</button>
      </div>
      <div className="space-y-3">
        {isLoading && <div className="text-center text-gray-400 py-6">Cargando...</div>}
        {!isLoading && channels.length === 0 && <div className="text-center text-gray-400 py-6">Sin canales configurados</div>}
        {channels.map(c => (
          <div key={c.id} className="card p-4 flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900 capitalize">{c.type}</p>
              <p className="text-xs text-gray-400">{(c.events || []).join(', ')}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => testMutation.mutate(c.id)} className="btn-ghost h-8 text-xs">Probar</button>
              <button onClick={() => { if (confirm('¿Eliminar canal?')) deleteMutation.mutate(c.id); }} className="btn-ghost p-2 text-red-400"><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
      </div>
      {modal !== null && <ChannelModal onClose={() => setModal(null)} />}
    </div>
  );
}

function ChannelModal({ onClose }) {
  const queryClient = useQueryClient();
  const [type, setType] = useState('slack');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [botToken, setBotToken] = useState('');
  const [chatId, setChatId] = useState('');
  const [events, setEvents] = useState(['ticket_urgent', 'sla_breach', 'major_incident', 'contract_expiring']);

  const mutation = useMutation({
    mutationFn: () => api.post('/notification-channels', {
      type,
      config: type === 'slack' ? { webhook_url: webhookUrl } : { bot_token: botToken, chat_id: chatId },
      events,
    }),
    onSuccess: () => { queryClient.invalidateQueries(['notification-channels']); toast.success('Canal creado'); onClose(); },
    onError: e => toast.error(e.response?.data?.error || 'Error'),
  });

  const toggleEvent = (ev) => setEvents(es => es.includes(ev) ? es.filter(x => x !== ev) : [...es, ev]);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Nuevo canal de notificación</h2>
          <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
        </div>
        <form onSubmit={e => { e.preventDefault(); mutation.mutate(); }} className="p-6 space-y-4">
          <div>
            <label className="label">Tipo</label>
            <select className="input" value={type} onChange={e => setType(e.target.value)}>
              <option value="slack">Slack</option>
              <option value="telegram">Telegram</option>
            </select>
          </div>
          {type === 'slack' ? (
            <div>
              <label className="label">Webhook URL</label>
              <input required className="input" value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)} placeholder="https://hooks.slack.com/services/..." />
              <p className="text-xs text-gray-400 mt-1">Slack → Apps → Incoming Webhooks → crear uno para el canal deseado.</p>
            </div>
          ) : (
            <>
              <div>
                <label className="label">Bot Token</label>
                <input required className="input" value={botToken} onChange={e => setBotToken(e.target.value)} placeholder="123456:ABC-DEF..." />
                <p className="text-xs text-gray-400 mt-1">Creado con @BotFather en Telegram.</p>
              </div>
              <div>
                <label className="label">Chat ID</label>
                <input required className="input" value={chatId} onChange={e => setChatId(e.target.value)} placeholder="-100123456789" />
                <p className="text-xs text-gray-400 mt-1">ID del grupo/canal donde el bot debe mandar los avisos.</p>
              </div>
            </>
          )}
          <div>
            <label className="label">Eventos</label>
            <div className="space-y-1">
              {[['ticket_urgent', 'Ticket urgente creado'], ['sla_breach', 'SLA incumplido'], ['major_incident', 'Incidente masivo / mayor'], ['contract_expiring', 'Contrato/licencia por vencer']].map(([k, l]) => (
                <label key={k} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" className="rounded" checked={events.includes(k)} onChange={() => toggleEvent(k)} />
                  {l}
                </label>
              ))}
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

// ─── Reportes programados ─────────────────────────────────────────────────────
const REPORT_TYPE_LABELS = { overview: 'Resumen general', agent_performance: 'Performance de agentes', sla: 'SLA', satisfaction: 'Satisfacción (CSAT)' };
const FREQUENCY_LABELS = { daily: 'Diario', weekly: 'Semanal', monthly: 'Mensual' };

function ScheduledReportSettings() {
  const queryClient = useQueryClient();
  const [modal, setModal] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['scheduled-reports'],
    queryFn: () => api.get('/scheduled-reports').then(r => r.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/scheduled-reports/${id}`),
    onSuccess: () => { queryClient.invalidateQueries(['scheduled-reports']); toast.success('Eliminado'); },
  });

  const reports = data?.reports || [];

  return (
    <div className="space-y-4 max-w-2xl">
      <p className="text-sm text-gray-500">Se revisan todos los días a las 7am y se mandan por email si corresponde según la frecuencia.</p>
      <div className="flex justify-end">
        <button onClick={() => setModal({})} className="btn-primary"><Plus size={16} /> Nuevo reporte programado</button>
      </div>
      <div className="space-y-3">
        {isLoading && <div className="text-center text-gray-400 py-6">Cargando...</div>}
        {!isLoading && reports.length === 0 && <div className="text-center text-gray-400 py-6">Sin reportes programados</div>}
        {reports.map(r => (
          <div key={r.id} className="card p-4 flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">{REPORT_TYPE_LABELS[r.report_type]} — {FREQUENCY_LABELS[r.frequency]} ({r.format === 'pdf' ? 'PDF' : 'Excel'})</p>
              <p className="text-xs text-gray-400">{(r.recipients || []).join(', ')}</p>
            </div>
            <button onClick={() => { if (confirm('¿Eliminar?')) deleteMutation.mutate(r.id); }} className="btn-ghost p-2 text-red-400"><Trash2 size={14} /></button>
          </div>
        ))}
      </div>
      {modal !== null && <ScheduledReportModal onClose={() => setModal(null)} />}
    </div>
  );
}

function ScheduledReportModal({ onClose }) {
  const queryClient = useQueryClient();
  const [reportType, setReportType] = useState('overview');
  const [frequency, setFrequency] = useState('weekly');
  const [format, setFormat] = useState('excel');
  const [recipients, setRecipients] = useState('');

  const mutation = useMutation({
    mutationFn: () => api.post('/scheduled-reports', {
      report_type: reportType, frequency, format,
      recipients: recipients.split(',').map(e => e.trim()).filter(Boolean),
    }),
    onSuccess: () => { queryClient.invalidateQueries(['scheduled-reports']); toast.success('Creado'); onClose(); },
    onError: e => toast.error(e.response?.data?.error || 'Error'),
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Nuevo reporte programado</h2>
          <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
        </div>
        <form onSubmit={e => { e.preventDefault(); mutation.mutate(); }} className="p-6 space-y-4">
          <div>
            <label className="label">Reporte</label>
            <select className="input" value={reportType} onChange={e => setReportType(e.target.value)}>
              {Object.entries(REPORT_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Frecuencia</label>
              <select className="input" value={frequency} onChange={e => setFrequency(e.target.value)}>
                {Object.entries(FREQUENCY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Formato</label>
              <select className="input" value={format} onChange={e => setFormat(e.target.value)}>
                <option value="excel">Excel</option>
                <option value="pdf">PDF</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Destinatarios (separados por coma)</label>
            <input required className="input" value={recipients} onChange={e => setRecipients(e.target.value)} placeholder="jefe@empresa.com, gerencia@empresa.com" />
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

// ─── Tokens de API (integraciones externas) ──────────────────────────────────
function ApiTokenSettings() {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [newToken, setNewToken] = useState(null);
  const [reveal, setReveal] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['api-tokens'],
    queryFn: () => api.get('/api-tokens').then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: () => api.post('/api-tokens', { name }),
    onSuccess: ({ data }) => { queryClient.invalidateQueries(['api-tokens']); setNewToken(data.token); setName(''); },
    onError: e => toast.error(e.response?.data?.error || 'Error'),
  });

  const revokeMutation = useMutation({
    mutationFn: (id) => api.delete(`/api-tokens/${id}`),
    onSuccess: () => { queryClient.invalidateQueries(['api-tokens']); toast.success('Token revocado'); },
  });

  const tokens = data?.tokens || [];

  return (
    <div className="space-y-4 max-w-2xl">
      <p className="text-sm text-gray-500">
        Tokens para que otros sistemas creen y consulten tickets vía API. Documentación en{' '}
        <a href="/api/docs" target="_blank" rel="noreferrer" className="text-primary-600 hover:underline">/api/docs</a>.
      </p>

      {newToken && (
        <div className="card p-4 bg-amber-50 border-amber-200 space-y-2">
          <p className="text-sm font-medium text-amber-800">Copiá este token ahora — no se va a volver a mostrar:</p>
          <div className="flex items-center gap-2">
            <input readOnly className="input font-mono text-xs flex-1" type={reveal ? 'text' : 'password'} value={newToken} />
            <button onClick={() => setReveal(v => !v)} className="btn-ghost h-9 px-3">{reveal ? <EyeOff size={14} /> : <Eye size={14} />}</button>
            <button onClick={() => { navigator.clipboard.writeText(newToken); toast.success('Copiado'); }} className="btn-ghost h-9 px-3"><Copy size={14} /></button>
          </div>
          <button onClick={() => setNewToken(null)} className="text-xs text-amber-700 hover:underline">Ya lo copié, cerrar</button>
        </div>
      )}

      <form onSubmit={e => { e.preventDefault(); if (name.trim()) createMutation.mutate(); }} className="flex gap-2">
        <input className="input flex-1" placeholder="Nombre (ej: Integración Zabbix, ERP interno)" value={name} onChange={e => setName(e.target.value)} />
        <button type="submit" disabled={!name.trim() || createMutation.isLoading} className="btn-primary"><Plus size={16} /> Generar token</button>
      </form>

      <div className="space-y-2">
        {isLoading && <div className="text-center text-gray-400 py-6">Cargando...</div>}
        {!isLoading && tokens.length === 0 && <div className="text-center text-gray-400 py-6">Sin tokens generados</div>}
        {tokens.map(t => (
          <div key={t.id} className="card p-4 flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">{t.name}</p>
              <p className="text-xs text-gray-400 font-mono">{t.token_prefix}••••••••{!t.active && ' · revocado'}</p>
            </div>
            {t.active && (
              <button onClick={() => { if (confirm('¿Revocar este token? Dejará de funcionar de inmediato.')) revokeMutation.mutate(t.id); }} className="btn-ghost p-2 text-red-400">
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Plantillas de notificación ──────────────────────────────────────────────
function TemplateModal({ template, onClose }) {
  const queryClient = useQueryClient();
  const [subject, setSubject] = useState(template.subject || '');
  const [body, setBody] = useState(template.body || '');

  const saveMutation = useMutation({
    mutationFn: () => api.put(`/notification-templates/${template.event}`, { subject, body }),
    onSuccess: () => { queryClient.invalidateQueries(['notification-templates']); toast.success('Plantilla guardada'); onClose(); },
    onError: e => toast.error(e.response?.data?.error || 'Error'),
  });

  const resetMutation = useMutation({
    mutationFn: () => api.delete(`/notification-templates/${template.event}`),
    onSuccess: () => { queryClient.invalidateQueries(['notification-templates']); toast.success('Restaurada por defecto'); onClose(); },
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">{template.label}</h2>
          <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-xs text-gray-500">
            Variables disponibles: {template.variables.map(v => <code key={v} className="bg-gray-50 px-1 rounded mr-1">{`{{${v}}}`}</code>)}
          </p>
          {template.channel === 'email' && (
            <div>
              <label className="label">Asunto</label>
              <input className="input" value={subject} onChange={e => setSubject(e.target.value)} />
            </div>
          )}
          <div>
            <label className="label">{template.channel === 'email' ? 'Cuerpo (HTML)' : 'Texto'}</label>
            <textarea className="input font-mono text-sm" rows={template.channel === 'email' ? 8 : 3} value={body} onChange={e => setBody(e.target.value)} />
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            {template.is_custom ? (
              <button onClick={() => resetMutation.mutate()} disabled={resetMutation.isLoading} className="btn-ghost text-sm">
                <RotateCcw size={14} /> Restaurar por defecto
              </button>
            ) : <span />}
            <div className="flex gap-3">
              <button onClick={onClose} className="btn-ghost">Cancelar</button>
              <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isLoading || !body.trim()} className="btn-primary">
                {saveMutation.isLoading ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TemplateSettings() {
  const [modal, setModal] = useState(null);
  const { data, isLoading } = useQuery({
    queryKey: ['notification-templates'],
    queryFn: () => api.get('/notification-templates').then(r => r.data),
  });

  const templates = data?.templates || [];

  return (
    <div className="space-y-4 max-w-2xl">
      <p className="text-sm text-gray-500">
        Personalizá el texto de los emails transaccionales y de los avisos que se mandan a Slack/Telegram. Lo que no edites usa el texto por defecto.
      </p>
      <div className="space-y-2">
        {isLoading && <div className="text-center text-gray-400 py-6">Cargando...</div>}
        {templates.map(t => (
          <div key={t.event} className="card p-4 flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900 flex items-center gap-2">
                {t.label}
                {t.is_custom && <span className="text-xs font-normal text-primary-600 bg-primary-50 px-1.5 py-0.5 rounded">Personalizada</span>}
              </p>
              <p className="text-xs text-gray-400 capitalize">{t.channel === 'email' ? 'Email' : 'Slack / Telegram / notificación interna'}</p>
            </div>
            <button onClick={() => setModal(t)} className="btn-ghost p-2"><Pencil size={14} /></button>
          </div>
        ))}
      </div>
      {modal && <TemplateModal template={modal} onClose={() => setModal(null)} />}
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────
export default function Settings() {
  const [activeTab, setActiveTab] = useState('general');
  const ActiveTab = {
    general: GeneralSettings, sla: SLASettings, automation: AutomationSettings, inboxes: InboxSettings,
    channels: ChannelSettings, 'scheduled-reports': ScheduledReportSettings,
    api: ApiTokenSettings, templates: TemplateSettings,
  }[activeTab];

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
