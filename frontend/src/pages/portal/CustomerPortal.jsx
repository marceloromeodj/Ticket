import React, { useEffect, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Ticket, Search, Plus, Send, MessageSquare, BookOpen, ChevronRight, ArrowLeft, LayoutGrid, HelpCircle, Activity, CheckCircle2, AlertTriangle } from 'lucide-react';
import api from '../../api/axios';
import { safeFormat as format } from '../../utils/safeDate';
import { es } from 'date-fns/locale';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';

// Portal público (sin sesión): la empresa se identifica por `company_id`
// como query param en cada request (el backend también acepta el header
// X-Company-ID, usado por el resto de la app autenticada) -- ver
// companies.js /resolve, que lo resuelve por subdominio o, si la
// instalación tiene una sola empresa activa, por defecto a esa.
function createPortalApi(companyId) {
  const withCompany = (config = {}) => ({ ...config, params: { ...(config.params || {}), company_id: companyId } });
  return {
    get:  (url, config) => api.get(`/portal${url}`, withCompany(config)),
    post: (url, data, config) => api.post(`/portal${url}`, data, withCompany(config)),
  };
}

const STATUS_LABELS = { open: 'Abierto', pending: 'Pendiente', waiting_customer: 'Esperando respuesta', resolved: 'Resuelto', closed: 'Cerrado' };
const STATUS_COLORS = {
  open: 'bg-blue-100 text-blue-700',
  pending: 'bg-amber-100 text-amber-700',
  waiting_customer: 'bg-purple-100 text-purple-700',
  resolved: 'bg-green-100 text-green-700',
  closed: 'bg-gray-100 text-gray-600',
};

function NewTicketForm({ companyId, onSuccess, preselectedServiceId }) {
  const portalApi = createPortalApi(companyId);
  const [form, setForm] = useState({
    requester_name: '', requester_email: '', subject: '', description: '',
    priority: 'medium', service_id: preselectedServiceId || '',
  });
  const [customValues, setCustomValues] = useState({});
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const { data: services = [] } = useQuery({
    queryKey: ['portal-services', companyId],
    queryFn: () => portalApi.get('/services').then(r => r.data || []),
    enabled: !!companyId,
  });

  const { data: customFields = [] } = useQuery({
    queryKey: ['portal-custom-fields', companyId],
    queryFn: () => portalApi.get('/custom-fields').then(r => r.data || []),
    enabled: !!companyId,
  });

  const mutation = useMutation({
    mutationFn: (data) => portalApi.post('/tickets', { ...data, custom_fields: customValues }),
    onSuccess: (res) => {
      toast.success('Ticket creado. ¡Te contactaremos pronto!');
      onSuccess && onSuccess(res.data);
    },
    onError: e => toast.error(e.response?.data?.error || 'Error al crear ticket'),
  });

  return (
    <form onSubmit={e => { e.preventDefault(); mutation.mutate(form); }} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Tu nombre *</label>
          <input required className="input" value={form.requester_name} onChange={e => set('requester_name', e.target.value)} />
        </div>
        <div>
          <label className="label">Tu email *</label>
          <input required type="email" className="input" value={form.requester_email} onChange={e => set('requester_email', e.target.value)} />
        </div>
        <div className="col-span-2">
          <label className="label">Asunto *</label>
          <input required className="input" value={form.subject} onChange={e => set('subject', e.target.value)} placeholder="Describe brevemente tu problema" />
        </div>
        <div className="col-span-2">
          <label className="label">Descripción *</label>
          <textarea required rows={5} className="input resize-none" value={form.description} onChange={e => set('description', e.target.value)} placeholder="Describe tu problema con más detalle..." />
        </div>
        <div>
          <label className="label">Prioridad</label>
          <select className="input" value={form.priority} onChange={e => set('priority', e.target.value)}>
            <option value="low">Baja</option>
            <option value="medium">Media</option>
            <option value="high">Alta</option>
            <option value="urgent">Urgente</option>
          </select>
        </div>
        {services.length > 0 && (
          <div>
            <label className="label">Servicio</label>
            <select className="input" value={form.service_id} onChange={e => set('service_id', e.target.value)}>
              <option value="">No estoy seguro</option>
              {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}
        {customFields.map(f => (
          <div key={f.id} className={f.field_type === 'checkbox' ? 'flex items-end pb-0.5' : 'col-span-2'}>
            {f.field_type === 'checkbox' ? (
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={!!customValues[f.name]} onChange={e => setCustomValues(v => ({ ...v, [f.name]: e.target.checked }))} className="w-4 h-4 rounded" />
                <span className="text-sm text-gray-700">{f.label}</span>
              </label>
            ) : (
              <>
                <label className="label">{f.label}{f.required && ' *'}</label>
                {f.field_type === 'select' ? (
                  <select required={f.required} className="input" value={customValues[f.name] || ''} onChange={e => setCustomValues(v => ({ ...v, [f.name]: e.target.value }))}>
                    <option value="">Seleccionar...</option>
                    {(f.options || []).map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input
                    required={f.required}
                    type={f.field_type === 'number' ? 'number' : f.field_type === 'date' ? 'date' : 'text'}
                    className="input"
                    value={customValues[f.name] || ''}
                    onChange={e => setCustomValues(v => ({ ...v, [f.name]: e.target.value }))}
                  />
                )}
              </>
            )}
          </div>
        ))}
      </div>
      <button type="submit" disabled={mutation.isLoading} className="btn-primary w-full justify-center">
        {mutation.isLoading ? 'Enviando...' : 'Enviar solicitud'}
      </button>
    </form>
  );
}

function TicketLookup({ companyId }) {
  const portalApi = createPortalApi(companyId);
  const [query, setQuery] = useState('');
  const [email, setEmail] = useState('');
  const [ticket, setTicket] = useState(null);
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(false);
  const [replyLoading, setReplyLoading] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim() || !email.trim()) return;
    setLoading(true);
    try {
      const res = await portalApi.get(`/tickets/${query.trim()}`, { params: { email: email.trim() } });
      setTicket(res.data);
    } catch {
      toast.error('Ticket no encontrado. Revisá el número y el email.');
    } finally {
      setLoading(false);
    }
  };

  const handleReply = async () => {
    if (!reply.trim()) return;
    setReplyLoading(true);
    try {
      await portalApi.post(`/tickets/${ticket.id}/reply`, { content: reply, email });
      toast.success('Respuesta enviada');
      setReply('');
      const res = await portalApi.get(`/tickets/${ticket.ticket_number}`, { params: { email } });
      setTicket(res.data);
    } catch {
      toast.error('Error al enviar respuesta');
    } finally {
      setReplyLoading(false);
    }
  };

  if (ticket) {
    return (
      <div className="space-y-4">
        <button onClick={() => setTicket(null)} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft size={14} /> Buscar otro ticket
        </button>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-gray-400 font-mono mb-1">#{ticket.ticket_number}</p>
                <h2 className="text-lg font-semibold text-gray-900">{ticket.subject}</h2>
              </div>
              <span className={clsx('text-xs font-medium px-3 py-1 rounded-full', STATUS_COLORS[ticket.status])}>
                {STATUS_LABELS[ticket.status]}
              </span>
            </div>
          </div>
          <div className="p-6 space-y-4 max-h-96 overflow-y-auto">
            {(ticket.messages || []).filter(m => m.message_type !== 'internal_note' && m.message_type !== 'activity_log').map(msg => (
              <div key={msg.id} className={clsx('flex gap-3', msg.author_type === 'customer' ? 'flex-row-reverse' : 'flex-row')}>
                <div className="w-7 h-7 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                  {msg.author_name?.charAt(0) || '?'}
                </div>
                <div className={clsx('max-w-[75%] rounded-2xl px-4 py-2.5 text-sm',
                  msg.author_type === 'customer' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-800')}>
                  <p className="text-xs mb-1 opacity-70">{msg.author_name}</p>
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  <p className={clsx('text-xs mt-1 opacity-60')}>
                    {format(new Date(msg.created_at), "d MMM HH:mm", { locale: es })}
                  </p>
                </div>
              </div>
            ))}
          </div>
          {ticket.status !== 'closed' && ticket.status !== 'resolved' && (
            <div className="p-4 border-t border-gray-100">
              <textarea
                rows={3}
                className="input resize-none text-sm"
                placeholder="Añade información adicional..."
                value={reply}
                onChange={e => setReply(e.target.value)}
              />
              <div className="flex justify-end mt-2">
                <button onClick={handleReply} disabled={replyLoading || !reply.trim()} className="btn-primary h-8 text-sm">
                  <Send size={14} /> {replyLoading ? 'Enviando...' : 'Enviar'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSearch} className="space-y-4">
      <p className="text-sm text-gray-600">Ingresá el número de tu ticket y el email con el que lo creaste.</p>
      <div className="grid grid-cols-2 gap-3">
        <input
          className="input"
          placeholder="Nº de ticket, ej: 42"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        <input
          type="email"
          className="input"
          placeholder="tu@email.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />
      </div>
      <div className="flex gap-3">
        <button type="submit" disabled={loading || !query.trim() || !email.trim()} className="btn-primary px-6 w-full justify-center">
          {loading ? 'Buscando...' : <><Search size={16} /> Buscar</>}
        </button>
      </div>
    </form>
  );
}

function KnowledgeSection({ companyId }) {
  const portalApi = createPortalApi(companyId);
  const { data = [], isLoading } = useQuery({
    queryKey: ['portal-kb', companyId],
    queryFn: () => portalApi.get('/articles').then(r => r.data?.articles || r.data || []),
    enabled: !!companyId,
  });

  return (
    <div className="space-y-3">
      {isLoading && <p className="text-gray-400 text-center py-6">Cargando artículos...</p>}
      {data.slice(0, 6).map(a => (
        <a key={a.id} href={`/portal/kb/${a.slug}`}
          className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-100 hover:border-primary-200 hover:shadow-sm transition-all group">
          <div className="flex items-center gap-3">
            <BookOpen size={16} className="text-primary-500" />
            <div>
              <p className="text-sm font-medium text-gray-900 group-hover:text-primary-600">{a.title}</p>
              {a.category && <p className="text-xs text-gray-400">{a.category}</p>}
            </div>
          </div>
          <ChevronRight size={14} className="text-gray-300 group-hover:text-primary-400" />
        </a>
      ))}
      {!isLoading && data.length === 0 && (
        <p className="text-center text-gray-400 py-6">No hay artículos disponibles aún</p>
      )}
    </div>
  );
}

function ServicesSection({ companyId }) {
  const portalApi = createPortalApi(companyId);
  const { data = [], isLoading } = useQuery({
    queryKey: ['portal-services-list', companyId],
    queryFn: () => portalApi.get('/services').then(r => r.data || []),
    enabled: !!companyId,
  });

  return (
    <div className="space-y-3">
      {isLoading && <p className="text-gray-400 text-center py-6">Cargando...</p>}
      {data.map(s => (
        <div key={s.id} className="p-4 bg-white rounded-xl border border-gray-100">
          <p className="text-sm font-medium text-gray-900">{s.name}</p>
          {s.description && <p className="text-xs text-gray-500 mt-1">{s.description}</p>}
        </div>
      ))}
      {!isLoading && data.length === 0 && <p className="text-center text-gray-400 py-6">No hay servicios publicados</p>}
    </div>
  );
}

function FaqSection({ companyId }) {
  const portalApi = createPortalApi(companyId);
  const [open, setOpen] = useState(null);
  const { data = [], isLoading } = useQuery({
    queryKey: ['portal-faq', companyId],
    queryFn: () => portalApi.get('/faq').then(r => r.data || []),
    enabled: !!companyId,
  });

  return (
    <div className="space-y-2">
      {isLoading && <p className="text-gray-400 text-center py-6">Cargando...</p>}
      {data.map(a => (
        <div key={a.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <button
            onClick={() => setOpen(open === a.id ? null : a.id)}
            className="w-full flex items-center justify-between p-4 text-left"
          >
            <span className="text-sm font-medium text-gray-900">{a.title}</span>
            <ChevronRight size={14} className={clsx('text-gray-400 transition-transform', open === a.id && 'rotate-90')} />
          </button>
          {open === a.id && a.summary && (
            <p className="px-4 pb-4 text-sm text-gray-500">{a.summary}</p>
          )}
        </div>
      ))}
      {!isLoading && data.length === 0 && <p className="text-center text-gray-400 py-6">No hay preguntas frecuentes cargadas</p>}
    </div>
  );
}

function StatusSection({ companyId }) {
  const portalApi = createPortalApi(companyId);
  const { data, isLoading } = useQuery({
    queryKey: ['portal-status', companyId],
    queryFn: () => portalApi.get('/status').then(r => r.data),
    enabled: !!companyId,
  });

  if (isLoading) return <p className="text-gray-400 text-center py-6">Cargando...</p>;

  if (data?.operational) {
    return (
      <div className="flex flex-col items-center py-8 gap-2">
        <CheckCircle2 size={40} className="text-green-500" />
        <p className="font-medium text-gray-900">Todos los servicios operativos</p>
        <p className="text-sm text-gray-500">No hay incidentes activos en este momento.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {(data?.incidents || []).map(i => (
        <div key={i.id} className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex gap-3">
          <AlertTriangle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-900">{i.title}</p>
            {i.impact && <p className="text-xs text-amber-700 mt-1">{i.impact}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function CustomerPortal() {
  const [view, setView] = useState('home'); // home | new | lookup | kb | services | faq | status
  const [companyId, setCompanyId] = useState(null);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    api.get('/companies/resolve')
      .then(({ data }) => setCompanyId(data?.company?.id || null))
      .finally(() => setResolved(true));
  }, []);

  const VIEWS = [
    { id: 'new', label: 'Nuevo ticket', icon: Plus, desc: 'Crea una nueva solicitud de soporte' },
    { id: 'lookup', label: 'Estado de ticket', icon: Search, desc: 'Consulta el estado de tu solicitud' },
    { id: 'kb', label: 'Base de conocimiento', icon: BookOpen, desc: 'Artículos de ayuda y tutoriales' },
    { id: 'faq', label: 'Preguntas frecuentes', icon: HelpCircle, desc: 'Respuestas rápidas a dudas comunes' },
    { id: 'services', label: 'Catálogo de servicios', icon: LayoutGrid, desc: 'Servicios de soporte disponibles' },
    { id: 'status', label: 'Estado de servicios', icon: Activity, desc: 'Incidentes activos y disponibilidad' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-800 to-indigo-900">
      {/* Header */}
      <div className="text-center py-12 px-4">
        <div className="inline-flex items-center justify-center w-14 h-14 bg-white/10 backdrop-blur rounded-2xl mb-4">
          <Ticket size={28} className="text-white" />
        </div>
        <h1 className="text-3xl font-bold text-white">Portal de Soporte</h1>
        <p className="text-primary-200 mt-2">¿Cómo podemos ayudarte hoy?</p>
      </div>

      <div className="max-w-2xl mx-auto px-4 pb-12">
        {resolved && !companyId && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-xl p-4 mb-4">
            No se pudo identificar la empresa de soporte para esta URL. Contactá al administrador.
          </div>
        )}

        {view === 'home' && (
          <div className="space-y-3">
            {VIEWS.map(v => (
              <button
                key={v.id}
                onClick={() => setView(v.id)}
                className="w-full flex items-center gap-4 p-5 bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all text-left group"
              >
                <div className="w-12 h-12 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0 group-hover:bg-primary-100 transition-colors">
                  <v.icon size={22} className="text-primary-600" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">{v.label}</p>
                  <p className="text-sm text-gray-500 mt-0.5">{v.desc}</p>
                </div>
                <ChevronRight size={18} className="text-gray-300 group-hover:text-primary-400 transition-colors" />
              </button>
            ))}
          </div>
        )}

        {view !== 'home' && (
          <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
              <button onClick={() => setView('home')} className="text-gray-400 hover:text-gray-600">
                <ArrowLeft size={16} />
              </button>
              <h2 className="font-semibold text-gray-900">
                {VIEWS.find(v => v.id === view)?.label}
              </h2>
            </div>
            <div className="p-6">
              {view === 'new' && <NewTicketForm companyId={companyId} onSuccess={() => setTimeout(() => setView('home'), 2000)} />}
              {view === 'lookup' && <TicketLookup companyId={companyId} />}
              {view === 'kb' && <KnowledgeSection companyId={companyId} />}
              {view === 'faq' && <FaqSection companyId={companyId} />}
              {view === 'services' && <ServicesSection companyId={companyId} />}
              {view === 'status' && <StatusSection companyId={companyId} />}
            </div>
          </div>
        )}

        <p className="text-center text-primary-300/60 text-xs mt-8">
          ¿Eres un agente? <a href="/login" className="text-primary-200 hover:text-white underline">Inicia sesión aquí</a>
        </p>
      </div>
    </div>
  );
}
