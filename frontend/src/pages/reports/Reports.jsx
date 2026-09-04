import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { Star } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import api from '../../api/axios';
import { clsx } from 'clsx';

const COLORS = ['#6366f1','#f59e0b','#10b981','#6b7280','#ef4444','#3b82f6'];
const STATUS_LABELS = { open: 'Abiertos', pending: 'Pendientes', resolved: 'Resueltos', closed: 'Cerrados', waiting_customer: 'Esperando' };

const TABS = ['Resumen', 'Por Período', 'Agentes', 'Por Categoría', 'SLA', 'Satisfacción'];

export default function Reports() {
  const [tab, setTab] = useState('Resumen');
  const [groupBy, setGroupBy] = useState('day');

  const { data: overview } = useQuery({
    queryKey: ['overview'],
    queryFn: () => api.get('/reports/overview').then(r => r.data),
  });

  const { data: byDate } = useQuery({
    queryKey: ['tickets-by-date', groupBy],
    queryFn: () => api.get(`/reports/tickets-by-date?group_by=${groupBy}`).then(r => r.data),
  });

  const { data: agentPerf } = useQuery({
    queryKey: ['agent-performance'],
    queryFn: () => api.get('/reports/agent-performance').then(r => r.data),
  });

  const { data: byCategory } = useQuery({
    queryKey: ['by-category'],
    queryFn: () => api.get('/reports/by-category').then(r => r.data),
  });

  const { data: slaReport } = useQuery({
    queryKey: ['sla-report'],
    queryFn: () => api.get('/reports/sla').then(r => r.data),
  });

  const { data: satisfaction } = useQuery({
    queryKey: ['satisfaction-report'],
    queryFn: () => api.get('/reports/satisfaction').then(r => r.data),
  });

  const pieData = overview ? Object.entries(overview.by_status || {}).map(([k, v]) => ({
    name: STATUS_LABELS[k] || k, value: v,
  })) : [];

  const barData = (() => {
    if (!byDate) return [];
    const grouped = {};
    byDate.forEach(row => {
      const d = row.date;
      if (!grouped[d]) grouped[d] = { date: d, open: 0, resolved: 0, pending: 0 };
      if (row.status === 'open')     grouped[d].open     += parseInt(row.count);
      if (row.status === 'resolved') grouped[d].resolved += parseInt(row.count);
      if (row.status === 'pending')  grouped[d].pending  += parseInt(row.count);
    });
    return Object.values(grouped).slice(-30).map(r => ({
      ...r,
      date: (() => {
        try { return format(new Date(r.date), groupBy === 'month' ? 'MMM yy' : 'd MMM', { locale: es }); }
        catch { return r.date; }
      })(),
    }));
  })();

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-gray-900">Reportes</h1>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={clsx(
              'px-4 py-2 text-sm font-medium transition-colors -mb-px border-b-2',
              tab === t
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Resumen */}
      {tab === 'Resumen' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total Tickets', value: overview?.total, color: 'border-primary-500' },
              { label: 'Abiertos', value: overview?.by_status?.open, color: 'border-blue-500' },
              { label: 'Urgentes', value: overview?.urgent_open, color: 'border-red-500' },
              { label: 'SLA Incumplidos', value: overview?.sla_breached, color: 'border-orange-500' },
            ].map(c => (
              <div key={c.label} className={`card p-5 border-l-4 ${c.color}`}>
                <p className="text-sm text-gray-500">{c.label}</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{c.value ?? '—'}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="card p-5">
              <p className="text-sm text-gray-500">Tiempo prom. 1ª respuesta</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {Math.round((overview?.avg_first_response_minutes || 0) / 60)}h {(overview?.avg_first_response_minutes || 0) % 60}m
              </p>
            </div>
            <div className="card p-5">
              <p className="text-sm text-gray-500">Tiempo prom. resolución</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {Math.round((overview?.avg_resolution_minutes || 0) / 60)}h {(overview?.avg_resolution_minutes || 0) % 60}m
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-6">
            <div className="card p-5 col-span-2">
              <h2 className="font-semibold text-gray-900 mb-4">Tickets por estado</h2>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} dataKey="value">
                    {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="card p-5">
              <h2 className="font-semibold text-gray-900 mb-4">Distribución</h2>
              <div className="space-y-3">
                {pieData.map((d, i) => (
                  <div key={d.name}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">{d.name}</span>
                      <span className="font-medium">{d.value}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div
                        className="h-1.5 rounded-full"
                        style={{ width: `${overview?.total ? (d.value / overview.total) * 100 : 0}%`, backgroundColor: COLORS[i] }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Por período */}
      {tab === 'Por Período' && (
        <div className="space-y-5">
          <div className="flex gap-2">
            {[['day','Por día'],['week','Por semana'],['month','Por mes']].map(([v, l]) => (
              <button
                key={v}
                onClick={() => setGroupBy(v)}
                className={clsx('px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                  groupBy === v ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                )}
              >
                {l}
              </button>
            ))}
          </div>
          <div className="card p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Tickets creados</h2>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="open"     name="Abiertos"  fill="#6366f1" radius={[4,4,0,0]} />
                <Bar dataKey="resolved" name="Resueltos" fill="#10b981" radius={[4,4,0,0]} />
                <Bar dataKey="pending"  name="Pendientes" fill="#f59e0b" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Agentes */}
      {tab === 'Agentes' && (
        <div className="card overflow-hidden">
          <div className="p-5 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Performance de agentes (30 días)</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left border-b border-gray-100">
                  {['Agente','Total','Resueltos','1ª Respuesta prom.','SLA incumplidos','Tasa resolución'].map(h => (
                    <th key={h} className="px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide text-right first:text-left">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {(agentPerf || []).map(a => {
                  const total = a.dataValues?.total || a.total || 0;
                  const resolved = a.dataValues?.resolved || a.resolved || 0;
                  return (
                    <tr key={a.agent_id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold">
                          {a.agent?.name?.charAt(0) || '?'}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{a.agent?.name || 'Sin nombre'}</p>
                          <p className="text-xs text-gray-400">{a.agent?.email}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-medium">{total}</td>
                      <td className="px-4 py-3 text-right text-green-600">{resolved}</td>
                      <td className="px-4 py-3 text-right text-gray-500">
                        {Math.round(a.dataValues?.avg_first_response || a.avg_first_response || 0)}m
                      </td>
                      <td className="px-4 py-3 text-right text-red-500">
                        {a.dataValues?.sla_breached || a.sla_breached || 0}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={clsx('font-medium', total > 0 && (resolved/total) > 0.8 ? 'text-green-600' : 'text-gray-600')}>
                          {total > 0 ? `${Math.round((resolved / total) * 100)}%` : '—'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Por Categoría */}
      {tab === 'Por Categoría' && (
        <div className="grid grid-cols-2 gap-6">
          <div className="card p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Tickets por categoría</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={byCategory || []} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="category.name" tick={{ fontSize: 11 }} width={100} />
                <Tooltip />
                <Bar dataKey="count" fill="#6366f1" radius={[0,4,4,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="card overflow-hidden">
            <div className="p-4 border-b border-gray-100 font-semibold text-gray-900">Detalle</div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left border-b border-gray-100">
                  <th className="px-4 py-2 font-medium text-gray-500 text-xs">Categoría</th>
                  <th className="px-4 py-2 font-medium text-gray-500 text-xs text-right">Total</th>
                  <th className="px-4 py-2 font-medium text-gray-500 text-xs text-right">Resueltos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {(byCategory || []).map((c, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      {c.category?.name || 'Sin categoría'}
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium">{c.count}</td>
                    <td className="px-4 py-2.5 text-right text-green-600">{c.resolved || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SLA */}
      {tab === 'SLA' && (
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'SLA Cumplidos', value: slaReport?.ok, color: 'border-green-500', text: 'text-green-600' },
              { label: 'En riesgo', value: slaReport?.warning, color: 'border-orange-500', text: 'text-orange-600' },
              { label: 'Incumplidos', value: slaReport?.breached, color: 'border-red-500', text: 'text-red-600' },
            ].map(c => (
              <div key={c.label} className={`card p-5 border-l-4 ${c.color}`}>
                <p className="text-sm text-gray-500">{c.label}</p>
                <p className={`text-3xl font-bold mt-1 ${c.text}`}>{c.value ?? '—'}</p>
              </div>
            ))}
          </div>
          {slaReport && (
            <div className="card p-5">
              <h2 className="font-semibold text-gray-900 mb-4">Tasa de cumplimiento SLA</h2>
              <div className="flex items-center gap-4">
                <div className="text-5xl font-bold text-primary-600">
                  {slaReport.total > 0 ? `${Math.round((slaReport.ok / slaReport.total) * 100)}%` : '—'}
                </div>
                <div className="flex-1">
                  <div className="w-full bg-gray-100 rounded-full h-4 overflow-hidden flex">
                    <div className="bg-green-500 h-4" style={{ width: `${slaReport.total > 0 ? (slaReport.ok/slaReport.total)*100 : 0}%` }} />
                    <div className="bg-orange-400 h-4" style={{ width: `${slaReport.total > 0 ? (slaReport.warning/slaReport.total)*100 : 0}%` }} />
                    <div className="bg-red-500 h-4" style={{ width: `${slaReport.total > 0 ? (slaReport.breached/slaReport.total)*100 : 0}%` }} />
                  </div>
                  <div className="flex gap-4 mt-2 text-xs text-gray-500">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 bg-green-500 rounded-full" /> Cumplidos</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 bg-orange-400 rounded-full" /> En riesgo</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 bg-red-500 rounded-full" /> Incumplidos</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Satisfacción (CSAT) */}
      {tab === 'Satisfacción' && (
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-4">
            <div className="card p-5 border-l-4 border-amber-400">
              <p className="text-sm text-gray-500">Calificación promedio</p>
              <p className="text-3xl font-bold text-gray-900 mt-1 flex items-center gap-2">
                {satisfaction?.avg_rating ?? '—'}
                <Star size={20} className="fill-amber-400 text-amber-400" />
              </p>
            </div>
            <div className="card p-5 border-l-4 border-green-500">
              <p className="text-sm text-gray-500">CSAT (4-5 estrellas)</p>
              <p className="text-3xl font-bold text-green-600 mt-1">{satisfaction?.csat_pct ?? '—'}%</p>
            </div>
            <div className="card p-5 border-l-4 border-red-500">
              <p className="text-sm text-gray-500">Insatisfechos (1-2 estrellas)</p>
              <p className="text-3xl font-bold text-red-600 mt-1">{satisfaction?.detractor_pct ?? '—'}%</p>
            </div>
          </div>

          <div className="card p-5">
            <h2 className="font-semibold text-gray-900 mb-4">
              Distribución de calificaciones ({satisfaction?.total_responses || 0} respuestas)
            </h2>
            <div className="space-y-2">
              {[5, 4, 3, 2, 1].map(n => {
                const count = satisfaction?.distribution?.[n - 1] || 0;
                const pct = satisfaction?.total_responses ? (count / satisfaction.total_responses) * 100 : 0;
                return (
                  <div key={n} className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 w-10 flex items-center gap-0.5">{n} <Star size={10} className="fill-amber-400 text-amber-400" /></span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
                      <div className="bg-amber-400 h-2.5 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs text-gray-500 w-8 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="p-5 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Satisfacción por agente</h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left border-b border-gray-100">
                  <th className="px-4 py-3 font-medium text-gray-500 text-xs uppercase">Agente</th>
                  <th className="px-4 py-3 font-medium text-gray-500 text-xs uppercase text-right">Respuestas</th>
                  <th className="px-4 py-3 font-medium text-gray-500 text-xs uppercase text-right">Promedio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {(satisfaction?.by_agent || []).map(a => (
                  <tr key={a.agent_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{a.agent_name}</td>
                    <td className="px-4 py-3 text-right text-gray-500">{a.responses}</td>
                    <td className="px-4 py-3 text-right font-medium flex items-center justify-end gap-1">
                      {a.avg_rating} <Star size={12} className="fill-amber-400 text-amber-400" />
                    </td>
                  </tr>
                ))}
                {(!satisfaction?.by_agent || satisfaction.by_agent.length === 0) && (
                  <tr><td colSpan={3} className="py-8 text-center text-gray-400">Todavía no hay respuestas de encuestas</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
