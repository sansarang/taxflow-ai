'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Plan } from '@/types/user'

export function usePlan() {
  const [plan, setPlan] = useState<Plan>('free')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createClient() as any

    async function fetchPlan() {
      setIsLoading(true)
      try {
        const { data: user } = await supabase.auth.getUser()
        if (!user.user) return

        const { data: profile } = await supabase
          .from('profiles')
          .select('plan')
          .eq('id', user.user.id)
          .single()

        if (profile?.plan) {
          setPlan(profile.plan as Plan)
        }
      } finally {
        setIsLoading(false)
      }
    }

    fetchPlan()
  }, [])

  return { plan, isLoading }
}
