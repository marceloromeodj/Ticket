import React, { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import {
  LayoutDashboard, Ticket, Users, Building2, GitBranch,
  BarChart2, BookOpen, Settings, ChevronLeft, ChevronRight,
  Database, AlertOctagon, GitPullRequest, ShieldCheck, LayoutGrid, LogOut,
  FileText, UserCog,
} from 'lucide-react';
import { clsx } from 'clsx';

const NAV = [
  { to: '/',          label: 'Dashboard',       icon: LayoutDashboard, exact: true },
  { to: '/tickets',   label: 'Tickets',          icon: Ticket },
  { to: '/knowledge', label: 'Base de Conocimiento', icon: BookOpen, module: 'knowledge' },
  { type: 'divider' },
  { to: '/services',  label: 'Catálogo de servicios', icon: LayoutGrid, roles: ['super_admin','admin','supervisor'], module: 'services' },
  { to: '/assets',    label: 'Activos (CMDB)',   icon: Database,      roles: ['super_admin','admin','supervisor','agent'], module: 'assets' },
  { to: '/problems',  label: 'Problemas',        icon: AlertOctagon,  roles: ['super_admin','admin','supervisor','agent'], module: 'problems' },
  { to: '/changes',   label: 'Cambios (RFC)',    icon: GitPullRequest, roles: ['super_admin','admin','supervisor','agent'], module: 'changes' },
  { to: '/contracts', label: 'Contratos y proveedores', icon: FileText, roles: ['super_admin','admin'], module: 'contracts' },
  { type: 'divider' },
  { to: '/agents',    label: 'Agentes',          icon: Users,         roles: ['super_admin','admin','supervisor'] },
  { to: '/branches',  label: 'Sucursales',       icon: GitBranch,     roles: ['super_admin','admin'] },
  { to: '/companies', label: 'Empresas',         icon: Building2,     roles: ['super_admin'] },
  { type: 'divider' },
  { to: '/reports',   label: 'Reportes',         icon: BarChart2,     roles: ['super_admin','admin','supervisor'] },
  { to: '/audit',     label: 'Auditoría',        icon: ShieldCheck,   roles: ['super_admin','admin'], module: 'audit' },
  { to: '/settings',  label: 'Configuración',    icon: Settings,      roles: ['super_admin','admin'] },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();

  const canSee = (item) => {
    if (item.roles && !item.roles.includes(user?.role)) return false;
    // El super_admin siempre ve todo, sin importar los módulos que estén
    // deshabilitados para la empresa que esté administrando en ese momento.
    if (item.module && user?.role !== 'super_admin' && user?.company?.modules?.[item.module] === false) return false;
    return true;
  };

  return (
    <aside className={clsx(
      'relative flex flex-col bg-gray-900 text-white transition-all duration-200',
      collapsed ? 'w-16' : 'w-60'
    )}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-gray-800">
        <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center flex-shrink-0">
          <Ticket size={16} className="text-white" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="font-bold text-sm truncate">HelpDesk</p>
            <p className="text-xs text-gray-400 truncate">{user?.company?.name}</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map((item, i) => {
          if (item.type === 'divider') return <div key={i} className="my-2 border-t border-gray-800" />;
          if (!canSee(item)) return null;

          const active = item.exact
            ? location.pathname === item.to
            : location.pathname.startsWith(item.to);

          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={clsx(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                active
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              )}
              title={collapsed ? item.label : undefined}
            >
              <item.icon size={18} className="flex-shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* User */}
      <div className="border-t border-gray-800 p-2">
        <div className={clsx(
          'flex items-center gap-2 px-2 py-2 rounded-lg',
          !collapsed && 'mb-1'
        )}>
          <button
            onClick={() => navigate('/profile')}
            className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center flex-shrink-0 text-xs font-bold uppercase"
            title="Mi cuenta"
          >
            {user?.name?.charAt(0) || 'U'}
          </button>
          {!collapsed && (
            <button onClick={() => navigate('/profile')} className="min-w-0 flex-1 text-left" title="Mi cuenta">
              <p className="text-xs font-medium truncate flex items-center gap-1"><UserCog size={11} />{user?.name}</p>
              <p className="text-xs text-gray-500 truncate capitalize">{user?.role?.replace('_',' ')}</p>
            </button>
          )}
          {!collapsed && (
            <button onClick={logout} className="text-gray-500 hover:text-red-400 transition-colors" title="Cerrar sesión">
              <LogOut size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(v => !v)}
        className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-gray-700 border border-gray-600 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-600 transition-colors z-10"
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>
    </aside>
  );
}
