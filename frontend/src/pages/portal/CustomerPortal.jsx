import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Ticket, Search, Plus, Send, MessageSquare, BookOpen, ChevronRight, ArrowLeft } from 'lucide-react';
import api from '../../api/axios';
import { safeFormat as format } from '../../utils/safeDate';
import { es } from 'date-fns/locale';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';

// Portal uses public API without auth
const portalApi = {
  get: (url, config) => api.get(`/portal${url}`, config),
  post: (url, data) => api.post(`/portal${url}`, data),
};

const STATUS_LABELS = { open: 'Abierto', pending: 'Pendiente', waiting_customer: 'Esperando respuesta', resolved: 'Resuelto', closed: 'Cerrado' };
const STATUS_COLORS = {
  open: 'bg-blue-100 text-blue-700',
  pending: 'bg-amber-100 text-amber-700',
  waiting_customer: 'bg-purple-100 text-purple-700',
  resolved: 'bg-green-100 text-green-700',
  closed: 'bg-gray-100 text-gray-600',
};

function NewTicketForm({ onSuccess }) {
  const [form, setForm] = useState({ requester_name: '', requester_email: '', subject: '', description: '', priority: 'medium' });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const mutation = useMutation({
    mutationFn: (data) => portalApi.post('/tickets', data),
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
      </div>
      <button type="submit" disabled={mutation.isLoading} className="btn-primary w-full justify-center">
        {mutation.isLoading ? 'Enviando...' : 'Enviar solicitud'}
      </button>
    </form>
  );
}

function TicketLookup() {
  const [query, setQuery] = useState('');
  const [ticket, setTicket] = useState(null);
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(false);
  const [replyLoading, setReplyLoading] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await portalApi.get(`/tickets/${query.trim()}`);
      setTicket(res.data);
    } catch {
      toast.error('Ticket no encontrado');
    } finally {
      setLoading(false);
    }
  };

  const handleReply = async () => {
    if (!reply.trim()) return;
    setReplyLoading(true);
    try {
      await portalApi.post(`/tickets/${ticket.id}/reply`, { content: reply });
      toast.success('Respuesta enviada');
      setReply('');
      const res = await portalApi.get(`/tickets/${ticket.ticket_number}`);
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
      <p className="text-sm text-gray-600">Ingresa tu número de ticket para ver el estado y responder.</p>
      <div className="flex gap-3">
        <input
          className="input flex-1"
          placeholder="ej: TKT-0042"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        <button type="submit" disabled={loading} className="btn-primary px-6">
          {loading ? 'Buscando...' : <><Search size={16} /> Buscar</>}
        </button>
      </div>
    </form>
  );
}

function KnowledgeSection() {
  const { data = [], isLoading } = useQuery({
    queryKey: ['portal-kb'],
    queryFn: () => portalApi.get('/articles').then(r => r.data?.articles || r.data || []),
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

export default function CustomerPortal() {
  const [view, setView] = useState('home'); // home | new | lookup | kb

  const VIEWS = [
    { id: 'new', label: 'Nuevo ticket', icon: Plus, desc: 'Crea una nueva solicitud de soporte' },
    { id: 'lookup', label: 'Estado de ticket', icon: Search, desc: 'Consulta el estado de tu solicitud' },
    { id: 'kb', label: 'Base de conocimiento', icon: BookOpen, desc: 'Artículos de ayuda y tutoriales' },
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
              {view === 'new' && <NewTicketForm onSuccess={() => setTimeout(() => setView('home'), 2000)} />}
              {view === 'lookup' && <TicketLookup />}
              {view === 'kb' && <KnowledgeSection />}
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
