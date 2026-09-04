import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Ticket, Clock, CheckCircle, AlertTriangle, TrendingUp, Users } from 'lucide-react';
import api from '../api/axios';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { safeFormat as format } from '../utils/safeDate';
import { es } from 'date-fns/locale';

function StatCard({ title, value, icon: Icon, color, sub, to }) {
  const card = (
    <div className={`card p-5 border-l-4 ${color} hover:shadow-md transition-shadow`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{value ?? '–'}</p>
          {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
        </div>
        <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center">
          <Icon size={24} className="text-gray-400" />
        </div>
      </div>
    </div>
  );
  return to ? <Link to={to}>{card}</Link> : card;
}

const COLORS = ['#6366f1','#f59e0b','#10b981','#6b7280'];
const STATUS_LABELS = { open: 'Abiertos', pending: 'Pendientes', resolved: 'Resueltos', closed: 'Cerrados' };

export default function Dashboard() {
  const { data: overview } = useQuery({
    queryKey: ['overview'],
    queryFn: () => api.get('/reports/overview').then(r => r.data),
  });

  const { data: chartData } = useQuery({
    queryKey: ['tickets-by-date'],
    queryFn: () => api.get('/reports/tickets-by-date?group_by=day').then(r => r.data),
  });

  const { data: agentData } = useQuery({
    queryKey: ['agent-performance'],
    queryFn: () => api.get('/reports/agent-performance').then(r => r.data),
  });

  // Preparar datos para gráfico de pie
  const pieData = overview ? Object.entries(overview.by_status || {}).map(([k, v]) => ({
    name: STATUS_LABELS[k] || k, value: v,
  })) : [];

  // Preparar datos de línea/barra (últimos 14 días)
  const barData = (() => {
    if (!chartData) return [];
    const grouped = {};
    chartData.forEach(row => {
      const d = format(new Date(row.date), 'd MMM', { locale: es });
      if (!grouped[d]) grouped[d] = { date: d, open: 0, resolved: 0 };
      if (row.status === 'open')     grouped[d].open     += parseInt(row.count);
      if (row.status === 'resolved') grouped[d].resolved += parseInt(row.count);
    });
    return Object.values(grouped).slice(-14);
  })();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500">{format(new Date(), "EEEE d 'de' MMMM yyyy", { locale: es })}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Tickets Totales"  value={overview?.total}         icon={Ticket}        color="border-primary-500" to="/tickets" />
        <StatCard title="Abiertos"         value={overview?.by_status?.open} icon={Clock}       color="border-blue-500"    to="/tickets?status=open" />
        <StatCard title="Urgentes Abiertos" value={overview?.urgent_open}  icon={AlertTriangle} color="border-red-500"     to="/tickets?priority=urgent" />
        <StatCard title="SLA Incumplidos"  value={overview?.sla_breached}  icon={TrendingUp}    color="border-orange-500" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <StatCard
          title="Tiempo Prom. 1ª Respuesta"
          value={`${Math.round((overview?.avg_first_response_minutes || 0) / 60)}h ${(overview?.avg_first_response_minutes || 0) % 60}m`}
          icon={Clock} color="border-teal-500"
        />
        <StatCard
          title="Tiempo Prom. Resolución"
          value={`${Math.round((overview?.avg_resolution_minutes || 0) / 60)}h ${(overview?.avg_resolution_minutes || 0) % 60}m`}
          icon={CheckCircle} color="border-green-500"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-3 gap-6">
        {/* Bar chart */}
        <div className="card p-5 col-span-2">
          <h2 className="font-semibold text-gray-900 mb-4">Tickets por día (últimos 14 días)</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={barData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="open"     name="Abiertos"  fill="#6366f1" radius={[4,4,0,0]} />
              <Bar dataKey="resolved" name="Resueltos" fill="#10b981" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie */}
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Por estado</h2>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top agents */}
      {agentData?.length > 0 && (
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Performance de agentes (30 días)</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="pb-2 font-medium">Agente</th>
                  <th className="pb-2 font-medium text-right">Total</th>
                  <th className="pb-2 font-medium text-right">Resueltos</th>
                  <th className="pb-2 font-medium text-right">1ª Resp.</th>
                  <th className="pb-2 font-medium text-right">SLA ok</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {agentData.slice(0, 8).map((a) => (
                  <tr key={a.agent_id} className="hover:bg-gray-50">
                    <td className="py-2 flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold">
                        {a.agent?.name?.charAt(0) || '?'}
                      </div>
                      {a.agent?.name || 'Sin asignar'}
                    </td>
                    <td className="py-2 text-right font-medium">{a.dataValues?.total || a.total}</td>
                    <td className="py-2 text-right text-green-600">{a.dataValues?.resolved || a.resolved}</td>
                    <td className="py-2 text-right text-gray-500">
                      {Math.round((a.dataValues?.avg_first_response || a.avg_first_response || 0))}m
                    </td>
                    <td className="py-2 text-right text-red-500">{a.dataValues?.sla_breached || a.sla_breached} incumpl.</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
