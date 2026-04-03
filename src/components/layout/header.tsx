'use client'

import { useEffect, useState } from 'react'
import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { MobileNav } from './mobile-nav'
import { createClient } from '@/lib/supabase/client'

const PLAN_BADGE: Record<string, { label: string; class: string }> = {
  free:     { label: 'Free',     class: 'bg-slate-100 text-slate-500' },
  pro:      { label: 'Pro',      class: 'bg-blue-100 text-blue-700'   },
  business: { label: 'Business', class: 'bg-purple-100 text-purple-700' },
}

export function Header() {
  const [plan,         setPlan]         = useState<string>('free')
  const [initials,     setInitials]     = useState<string>('')
  const [unreadCount,  setUnreadCount]  = useState<number>(0)

  useEffect(() => {
    const supabase = createClient() as any

    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('users_profile')
        .select('plan, full_name, email')
        .eq('id', user.id)
        .single()

      if (profile) {
        setPlan(profile.plan ?? 'free')
        const name = profile.full_name ?? profile.email ?? ''
        setInitials(name.slice(0, 2).toUpperCase())
      }

      const { count } = await supabase
        .from('optimization_alerts')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false)

      setUnreadCount(count ?? 0)

      // Realtime: update unread badge when new alert arrives
      supabase
        .channel('header:alerts')
        .on(
          'postgres_changes',
          {
            event: 'INSERT', schema: 'public',
            table: 'optimization_alerts',
            filter: `user_id=eq.${user.id}`,
          },
          () => setUnreadCount((c) => c + 1)
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE', schema: 'public',
            table: 'optimization_alerts',
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            // Refetch count on any update (e.g., mark-all-read)
            supabase
              .from('optimization_alerts')
              .select('id', { count: 'exact', head: true })
              .eq('user_id', user.id)
              .eq('is_read', false)
              .then(({ count: c }: { count: number | null }) => setUnreadCount(c ?? 0))
          }
        )
        .subscribe()
    }

    load()
  }, [])

  const planBadge = PLAN_BADGE[plan] ?? PLAN_BADGE.free

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 lg:px-6">
      {/* Left: hamburger (mobile only) */}
      <div className="flex items-center">
        <MobileNav />
        {/* Spacer on desktop */}
        <div className="hidden lg:block" />
      </div>

      {/* Right: notifications + avatar */}
      <div className="flex items-center gap-2">
        {/* Plan badge */}
        <span className={`hidden rounded-full px-2.5 py-0.5 text-xs font-semibold sm:block ${planBadge.class}`}>
          {planBadge.label}
        </span>

        {/* Bell */}
        <Button variant="ghost" size="icon" className="relative h-9 w-9">
          <Bell className="h-4.5 w-4.5 text-slate-600" />
          {unreadCount > 0 && (
            <Badge className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full p-0 text-[9px] bg-red-500 text-white border-2 border-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>

        {/* Avatar */}
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white select-none">
          {initials || '?'}
        </div>
      </div>
    </header>
  )
}
