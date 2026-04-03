import { Metadata } from 'next'
import { createServerSupabaseClient, getServerProfile } from '@/lib/supabase/server'
import { TaxSummaryCard } from '@/components/dashboard/tax-summary-card'
import { RiskScoreGauge } from '@/components/dashboard/risk-score-gauge'
import { AlertFeed } from '@/components/dashboard/alert-feed'
import { DeadlineCalendar } from '@/components/dashboard/deadline-calendar'
import { Calculator, TrendingDown, TrendingUp, CalendarClock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export const metadata: Metadata = {
  title: '대시보드 — TaxFlow AI',
}

// ─── Server-side data fetch ───────────────────────────────────────────────────

async function getDashboardData() {
  try {
    const supabase = await createServerSupabaseClient()
    const profile  = await getServerProfile()
    if (!profile) return null

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any

    // Last 30 days window
    const since = new Date()
    since.setDate(since.getDate() - 30)
    const sinceISO = since.toISOString().slice(0, 10)

    const { data: txRows } = await sb
      .from('transactions')
      .select('amount, tax_category, confidence, receipt_required, manually_reviewed')
      .eq('user_id', profile.id)
      .gte('transaction_date', sinceISO)

    const rows = (txRows ?? []) as Array<{
      amount: number
      tax_category: string | null
      confidence: number | null
      receipt_required: boolean | null
      manually_reviewed: boolean | null
    }>

    // KPI calculations
    const income     = rows.filter((r) => r.amount > 0).reduce((s, r) => s + r.amount, 0)
    const expenses   = rows.filter((r) => r.amount < 0).reduce((s, r) => s + Math.abs(r.amount), 0)
    const vatPayable = Math.max(0, income * 0.1 - expenses * 0.1)

    // Rough income tax estimate (flat ~15% of net income for dashboard KPI)
    const netIncome  = income - expenses
    const incomeTax  = Math.max(0, netIncome * 0.15)

    // Deductible expenses total (categories 201–311)
    const deductible = rows
      .filter((r) => {
        const cat = r.tax_category
        return cat && cat >= '201' && cat <= '311'
      })
      .reduce((s, r) => s + Math.abs(r.amount), 0)

    // Simple risk score
    const total       = rows.length
    const noReceipt   = rows.filter((r) => r.receipt_required).length
    const unclassified = rows.filter((r) => !r.tax_category).length
    const bigUnreviewed = rows.filter(
      (r) => Math.abs(r.amount) > 500_000 && !r.manually_reviewed
    ).length
    const riskScore = total === 0 ? 0 : Math.min(
      100,
      Math.round(
        (noReceipt / total) * 40 +
        (unclassified / total) * 30 +
        (Math.min(bigUnreviewed, total) / total) * 30
      )
    )

    // Recent 5 transactions
    const { data: recent } = await sb
      .from('transactions')
      .select('id, transaction_date, description, amount, category_label, tax_category')
      .eq('user_id', profile.id)
      .order('transaction_date', { ascending: false })
      .limit(5)

    return {
      profile,
      vatPayable,
      incomeTax,
      deductible,
      riskScore,
      recent: (recent ?? []) as Array<{
        id: string
        transaction_date: string
        description: string
        amount: number
        category_label: string | null
        tax_category: string | null
      }>,
    }
  } catch {
    return null
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const data = await getDashboardData()

  const vatPayable  = data?.vatPayable  ?? null
  const incomeTax   = data?.incomeTax   ?? null
  const deductible  = data?.deductible  ?? null
  const riskScore   = data?.riskScore   ?? 0
  const recent      = data?.recent      ?? []
  const profile     = data?.profile

  const firstName = profile?.full_name?.split(' ')[0] ?? null

  return (
    <div className="space-y-5">
      {/* Page heading */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">
          {firstName ? `${firstName}님의 세금 현황` : '세금 대시보드'}
        </h1>
        <p className="mt-0.5 text-sm text-slate-500">최근 30일 기준 · AI 분류 결과는 참고용입니다</p>
      </div>

      {/* ── Row 1: Summary KPI cards ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <TaxSummaryCard
          title="예상 부가세"
          value={vatPayable}
          subtitle="최근 30일 기준 추산"
          icon={Calculator}
          color={vatPayable && vatPayable > 500_000 ? 'red' : 'default'}
          badge="부가세"
        />
        <TaxSummaryCard
          title="예상 종합소득세"
          value={incomeTax}
          subtitle="단순 추산 (15% 기준)"
          icon={TrendingUp}
          color={incomeTax && incomeTax > 1_000_000 ? 'amber' : 'default'}
          badge="소득세"
        />
        <TaxSummaryCard
          title="공제 가능 금액"
          value={deductible}
          subtitle="경비 처리 가능 추산액"
          icon={TrendingDown}
          color="green"
          badge="절세"
        />
      </div>

      {/* ── Row 2: Risk gauge + Alert feed ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <RiskScoreGauge score={riskScore} />
        </div>
        <div className="lg:col-span-2">
          <AlertFeed />
        </div>
      </div>

      {/* ── Row 3: Deadline calendar + Recent transactions ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DeadlineCalendar />

        {/* Recent transactions */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-slate-500" />
              <CardTitle className="text-sm font-semibold text-slate-800">최근 거래 내역</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {recent.length === 0 ? (
              <p className="px-4 pb-4 text-sm text-slate-400">
                CSV를 업로드하면 거래 내역이 표시됩니다.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {recent.map((tx) => (
                  <li key={tx.id} className="flex items-center justify-between px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-slate-800">{tx.description}</p>
                      <p className="text-xs text-slate-400">{tx.transaction_date}</p>
                    </div>
                    <div className="ml-3 flex items-center gap-2">
                      {tx.category_label && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {tx.category_label}
                        </Badge>
                      )}
                      <span
                        className={`text-sm font-semibold tabular-nums ${
                          tx.amount >= 0 ? 'text-blue-600' : 'text-slate-700'
                        }`}
                      >
                        {tx.amount >= 0 ? '+' : ''}
                        {tx.amount.toLocaleString('ko-KR')}원
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
