import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server'
import { runDeductionOptimizer, type ClassifiedTransaction, type TaxLawData } from '@/lib/ai/optimizer'

// ─── Default tax law fallback ─────────────────────────────────────────────────
const DEFAULT_TAX_LAW: TaxLawData = {
  entertainmentAnnualLimit: 3_600_000,
  entertainmentPerReceiptLimit: 30_000,
  vehicleBusinessUseRatio: 0.5,
  yellowUmbrellaMaxDeduction: 5_000_000,
}

// ─── POST /api/optimize ───────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  // ── 1. Auth ──────────────────────────────────────────────────────────────────
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
  }

  // ── 2. Parse body ─────────────────────────────────────────────────────────────
  let year: number
  let quarter: number | undefined
  try {
    const body = await request.json()
    year = Number(body.year)
    quarter = body.quarter !== undefined ? Number(body.quarter) : undefined
    if (!year || year < 2020 || year > 2030) throw new Error('invalid year')
  } catch {
    return NextResponse.json({ error: '올바른 year 값이 필요합니다 (예: 2026)' }, { status: 400 })
  }

  const admin = createAdminClient()
  const db = admin as any // eslint-disable-line @typescript-eslint/no-explicit-any

  // ── 3. Fetch user profile ─────────────────────────────────────────────────────
  const { data: profile, error: profileError } = await db
    .from('users_profile')
    .select('*')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    return NextResponse.json({ error: '프로필을 찾을 수 없습니다' }, { status: 404 })
  }

  // ── 4. Pro plan gate ──────────────────────────────────────────────────────────
  const plan: string = profile.plan ?? 'free'

  if (plan === 'free') {
    return NextResponse.json(
      {
        error: 'Pro 플랜 전용 기능입니다',
        upgradeMessage:
          'AI 세금 최적화 기능은 Pro 플랜에서 사용할 수 있습니다. ' +
          '월 9,900원으로 업그레이드하면 무제한 최적화 분석을 이용하실 수 있습니다.',
        currentPlan: plan,
        requiredPlan: 'pro',
      },
      { status: 402 }
    )
  }

  // ── 5. Fetch transactions for period ──────────────────────────────────────────
  const periodStart = quarter
    ? `${year}-${String((quarter - 1) * 3 + 1).padStart(2, '0')}-01`
    : `${year}-01-01`
  const periodEnd = quarter
    ? `${year}-${String(quarter * 3).padStart(2, '0')}-${getDaysInMonth(year, quarter * 3)}`
    : `${year}-12-31`

  const { data: txRows, error: txError } = await db
    .from('transactions')
    .select('*')
    .eq('user_id', user.id)
    .gte('transaction_date', periodStart)
    .lte('transaction_date', periodEnd)
    .order('transaction_date', { ascending: true })

  if (txError) {
    return NextResponse.json({ error: '거래 내역 조회 실패' }, { status: 500 })
  }

  if (!txRows || txRows.length === 0) {
    return NextResponse.json(
      { error: '해당 기간에 거래 내역이 없습니다. 먼저 CSV를 업로드하세요.' },
      { status: 404 }
    )
  }

  const transactions: ClassifiedTransaction[] = txRows.map(
    (r: Record<string, unknown>) => ({
      id: String(r.id),
      transactionDate: String(r.transaction_date),
      description: String(r.description),
      amount: Number(r.amount),
      taxCategory: r.tax_category ? String(r.tax_category) : null,
      categoryLabel: r.category_label ? String(r.category_label) : null,
      vatDeductible: r.vat_deductible !== null ? Boolean(r.vat_deductible) : null,
      confidence: r.confidence !== null ? Number(r.confidence) : null,
      riskFlag: Array.isArray(r.risk_flag) ? (r.risk_flag as string[]) : null,
      receiptRequired: Boolean(r.receipt_required),
      manuallyReviewed: Boolean(r.manually_reviewed),
      userCategory: r.user_category ? String(r.user_category) : null,
    })
  )

  // ── 6. Fetch live tax law data ─────────────────────────────────────────────────
  const { data: taxLawRows } = await db
    .from('tax_law_table')
    .select('key, value')
    .in('key', ['entertainment', 'vehicle', 'yellow_umbrella'])

  const taxLaw: TaxLawData = { ...DEFAULT_TAX_LAW }
  for (const row of (taxLawRows ?? []) as Array<{ key: string; value: Record<string, number> }>) {
    if (row.key === 'entertainment') {
      taxLaw.entertainmentAnnualLimit = row.value.annual_limit ?? taxLaw.entertainmentAnnualLimit
      taxLaw.entertainmentPerReceiptLimit = row.value.per_receipt_limit ?? taxLaw.entertainmentPerReceiptLimit
    }
    if (row.key === 'vehicle') {
      taxLaw.vehicleBusinessUseRatio = row.value.business_use_ratio ?? taxLaw.vehicleBusinessUseRatio
    }
    if (row.key === 'yellow_umbrella') {
      taxLaw.yellowUmbrellaMaxDeduction = row.value.max_deduction ?? taxLaw.yellowUmbrellaMaxDeduction
    }
  }

  // ── 7. Run optimizer ──────────────────────────────────────────────────────────
  let result
  try {
    result = await runDeductionOptimizer(transactions, profile, taxLaw)
  } catch (err) {
    console.error('[optimize] optimizer error:', err)
    return NextResponse.json({ error: 'AI 분석에 실패했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 500 })
  }

  // ── 8. Persist top recommendations as alerts ──────────────────────────────────
  const alertRows = result.recommendations.slice(0, 3).map((rec) => ({
    id: crypto.randomUUID(),
    user_id: user.id,
    alert_type: 'saving_opportunity',
    title: rec.title,
    body: `${rec.description}\n\n지금 할 일: ${rec.actionItem}`,
    amount_impact: rec.savingsImpact > 0 ? rec.savingsImpact : null,
  }))

  if (alertRows.length > 0) {
    await db.from('optimization_alerts').insert(alertRows).catch(
      (e: unknown) => console.warn('[optimize] alert insert error:', e)
    )
  }

  return NextResponse.json({
    year,
    quarter,
    period: { start: periodStart, end: periodEnd },
    transactionCount: transactions.length,
    ...result,
  })
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function getDaysInMonth(year: number, month: number): string {
  return String(new Date(year, month, 0).getDate())
}
