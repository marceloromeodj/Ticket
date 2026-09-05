import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store/authStore';
import Layout from './components/Layout';

// Pages
import Login         from './pages/Login';
import Dashboard     from './pages/Dashboard';
import TicketList    from './pages/tickets/TicketList';
import TicketDetail  from './pages/tickets/TicketDetail';
import NewTicket     from './pages/tickets/NewTicket';
import AgentList     from './pages/agents/AgentList';
import CompanyList   from './pages/companies/CompanyList';
import BranchList    from './pages/branches/BranchList';
import Reports       from './pages/reports/Reports';
import KnowledgeBase from './pages/knowledge/KnowledgeBase';
import Settings      from './pages/settings/Settings';
import CustomerPortal from './pages/portal/CustomerPortal';
import SurveyPage    from './pages/portal/SurveyPage';
import AssetList     from './pages/assets/AssetList';
import AssetDetail   from './pages/assets/AssetDetail';
import ServiceList   from './pages/services/ServiceList';
import ProblemList   from './pages/problems/ProblemList';
import ChangeList    from './pages/changes/ChangeList';
import AuditLogPage  from './pages/audit/AuditLogPage';
import Profile       from './pages/Profile';
import ContractList  from './pages/contracts/ContractList';
import TicketBoard   from './pages/board/TicketBoard';

function PrivateRoute({ children, roles }) {
  const { user, token } = useAuthStore();
  if (!token) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user?.role)) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const { fetchMe, token } = useAuthStore();

  useEffect(() => {
    if (token) fetchMe();
  }, [token]);

  return (
    <BrowserRouter>
      <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
      <Routes>
        {/* Auth */}
        <Route path="/login" element={<Login />} />

        {/* Portal del cliente (público) */}
        <Route path="/portal/survey/:token" element={<SurveyPage />} />
        <Route path="/portal/*" element={<CustomerPortal />} />

        {/* App principal */}
        <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route index                element={<Dashboard />} />
          <Route path="tickets"       element={<TicketList />} />
          <Route path="board"         element={<TicketBoard />} />
          <Route path="tickets/new"   element={<NewTicket />} />
          <Route path="tickets/:id"   element={<TicketDetail />} />
          <Route path="agents"        element={<PrivateRoute roles={['super_admin','admin','supervisor']}><AgentList /></PrivateRoute>} />
          <Route path="companies"     element={<PrivateRoute roles={['super_admin']}><CompanyList /></PrivateRoute>} />
          <Route path="branches"      element={<PrivateRoute roles={['super_admin','admin']}><BranchList /></PrivateRoute>} />
          <Route path="reports/*"     element={<PrivateRoute roles={['super_admin','admin','supervisor']}><Reports /></PrivateRoute>} />
          <Route path="knowledge/*"   element={<KnowledgeBase />} />
          <Route path="settings/*"    element={<PrivateRoute roles={['super_admin','admin']}><Settings /></PrivateRoute>} />
          <Route path="assets"        element={<AssetList />} />
          <Route path="assets/:id"    element={<AssetDetail />} />
          <Route path="services"      element={<ServiceList />} />
          <Route path="problems"      element={<ProblemList />} />
          <Route path="changes"       element={<ChangeList />} />
          <Route path="audit"         element={<PrivateRoute roles={['super_admin','admin']}><AuditLogPage /></PrivateRoute>} />
          <Route path="contracts"     element={<PrivateRoute roles={['super_admin','admin']}><ContractList /></PrivateRoute>} />
          <Route path="profile"       element={<Profile />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
