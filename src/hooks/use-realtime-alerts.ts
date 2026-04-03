'use client'

import { useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useAlertStore } from '@/store/alert-store'

// ─── DB row shape from optimization_alerts ────────────────────────────────────

interface AlertRow {
  id:            string
  user_id:       string
  alert_type:    'receipt_missing' | 'deduction_found' | 'tax_deadline' | 'law_change' | 'saving_opportunity'
  title:         string
  body:          string
  amount_impact: number | null
  is_read:       boolean
  is_pushed:     boolean
  created_at:    string
}

const ALERT_TYPE_ICONS: Record<string, string> = {
  receipt_missing:    '🧾',
  deduction_found:    '💡',
  tax_deadline:       '⏰',
  law_change:         '📋',
  saving_opportunity: '📈',
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Subscribes to the optimization_alerts table via Supabase Realtime.
 * New alerts: show sonner toast + update Zustand alert store (unreadCount).
 */
export function useRealtimeAlerts() {
  const { addAlert, setAlerts } = useAlertStore()

  // Map DB row to the store's TaxAlert shape (simplified bridge)
  const mapRow = useCallback((row: AlertRow) => ({
    id:        row.id,
    userId:    row.user_id,
    type:      'opportunity' as const,   // generic mapping for store
    title:     row.title,
    message:   row.body,
    severity:  'info' as const,
    read:      row.is_read,
    createdAt: row.created_at,
  }), [])

  useEffect(() => {
    const supabase = createClient() as any
    let channel: ReturnType<typeof supabase.channel> | null = null

    async function setup() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Initial fetch — last 20 unread
      const { data } = await supabase
        .from('optimization_alerts')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_read', false)
        .order('created_at', { ascending: false })
        .limit(20)

      if (data) {
        setAlerts((data as AlertRow[]).map(mapRow))
      }

      // Subscribe to INSERT
      channel = supabase
        .channel(`realtime:alerts:${user.id}`)
        .on(
          'postgres_changes',
          {
            event:  'INSERT',
            schema: 'public',
            table:  'optimization_alerts',
            filter: `user_id=eq.${user.id}`,
          },
          (payload: { new: AlertRow }) => {
            const row = payload.new
            addAlert(mapRow(row))

            // Sonner toast
            const icon = ALERT_TYPE_ICONS[row.alert_type] ?? '🔔'
            const impact = row.amount_impact
              ? ` (+₩${Math.round(row.amount_impact).toLocaleString('ko-KR')})`
              : ''

            toast(row.title, {
              description: row.body + impact,
              icon,
              duration:    6000,
            })
          }
        )
        .subscribe()
    }

    setup()

    return () => {
      if (channel) supabase.removeChannel(channel)
    }
  }, [addAlert, mapRow, setAlerts])
}
