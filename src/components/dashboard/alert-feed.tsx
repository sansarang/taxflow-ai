'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Receipt, Lightbulb, Clock, FileText, TrendingUp, Bell
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Alert {
  id:            string
  user_id:       string
  alert_type:    'receipt_missing' | 'deduction_found' | 'tax_deadline' | 'law_change' | 'saving_opportunity'
  title:         string
  body:          string
  amount_impact: number | null
  is_read:       boolean
  created_at:    string
}

interface AlertFeedProps {
  initialAlerts?: Alert[]
  userId?:        string
}

// ─── Icon + colour mapping ────────────────────────────────────────────────────

function AlertIcon({ type }: { type: Alert['alert_type'] }) {
  const map: Record<Alert['alert_type'], { Icon: typeof Bell; color: string; bg: string }> = {
    receipt_missing:    { Icon: Receipt,    color: 'text-red-500',    bg: 'bg-red-50'    },
    deduction_found:    { Icon: Lightbulb,  color: 'text-green-600',  bg: 'bg-green-50'  },
    tax_deadline:       { Icon: Clock,      color: 'text-amber-500',  bg: 'bg-amber-50'  },
    law_change:         { Icon: FileText,   color: 'text-purple-600', bg: 'bg-purple-50' },
    saving_opportunity: { Icon: TrendingUp, color: 'text-blue-600',   bg: 'bg-blue-50'   },
  }
  const { Icon, color, bg } = map[type] ?? { Icon: Bell, color: 'text-slate-500', bg: 'bg-slate-50' }
  return (
    <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${bg}`}>
      <Icon className={`h-4 w-4 ${color}`} />
    </div>
  )
}

function typeLabel(type: Alert['alert_type']): string {
  const map: Record<string, string> = {
    receipt_missing:    '영수증 누락',
    deduction_found:    '공제 발견',
    tax_deadline:       '신고 마감',
    law_change:         '세법 변경',
    saving_opportunity: '절세 기회',
  }
  return map[type] ?? type
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min  = Math.floor(diff / 60_000)
  if (min < 1)   return '방금 전'
  if (min < 60)  return `${min}분 전`
  const hr = Math.floor(min / 60)
  if (hr < 24)   return `${hr}시간 전`
  const day = Math.floor(hr / 24)
  return `${day}일 전`
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AlertFeed({ initialAlerts = [], userId: propUserId }: AlertFeedProps) {
  const [alerts,   setAlerts]   = useState<Alert[]>(initialAlerts)
  const [loading,  setLoading]  = useState(initialAlerts.length === 0)
  const [marking,  setMarking]  = useState(false)

  const unreadCount = alerts.filter((a) => !a.is_read).length

  const fetchAlerts = useCallback(async () => {
    const supabase = createClient() as any
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    setLoading(true)
    const { data } = await supabase
      .from('optimization_alerts')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30)

    setAlerts((data ?? []) as Alert[])
    setLoading(false)

    // Subscribe to new alerts
    const channel = supabase
      .channel(`alerts:${user.id}`)
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'optimization_alerts',
          filter: `user_id=eq.${user.id}`,
        },
        (payload: { new: Alert }) => {
          setAlerts((prev) => [payload.new, ...prev])
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  useEffect(() => {
    if (initialAlerts.length === 0) {
      fetchAlerts()
    } else {
      // Still subscribe even if we have initial data
      const supabase = createClient() as any
      let channel: any

      supabase.auth.getUser().then(({ data }: any) => {
        if (!data.user) return
        channel = supabase
          .channel(`alerts:${data.user.id}:live`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT', schema: 'public',
              table: 'optimization_alerts',
              filter: `user_id=eq.${data.user.id}`,
            },
            (payload: { new: Alert }) => {
              setAlerts((prev) => [payload.new, ...prev])
            }
          )
          .subscribe()
      })

      return () => { if (channel) supabase.removeChannel(channel) }
    }
  }, [fetchAlerts, initialAlerts.length])

  async function markAllRead() {
    if (unreadCount === 0) return
    setMarking(true)
    const supabase = createClient() as any
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setMarking(false); return }

    await supabase
      .from('optimization_alerts')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false)

    setAlerts((prev) => prev.map((a) => ({ ...a, is_read: true })))
    setMarking(false)
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div className="flex items-center gap-2">
          <CardTitle className="text-sm font-semibold text-slate-800">알림</CardTitle>
          {unreadCount > 0 && (
            <Badge className="h-5 min-w-5 rounded-full px-1.5 text-[10px] bg-red-500 text-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </div>
        {unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-slate-500 hover:text-slate-700"
            onClick={markAllRead}
            disabled={marking}
          >
            모두 읽음
          </Button>
        )}
      </CardHeader>

      <CardContent className="p-0">
        {loading ? (
          <div className="space-y-3 px-4 pb-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : alerts.length === 0 ? (
          <div className="px-4 pb-4 text-center">
            <Bell className="mx-auto mb-2 h-8 w-8 text-slate-200" />
            <p className="text-sm text-slate-400">새로운 알림이 없습니다</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
            {alerts.map((alert) => (
              <li
                key={alert.id}
                className={`flex gap-3 px-4 py-3 transition-colors ${
                  !alert.is_read ? 'bg-blue-50/40' : ''
                }`}
              >
                <AlertIcon type={alert.alert_type} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {!alert.is_read && (
                        <span className="inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-blue-500" />
                      )}
                      <p className="truncate text-sm font-medium text-slate-800">
                        {alert.title}
                      </p>
                    </div>
                    {alert.amount_impact && alert.amount_impact > 0 && (
                      <span className="flex-shrink-0 text-xs font-semibold text-green-600">
                        +₩{Math.round(alert.amount_impact).toLocaleString('ko-KR')}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">{alert.body}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-[10px] text-slate-400">{relativeTime(alert.created_at)}</span>
                    <span className="text-[10px] text-slate-300">·</span>
                    <span className="text-[10px] text-slate-400">{typeLabel(alert.alert_type)}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
