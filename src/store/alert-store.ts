import { create } from 'zustand'
import type { TaxAlert } from '@/types/tax'

interface AlertStore {
  alerts: TaxAlert[]
  unreadCount: number
  setAlerts: (alerts: TaxAlert[]) => void
  addAlert: (alert: TaxAlert) => void
  markAsRead: (id: string) => void
  markAllAsRead: () => void
  clearAlerts: () => void
}

export const useAlertStore = create<AlertStore>((set) => ({
  alerts: [],
  unreadCount: 0,

  setAlerts: (alerts) =>
    set({ alerts, unreadCount: alerts.filter((a) => !a.read).length }),

  addAlert: (alert) =>
    set((state) => ({
      alerts: [alert, ...state.alerts],
      unreadCount: state.unreadCount + (alert.read ? 0 : 1),
    })),

  markAsRead: (id) =>
    set((state) => ({
      alerts: state.alerts.map((a) => (a.id === id ? { ...a, read: true } : a)),
      unreadCount: Math.max(0, state.unreadCount - 1),
    })),

  markAllAsRead: () =>
    set((state) => ({
      alerts: state.alerts.map((a) => ({ ...a, read: true })),
      unreadCount: 0,
    })),

  clearAlerts: () => set({ alerts: [], unreadCount: 0 }),
}))
