import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2 } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import api from '../api/axios';

// Solo super_admin: elige qué empresa administrar. El resto de las
// pantallas (Agentes, Sucursales, SLA, Automatización, etc.) dependen de
// esta selección porque son datos de una empresa concreta — sin elegir
// ninguna, el super_admin queda en la vista global (agregada) donde solo
// Tickets tiene sentido mostrar algo.
export default function CompanySwitcher() {
  const { user, activeCompanyId, setActiveCompany } = useAuthStore();
  const queryClient = useQueryClient();

  const { data: companies = [] } = useQuery({
    queryKey: ['companies-switcher'],
    queryFn: () => api.get('/companies').then(r => r.data?.companies || r.data || []),
    enabled: user?.role === 'super_admin',
  });

  if (user?.role !== 'super_admin') return null;

  const handleChange = (e) => {
    setActiveCompany(e.target.value || null);
    // Todo lo que dependía de la empresa anterior (agentes, sucursales,
    // tickets, reportes...) tiene que volver a pedirse con el nuevo header.
    queryClient.invalidateQueries();
  };

  return (
    <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-lg pl-2.5 pr-1 py-1">
      <Building2 size={14} className="text-amber-600 flex-shrink-0" />
      <select
        value={activeCompanyId || ''}
        onChange={handleChange}
        className="bg-transparent text-sm font-medium text-amber-900 focus:outline-none cursor-pointer max-w-[160px] py-0.5"
        title="Empresa que estás administrando"
      >
        <option value="">— Todas las empresas —</option>
        {companies.map(c => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
    </div>
  );
}
