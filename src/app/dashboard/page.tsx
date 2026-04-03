/**
 * @file src/app/dashboard/page.tsx
 * @description TaxFlow AI — 대시보드 Server Component
 */
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import DashboardClient from '@/components/dashboard/dashboard-client'

async function getData(welcomeParam: boolean) {
  const store = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: n => store.get(n)?.value,
        set: (n, v, o: CookieOptions) => { try { store.set({ name: n, value: v, ...o }) } catch {} },
        remove: (n, o: CookieOptions) => { try { store.set({ name: n, value: '', ...o }) } catch {} },
      },
    },
  )
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id,full_name,business_type,is_simplified_vat,plan,onboarding_completed,revenue_range,notification_setup_done')
    .eq('id', user.id).single()

  if (!profile?.onboarding_completed || !profile?.business_type) redirect('/onboarding')

  const yearStart = `${new Date().getFullYear()}-01-01`
  const month     = new Date().toISOString().slice(0, 7)
  const ago30     = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 7)

  const [txRes, alertRes, summaryRes, usageRes, receiptRes, usageHistRes] = await Promise.all([
    supabase.from('transactions')
      .select('id,description,amount,date,tax_category,is_deductible,classified_at,vendor,receipt_url')
      .eq('user_id', user.id).order('date', { ascending: false }).limit(10),
    supabase.from('optimization_alerts')
      .select('id,type,priority,title,message,savings_impact,action_required,created_at')
      .eq('user_id', user.id).order('created_at', { ascending: false }).limit(5),
    supabase.from('transactions')
      .select('amount,tax_category,is_deductible,risk_flags,date')
      .eq('user_id', user.id).gte('date', yearStart),
    supabase.from('usage_logs').select('count').eq('user_id', user.id).eq('month', month).maybeSingle(),
    supabase.from('receipts')
      .select('id,description,amount,image_url,created_at,transaction_id')
      .eq('user_id', user.id).order('created_at', { ascending: false }).limit(12),
    supabase.from('usage_logs').select('count,month')
      .eq('user_id', user.id).gte('month', ago30).order('month', { ascending: false }).limit(3),
  ])

  return {
    user: { id: user.id, email: user.email ?? '' },
    profile,
    recentTransactions: txRes.data      ?? [],
    recentAlerts:       alertRes.data   ?? [],
    taxSummary:         summaryRes.data ?? [],
    monthlyUsage:       (usageRes.data as any)?.count ?? 0,
    receipts:           receiptRes.data ?? [],
    usageHistory:       usageHistRes.data ?? [],
    isFirstVisit:       welcomeParam && !profile?.notification_setup_done,
  }
}

export default async function DashboardPage({
  searchParams,
}: { searchParams: Promise<{ welcome?: string }> }) {
  const sp = await searchParams
  const data = await getData(sp?.welcome === '1')
  return <DashboardClient {...data} />
}
