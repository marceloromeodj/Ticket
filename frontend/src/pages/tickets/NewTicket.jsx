import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, Paperclip, X } from 'lucide-react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

export default function NewTicket() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    subject: '', description: '', priority: 'medium', type: 'question',
    requester_name: '', requester_email: '', requester_phone: '',
    category_id: '', agent_id: '', service_id: '', source: 'web',
  });
  const [files, setFiles] = useState([]);

  const { data: agents = [] } = useQuery({
    queryKey: ['agents-list'],
    queryFn: () => api.get('/agents', { params: { limit: 100 } }).then(r => r.data?.agents || []),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get('/categories').then(r => r.data || []),
  });

  const { data: services = [] } = useQuery({
    queryKey: ['services'],
    queryFn: () => api.get('/services').then(r => r.data?.services || []),
  });

  const createMutation = useMutation({
    mutationFn: (fd) => api.post('/tickets', fd, { headers: { 'Content-Type': 'multipart/form-data' } }),
    onSuccess: (res) => {
      toast.success('Ticket creado');
      navigate(`/tickets/${res.data.id}`);
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Error al crear ticket'),
  });

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleSubmit = (e) => {
    e.preventDefault();
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => { if (v) fd.append(k, v); });
    files.forEach(f => fd.append('files', f));
    createMutation.mutate(fd);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="btn-ghost p-2">
          <ArrowLeft size={16} />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Nuevo Ticket</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="card p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Información del ticket</h2>

          <div>
            <label className="label">Asunto *</label>
            <input
              required
              className="input"
              placeholder="Resumen breve del problema"
              value={form.subject}
              onChange={e => set('subject', e.target.value)}
            />
          </div>

          <div>
            <label className="label">Descripción *</label>
            <textarea
              required
              rows={5}
              className="input resize-none"
              placeholder="Describe el problema con el mayor detalle posible..."
              value={form.description}
              onChange={e => set('description', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Prioridad</label>
              <select className="input" value={form.priority} onChange={e => set('priority', e.target.value)}>
                <option value="low">Baja</option>
                <option value="medium">Media</option>
                <option value="high">Alta</option>
                <option value="urgent">Urgente</option>
              </select>
            </div>
            <div>
              <label className="label">Tipo</label>
              <select className="input" value={form.type} onChange={e => set('type', e.target.value)}>
                <option value="question">Pregunta</option>
                <option value="incident">Incidente</option>
                <option value="problem">Problema</option>
                <option value="task">Tarea</option>
                <option value="feature_request">Solicitud de función</option>
              </select>
            </div>
            <div>
              <label className="label">Canal</label>
              <select className="input" value={form.source} onChange={e => set('source', e.target.value)}>
                <option value="web">Web</option>
                <option value="email">Email</option>
                <option value="phone">Teléfono</option>
                <option value="chat">Chat</option>
                <option value="whatsapp">WhatsApp</option>
              </select>
            </div>
            <div>
              <label className="label">Categoría</label>
              <select className="input" value={form.category_id} onChange={e => set('category_id', e.target.value)}>
                <option value="">Sin categoría</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Servicio</label>
              <select className="input" value={form.service_id} onChange={e => set('service_id', e.target.value)}>
                <option value="">Sin servicio</option>
                {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>

          {/* Attachments */}
          <div>
            <label className="label">Archivos adjuntos</label>
            <label className="flex items-center gap-2 cursor-pointer w-fit btn-ghost text-sm">
              <Paperclip size={14} />
              Adjuntar archivos
              <input type="file" multiple hidden onChange={e => setFiles(prev => [...prev, ...Array.from(e.target.files)])} />
            </label>
            {files.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded text-xs">
                    {f.name}
                    <button type="button" onClick={() => setFiles(fs => fs.filter((_, j) => j !== i))}>
                      <X size={10} className="text-gray-400 hover:text-red-500" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="card p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Información del solicitante</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Nombre *</label>
              <input
                required
                className="input"
                placeholder="Nombre completo"
                value={form.requester_name}
                onChange={e => set('requester_name', e.target.value)}
              />
            </div>
            <div>
              <label className="label">Email *</label>
              <input
                required
                type="email"
                className="input"
                placeholder="correo@empresa.com"
                value={form.requester_email}
                onChange={e => set('requester_email', e.target.value)}
              />
            </div>
            <div>
              <label className="label">Teléfono</label>
              <input
                className="input"
                placeholder="+54 11 1234-5678"
                value={form.requester_phone}
                onChange={e => set('requester_phone', e.target.value)}
              />
            </div>
            <div>
              <label className="label">Asignar agente</label>
              <select className="input" value={form.agent_id} onChange={e => set('agent_id', e.target.value)}>
                <option value="">Sin asignar / Auto</option>
                {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="flex gap-3 justify-end">
          <button type="button" onClick={() => navigate(-1)} className="btn-ghost">
            Cancelar
          </button>
          <button type="submit" disabled={createMutation.isLoading} className="btn-primary">
            {createMutation.isLoading ? 'Creando...' : 'Crear Ticket'}
          </button>
        </div>
      </form>
    </div>
  );
}
