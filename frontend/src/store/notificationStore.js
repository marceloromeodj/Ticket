import { create } from 'zustand';
import api from '../api/axios';

export const useNotificationStore = create((set, get) => ({
  notifications: [],
  unread: 0,

  fetch: async () => {
    try {
      const { data } = await api.get('/notifications?limit=30');
      set({ notifications: data.data, unread: data.unread });
    } catch {}
  },

  markRead: async (id) => {
    await api.put(`/notifications/${id}/read`);
    set((s) => ({
      notifications: s.notifications.map(n => n.id === id ? { ...n, read: true } : n),
      unread: Math.max(0, s.unread - 1),
    }));
  },

  markAllRead: async () => {
    await api.put('/notifications/read-all');
    set((s) => ({
      notifications: s.notifications.map(n => ({ ...n, read: true })),
      unread: 0,
    }));
  },

  addNew: (notif) => {
    set((s) => ({
      notifications: [notif, ...s.notifications].slice(0, 50),
      unread: s.unread + 1,
    }));
  },
}));
