import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../api/axios';

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user:          null,
      token:         null,
      refresh_token: null,
      isLoading:     false,

      login: async (email, password, company_slug) => {
        set({ isLoading: true });
        try {
          const { data } = await api.post('/auth/login', { email, password, company_slug });
          localStorage.setItem('token',         data.token);
          localStorage.setItem('refresh_token', data.refresh_token);
          localStorage.setItem('company_id',    data.user.company?.id || '');
          set({ user: data.user, token: data.token, refresh_token: data.refresh_token, isLoading: false });
          return { ok: true };
        } catch (err) {
          set({ isLoading: false });
          return { ok: false, error: err.response?.data?.error || 'Error de autenticación' };
        }
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
      partialize: (s) => ({ user: s.user, token: s.token, refresh_token: s.refresh_token }),
    }
  )
);
