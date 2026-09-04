import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, X, ThumbsUp, ThumbsDown, BookOpen, Search, Eye } from 'lucide-react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';
import { safeFormat as format } from '../../utils/safeDate';
import { es } from 'date-fns/locale';

function ArticleModal({ article, onClose }) {
  const queryClient = useQueryClient();
  const isEdit = !!article?.id;
  const [form, setForm] = useState({
    title: article?.title || '',
    content: article?.content || '',
    category: article?.category || '',
    status: article?.status || 'draft',
    is_public: article?.is_public ?? true,
  });

  const mutation = useMutation({
    mutationFn: (data) => isEdit ? api.put(`/knowledge/${article.id}`, data) : api.post('/knowledge', data),
    onSuccess: () => {
      queryClient.invalidateQueries(['knowledge']);
      toast.success(isEdit ? 'Artículo actualizado' : 'Artículo creado');
      onClose();
    },
    onError: e => toast.error(e.response?.data?.error || 'Error'),
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">{isEdit ? 'Editar artículo' : 'Nuevo artículo'}</h2>
          <button onClick={onClose}><X size={18} className="text-gray-400 hover:text-gray-600" /></button>
        </div>
        <form onSubmit={e => { e.preventDefault(); mutation.mutate(form); }} className="p-6 space-y-4">
          <div>
            <label className="label">Título *</label>
            <input required className="input" value={form.title} onChange={e => set('title', e.target.value)} />
          </div>
          <div>
            <label className="label">Categoría</label>
            <input className="input" value={form.category} onChange={e => set('category', e.target.value)} placeholder="ej: Facturación, Técnico, General" />
          </div>
          <div>
            <label className="label">Contenido *</label>
            <textarea
              required
              rows={12}
              className="input resize-y font-mono text-sm"
              value={form.content}
              onChange={e => set('content', e.target.value)}
              placeholder="Escribe el contenido del artículo (HTML o Markdown)..."
            />
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="label">Estado</label>
              <select className="input" value={form.status} onChange={e => set('status', e.target.value)}>
                <option value="draft">Borrador</option>
                <option value="published">Publicado</option>
                <option value="archived">Archivado</option>
              </select>
            </div>
            <div className="flex items-end pb-0.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_public}
                  onChange={e => set('is_public', e.target.checked)}
                  className="w-4 h-4 rounded"
                />
                <span className="text-sm text-gray-700">Visible en portal público</span>
              </label>
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

export default function KnowledgeBase() {
  const [modal, setModal] = useState(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const queryClient = useQueryClient();

  const { data = [], isLoading } = useQuery({
    queryKey: ['knowledge', search, category],
    queryFn: () => api.get('/knowledge', { params: { search, category, limit: 100 } }).then(r => r.data?.articles || r.data || []),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/knowledge/${id}`),
    onSuccess: () => { queryClient.invalidateQueries(['knowledge']); toast.success('Artículo eliminado'); },
  });

  const categories = [...new Set(data.map(a => a.category).filter(Boolean))];

  const STATUS_STYLES = {
    published: 'bg-green-100 text-green-700',
    draft: 'bg-gray-100 text-gray-600',
    archived: 'bg-orange-100 text-orange-700',
  };
  const STATUS_LABELS = { published: 'Publicado', draft: 'Borrador', archived: 'Archivado' };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Base de Conocimiento</h1>
        <button onClick={() => setModal({})} className="btn-primary">
          <Plus size={16} /> Nuevo Artículo
        </button>
      </div>

      {/* Filters */}
      <div className="card p-3 flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            placeholder="Buscar artículos..."
            className="input pl-8 h-8 text-sm"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select className="input h-8 text-sm w-40" value={category} onChange={e => setCategory(e.target.value)}>
          <option value="">Todas las categorías</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {isLoading && <div className="col-span-3 text-center text-gray-400 py-10">Cargando...</div>}
        {data.map(a => (
          <div key={a.id} className="card p-5 flex flex-col space-y-3 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <BookOpen size={16} className="text-primary-500 flex-shrink-0 mt-0.5" />
                <h3 className="font-semibold text-gray-900 text-sm line-clamp-2">{a.title}</h3>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <button onClick={() => setModal(a)} className="btn-ghost p-1.5">
                  <Pencil size={13} />
                </button>
                <button
                  onClick={() => { if (confirm('¿Eliminar artículo?')) deleteMutation.mutate(a.id); }}
                  className="btn-ghost p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>

            <p className="text-xs text-gray-500 line-clamp-3 flex-1">
              {a.content?.replace(/<[^>]+>/g, '').slice(0, 150)}...
            </p>

            <div className="flex items-center gap-2 flex-wrap">
              {a.category && (
                <span className="text-xs bg-primary-50 text-primary-600 px-2 py-0.5 rounded-full">
                  {a.category}
                </span>
              )}
              <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', STATUS_STYLES[a.status] || STATUS_STYLES.draft)}>
                {STATUS_LABELS[a.status] || a.status}
              </span>
              {a.is_public && (
                <span className="text-xs flex items-center gap-1 text-gray-400">
                  <Eye size={10} /> Público
                </span>
              )}
            </div>

            <div className="flex items-center justify-between text-xs text-gray-400 pt-2 border-t border-gray-100">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <ThumbsUp size={11} className="text-green-500" /> {a.upvotes || 0}
                </span>
                <span className="flex items-center gap-1">
                  <ThumbsDown size={11} className="text-red-400" /> {a.downvotes || 0}
                </span>
                <span>{a.view_count || 0} vistas</span>
              </div>
              {a.updated_at && (
                <span>{format(new Date(a.updated_at), 'd MMM yy', { locale: es })}</span>
              )}
            </div>
          </div>
        ))}
        {!isLoading && data.length === 0 && (
          <div className="col-span-3 text-center py-16 text-gray-400">
            <BookOpen size={40} className="mx-auto mb-3 opacity-30" />
            <p>No hay artículos. ¡Crea el primero!</p>
          </div>
        )}
      </div>

      {modal !== null && <ArticleModal article={modal} onClose={() => setModal(null)} />}
    </div>
  );
}
