import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, User, Tag, Clock, AlertTriangle, Paperclip,
  Send, Lock, ChevronDown, MoreVertical, RefreshCw, ExternalLink,
} from 'lucide-react';
import api from '../../api/axios';
import { useAuthStore } from '../../store/authStore';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import DOMPurify from 'dompurify';
import { socket } from '../../components/Layout';

const STATUS_LABELS = {
  open: 'Abierto', pending: 'Pendiente',
  waiting_customer: 'Esperando cliente', resolved: 'Resuelto', closed: 'Cerrado',
};
const PRIORITY_LABELS = { low: 'Baja', medium: 'Media', high: 'Alta', urgent: 'Urgente' };

function Avatar({ name, size = 8 }) {
  return (
    <div className={`w-${size} h-${size} rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold flex-shrink-0`}>
      {name?.charAt(0)?.toUpperCase() || '?'}
    </div>
  );
}

function MessageBubble({ msg }) {
  const isInternal = msg.message_type === 'internal_note';
  const isActivity = msg.message_type === 'activity_log';
  const isAgent = msg.author_type === 'agent';

  if (isActivity) {
    return (
      <div className="flex justify-center">
        <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
          {msg.content}
          <span className="ml-2 text-gray-300">
            {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true, locale: es })}
          </span>
        </span>
      </div>
    );
  }

  return (
    <div className={clsx(
      'flex gap-3',
      isAgent && !isInternal ? 'flex-row-reverse' : 'flex-row'
    )}>
      <Avatar name={msg.author_name || msg.user?.name} />
      <div className={clsx(
        'max-w-[70%] space-y-1',
        isAgent && !isInternal ? 'items-end' : 'items-start'
      )}>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-700">{msg.author_name || msg.user?.name}</span>
          {isInternal && (
            <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
              <Lock size={10} /> Nota interna
            </span>
          )}
          <span className="text-xs text-gray-400">
            {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true, locale: es })}
          </span>
        </div>
        <div className={clsx(
          'rounded-2xl px-4 py-2.5 text-sm',
          isInternal
            ? 'bg-amber-50 border border-amber-200 text-amber-900'
            : isAgent
            ? 'bg-primary-600 text-white'
            : 'bg-white border border-gray-200 text-gray-800'
        )}>
          {msg.content_html ? (
            // Defensa en profundidad: el backend ya sanitiza content_html al
            // guardarlo, pero se vuelve a sanear en el cliente por si el HTML
            // llega por otra vía (versión de API vieja, dato ya en la base).
            <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(msg.content_html) }} className="prose prose-sm max-w-none" />
          ) : (
            <p className="whitespace-pre-wrap">{msg.content}</p>
          )}
          {msg.attachments?.length > 0 && (
            <div className="mt-2 space-y-1">
              {msg.attachments.map((a, i) => (
                <a key={i} href={a.url} target="_blank" rel="noopener noreferrer"
                  className={clsx('flex items-center gap-1 text-xs underline', isAgent ? 'text-primary-200' : 'text-primary-600')}>
                  <Paperclip size={10} /> {a.filename || 'Adjunto'}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TicketDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const [reply, setReply] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [files, setFiles] = useState([]);
  const [showAssign, setShowAssign] = useState(false);

  const { data: ticket, isLoading } = useQuery({
    queryKey: ['ticket', id],
    queryFn: () => api.get(`/tickets/${id}`).then(r => r.data),
  });

  const { data: messages = [] } = useQuery({
    queryKey: ['ticket-messages', id],
    queryFn: () => api.get(`/tickets/${id}/messages`).then(r => r.data),
    refetchInterval: 30000,
  });

  const { data: agents = [] } = useQuery({
    queryKey: ['agents-list'],
    queryFn: () => api.get('/agents', { params: { limit: 100 } }).then(r => r.data?.agents || []),
  });

  // Join socket room
  useEffect(() => {
    if (socket && id) {
      socket.emit('join:ticket', id);
      socket.on('ticket:message', () => {
        queryClient.invalidateQueries(['ticket-messages', id]);
      });
      socket.on('ticket:updated', () => {
        queryClient.invalidateQueries(['ticket', id]);
      });
      return () => {
        socket.emit('leave:ticket', id);
        socket.off('ticket:message');
        socket.off('ticket:updated');
      };
    }
  }, [id, socket]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const updateMutation = useMutation({
    mutationFn: (updates) => api.put(`/tickets/${id}`, updates),
    onSuccess: () => {
      queryClient.invalidateQueries(['ticket', id]);
      toast.success('Ticket actualizado');
    },
  });

  const replyMutation = useMutation({
    mutationFn: (formData) => api.post(`/tickets/${id}/messages`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
    onSuccess: () => {
      queryClient.invalidateQueries(['ticket-messages', id]);
      queryClient.invalidateQueries(['ticket', id]);
      setReply('');
      setFiles([]);
    },
    onError: () => toast.error('Error al enviar respuesta'),
  });

  const handleSend = () => {
    if (!reply.trim() && files.length === 0) return;
    const fd = new FormData();
    fd.append('content', reply);
    fd.append('message_type', isInternal ? 'internal_note' : 'reply');
    files.forEach(f => fd.append('files', f));
    replyMutation.mutate(fd);
  };

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <RefreshCw className="animate-spin text-gray-400" size={24} />
    </div>
  );
  if (!ticket) return <div className="text-center text-gray-500 py-12">Ticket no encontrado</div>;

  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-120px)]">
      {/* Header */}
      <div className="flex items-start gap-4 mb-4">
        <button onClick={() => navigate(-1)} className="btn-ghost p-2 mt-1">
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-gray-400 font-mono">#{ticket.ticket_number}</span>
            <span className={clsx('badge', {
              'badge-open': ticket.status === 'open',
              'badge-pending': ticket.status === 'pending',
              'badge-resolved': ticket.status === 'resolved',
              'badge-closed': ticket.status === 'closed',
            })}>{STATUS_LABELS[ticket.status]}</span>
            <span className={clsx('badge', {
              'badge-urgent': ticket.priority === 'urgent',
              'badge-high': ticket.priority === 'high',
              'badge-medium': ticket.priority === 'medium',
              'badge-low': ticket.priority === 'low',
            })}>{PRIORITY_LABELS[ticket.priority]}</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900 truncate">{ticket.subject}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {ticket.requester_name} · {ticket.source} ·{' '}
            {format(new Date(ticket.created_at), "d 'de' MMMM yyyy 'a las' HH:mm", { locale: es })}
          </p>
        </div>

        {/* Quick actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <select
            value={ticket.status}
            onChange={e => updateMutation.mutate({ status: e.target.value })}
            className="input h-8 text-sm"
          >
            {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select
            value={ticket.priority}
            onChange={e => updateMutation.mutate({ priority: e.target.value })}
            className="input h-8 text-sm"
          >
            {Object.entries(PRIORITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>

      <div className="flex gap-4 flex-1 overflow-hidden">
        {/* Messages panel */}
        <div className="flex-1 flex flex-col card overflow-hidden">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)}
            <div ref={messagesEndRef} />
          </div>

          {/* Reply composer */}
          <div className="border-t border-gray-100 p-4 space-y-3">
            {/* Toggle internal/reply */}
            <div className="flex gap-2">
              <button
                onClick={() => setIsInternal(false)}
                className={clsx('px-3 py-1 rounded-lg text-sm font-medium transition-colors',
                  !isInternal ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                )}
              >
                Responder
              </button>
              <button
                onClick={() => setIsInternal(true)}
                className={clsx('flex items-center gap-1 px-3 py-1 rounded-lg text-sm font-medium transition-colors',
                  isInternal ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                )}
              >
                <Lock size={12} /> Nota interna
              </button>
            </div>

            <textarea
              value={reply}
              onChange={e => setReply(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSend();
              }}
              placeholder={isInternal ? 'Nota interna (solo visible para agentes)...' : 'Escribe tu respuesta...'}
              rows={4}
              className={clsx(
                'input resize-none text-sm',
                isInternal && 'border-amber-300 bg-amber-50/50'
              )}
            />

            {/* Attachments preview */}
            {files.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded text-xs">
                    <Paperclip size={10} />
                    <span className="max-w-24 truncate">{f.name}</span>
                    <button onClick={() => setFiles(fs => fs.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-500">×</button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="btn-ghost h-8 text-sm"
              >
                <Paperclip size={14} /> Adjuntar
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                hidden
                onChange={e => setFiles(Array.from(e.target.files))}
              />
              <button
                onClick={handleSend}
                disabled={replyMutation.isLoading || (!reply.trim() && files.length === 0)}
                className="btn-primary h-8 text-sm disabled:opacity-40"
              >
                <Send size={14} />
                {replyMutation.isLoading ? 'Enviando...' : 'Enviar'}
                <span className="text-xs opacity-60 ml-1">Ctrl+Enter</span>
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-64 flex-shrink-0 space-y-3">
          {/* Requester */}
          <div className="card p-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <User size={12} /> Solicitante
            </h3>
            <div className="flex items-center gap-2 mb-2">
              <Avatar name={ticket.requester_name} />
              <div>
                <p className="text-sm font-medium text-gray-900">{ticket.requester_name}</p>
                <p className="text-xs text-gray-500">{ticket.requester_email}</p>
              </div>
            </div>
            {ticket.requester_phone && (
              <p className="text-xs text-gray-500">{ticket.requester_phone}</p>
            )}
          </div>

          {/* Assignment */}
          <div className="card p-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Asignación</h3>
            <div className="space-y-2">
              <div>
                <label className="text-xs text-gray-500">Agente</label>
                <select
                  className="input h-8 text-sm mt-1"
                  value={ticket.agent_id || ''}
                  onChange={e => updateMutation.mutate({ agent_id: e.target.value || null })}
                >
                  <option value="">Sin asignar</option>
                  {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* SLA */}
          <div className="card p-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <Clock size={12} /> SLA
            </h3>
            <div className="space-y-2 text-xs">
              {ticket.first_response_due_at && (
                <div>
                  <p className="text-gray-500">Primera respuesta</p>
                  <p className={clsx('font-medium', new Date(ticket.first_response_due_at) < new Date() ? 'text-red-600' : 'text-gray-900')}>
                    {format(new Date(ticket.first_response_due_at), "d MMM HH:mm", { locale: es })}
                  </p>
                </div>
              )}
              {ticket.resolution_due_at && (
                <div>
                  <p className="text-gray-500">Resolución</p>
                  <p className={clsx('font-medium', new Date(ticket.resolution_due_at) < new Date() ? 'text-red-600' : 'text-gray-900')}>
                    {format(new Date(ticket.resolution_due_at), "d MMM HH:mm", { locale: es })}
                  </p>
                </div>
              )}
              {ticket.sla_status && (
                <span className={clsx(
                  'inline-block px-2 py-0.5 rounded-full text-xs font-medium',
                  ticket.sla_status === 'breached' ? 'bg-red-100 text-red-700' :
                  ticket.sla_status === 'warning' ? 'bg-orange-100 text-orange-700' :
                  'bg-green-100 text-green-700'
                )}>
                  {ticket.sla_status === 'breached' ? 'Incumplido' :
                   ticket.sla_status === 'warning' ? 'En riesgo' : 'Cumplido'}
                </span>
              )}
            </div>
          </div>

          {/* Details */}
          <div className="card p-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Detalles</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Fuente</span>
                <span className="font-medium capitalize">{ticket.source}</span>
              </div>
              {ticket.category && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Categoría</span>
                  <span className="font-medium">{ticket.category.name}</span>
                </div>
              )}
              {ticket.branch && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Sucursal</span>
                  <span className="font-medium">{ticket.branch.name}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500">Respuestas</span>
                <span className="font-medium">{ticket.reply_count}</span>
              </div>
            </div>
          </div>

          {/* Tags */}
          {ticket.tags?.length > 0 && (
            <div className="card p-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <Tag size={12} /> Etiquetas
              </h3>
              <div className="flex flex-wrap gap-1">
                {ticket.tags.map(t => (
                  <span key={t.id} className="px-2 py-0.5 rounded-full text-xs" style={{ backgroundColor: t.color + '20', color: t.color }}>
                    {t.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
