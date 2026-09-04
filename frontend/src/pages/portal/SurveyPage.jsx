import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Star, Ticket } from 'lucide-react';
import api from '../../api/axios';
import { clsx } from 'clsx';

const portalApi = {
  get: (url) => api.get(`/portal${url}`),
  post: (url, data) => api.post(`/portal${url}`, data),
};

export default function SurveyPage() {
  const { token } = useParams();
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [done, setDone] = useState(false);

  const { data: survey, isLoading, error } = useQuery({
    queryKey: ['survey', token],
    queryFn: () => portalApi.get(`/survey/${token}`).then(r => r.data),
    retry: false,
  });

  const mutation = useMutation({
    mutationFn: () => portalApi.post(`/survey/${token}`, { rating, comment }),
    onSuccess: () => setDone(true),
  });

  const shell = (children) => (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-800 to-indigo-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-white/10 backdrop-blur rounded-2xl mb-3">
            <Ticket size={26} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">¿Cómo fue tu experiencia?</h1>
        </div>
        <div className="bg-white rounded-2xl shadow-2xl p-8">{children}</div>
      </div>
    </div>
  );

  if (isLoading) return shell(<p className="text-center text-gray-400">Cargando...</p>);
  if (error) return shell(<p className="text-center text-red-500">Este enlace de encuesta no es válido o ya expiró.</p>);

  if (done || survey?.already_responded) {
    return shell(
      <div className="text-center space-y-2">
        <p className="text-4xl">🙏</p>
        <p className="font-semibold text-gray-900">¡Gracias por tu respuesta!</p>
        <p className="text-sm text-gray-500">Tu opinión nos ayuda a mejorar el soporte.</p>
      </div>
    );
  }

  return shell(
    <div className="space-y-5">
      <div className="text-center">
        <p className="text-xs text-gray-400 font-mono">Ticket #{survey.ticket_number}</p>
        <p className="text-sm font-medium text-gray-700 mt-1">{survey.subject}</p>
      </div>

      <div className="flex justify-center gap-1">
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            onMouseEnter={() => setHoverRating(n)}
            onMouseLeave={() => setHoverRating(0)}
            className="p-1"
          >
            <Star
              size={36}
              className={clsx(
                'transition-colors',
                (hoverRating || rating) >= n ? 'fill-amber-400 text-amber-400' : 'text-gray-200'
              )}
            />
          </button>
        ))}
      </div>

      <textarea
        className="input resize-none text-sm"
        rows={3}
        placeholder="¿Algo que quieras contarnos? (opcional)"
        value={comment}
        onChange={e => setComment(e.target.value)}
      />

      <button
        onClick={() => mutation.mutate()}
        disabled={rating === 0 || mutation.isLoading}
        className="btn-primary w-full justify-center disabled:opacity-40"
      >
        {mutation.isLoading ? 'Enviando...' : 'Enviar calificación'}
      </button>
    </div>
  );
}
