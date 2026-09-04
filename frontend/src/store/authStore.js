import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../api/axios';

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user:            null,
      token:           null,
      refresh_token:   null,
      isLoading:       false,
      // Empresa que el super_admin eligió administrar (null = vista global,
      // agregada entre todas las empresas). Para el resto de los roles
      // coincide siempre con user.company.id.
      activeCompanyId: null,

      login: async (email, password, company_slug) => {
        set({ isLoading: true });
        try {
          const { data } = await api.post('/auth/login', { email, password, company_slug });
          set({ isLoading: false });
          if (data.mfa_required) return { ok: true, mfa_required: true, mfa_token: data.mfa_token };
          get().applySession(data);
          return { ok: true };
        } catch (err) {
          set({ isLoading: false });
          return { ok: false, error: err.response?.data?.error || 'Error de autenticación' };
        }
      },

      // Segundo paso del login cuando el usuario tiene MFA activado.
      verifyMfa: async (mfa_token, code) => {
        set({ isLoading: true });
        try {
          const { data } = await api.post('/auth/mfa/verify-login', { mfa_token, code });
          get().applySession(data);
          set({ isLoading: false });
          return { ok: true };
        } catch (err) {
          set({ isLoading: false });
          return { ok: false, error: err.response?.data?.error || 'Código incorrecto' };
        }
      },

      // Login por SSO (Google/Microsoft): el backend ya validó el id_token
      // y devuelve la misma forma de respuesta que /auth/login.
      loginWithSso: async (provider, id_token) => {
        set({ isLoading: true });
        try {
          const { data } = await api.post(`/auth/sso/${provider}`, { id_token });
          set({ isLoading: false });
          if (data.mfa_required) return { ok: true, mfa_required: true, mfa_token: data.mfa_token };
          get().applySession(data);
          return { ok: true };
        } catch (err) {
          set({ isLoading: false });
          return { ok: false, error: err.response?.data?.error || 'No se pudo iniciar sesión' };
        }
      },

      applySession: (data) => {
        const companyId = data.user.company?.id || null;
        localStorage.setItem('token',         data.token);
        localStorage.setItem('refresh_token', data.refresh_token);
        localStorage.setItem('company_id',    companyId || '');
        set({
          user: data.user, token: data.token, refresh_token: data.refresh_token,
          activeCompanyId: companyId,
        });
      },

      // Solo tiene efecto real para super_admin: cambia qué empresa ven las
      // pantallas de administración (vía header X-Company-ID, ver
      // api/axios.js).
      setActiveCompany: (companyId) => {
        localStorage.setItem('company_id', companyId || '');
        set({ activeCompanyId: companyId || null });
      },

      logout: () => {
        localStorage.clear();
        set({ user: null, token: null, refresh_token: null });
        window.location.href = '/login';
      },

      fetchMe: async () => {
        try {
          const { data } = await api.get('/auth/me');
          set({ user: data });
        } catch {
          get().logout();
        }
      },

      updateProfile: (updates) => {
        set((s) => ({ user: { ...s.user, ...updates } }));
      },

      isAuthenticated: () => !!get().token,
      isAdmin:         () => ['super_admin','admin'].includes(get().user?.role),
      isSuperAdmin:    () => get().user?.role === 'super_admin',
    }),
    {
      name: 'helpdesk-auth',
      partialize: (s) => ({ user: s.user, token: s.token, refresh_token: s.refresh_token, activeCompanyId: s.activeCompanyId }),
    }
  )
);
