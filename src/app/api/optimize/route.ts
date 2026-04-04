import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server'
import { runDeductionOptimizer, type TaxLawData } from '@/lib/ai/optimizer'

const DEFAULT_TAX_LAW: TaxLawData = {
  entertainmentAnnualLimit: 3_600_000,
  entertainmentPerReceiptLimit: 30_000,
  vehicleBusinessUseRatio: 0.5,
  yellowUmbrellaMaxDeduction: 5_000_000,
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Login required' }, { status: 401 })
  }

  let year: number
  let quarter: number | undefined
  try {
    const body = await request.json()
    year = Number(body.year)
    quarter = body.quarter !== undefined ? Number(body.quarter) : undefined
    if (!year || year < 2020 || year > 2030) throw new Error('invalid year')
  } catch {
    return NextResponse.json({ error: 'Valid year required (e.g. 2026)' }, { status: 400 })
  }

  const db = createAdminClient() as any

  const { data: profile, error: profileError } = await db
    .from('users_profile').select('*').eq('id', user.id).single()
  if (profileError || !profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  const plan: string = profile.plan ?? 'free'
  if (plan === 'free') {
    return NextResponse.json({
      error: 'Pro plan required',
      upgradeMessage: 'Upgrade to Pro for unlimited AI optimization.',
      currentPlan: plan,
      requiredPlan: 'pro',
    }, { status: 402 })
  }

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
    return NextResponse.json({ error: 'Transaction fetch failed' }, { status: 500 })
  }
  if (!txRows || txRows.length === 0) {
    return NextResponse.json({ error: 'No transactions found for this period.' }, { status: 404 })
  }

  const transactions: any[] = txRows.map((r: any) => ({
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
  }))

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

  const totalIncome = transactions
    .filter((t: any) => t.amount > 0)
    .reduce((s: number, t: any) => s + t.amount, 0)

  let result
  try {
    result = await runDeductionOptimizer(
      transactions as any,
      totalIncome,
      profile.business_type ?? 'creator',
      Boolean(profile.is_simplified_tax)
    )
  } catch (err) {
    console.error('[optimize] error:', err)
    return NextResponse.json({ error: 'AI analysis failed. Please retry.' }, { status: 500 })
  }

  const alertRows = (result.recommendations as string[]).slice(0, 3).map((rec: string) => ({
    id: crypto.randomUUID(),
    user_id: user.id,
    alert_type: 'saving_opportunity',
    title: rec.slice(0, 80),
    body: rec,
    amount_impact: null,
  }))

  if (alertRows.length > 0) {
    await db.from('optimization_alerts').insert(alertRows)
      .catch((e: unknown) => console.warn('[optimize] alert insert error:', e))
  }

  return NextResponse.json({ year, quarter, period: { start: periodStart, end: periodEnd }, transactionCount: transactions.length, ...result })
}

function getDaysInMonth(year: number, month: number): string {
  return String(new Date(year, month, 0).getDate())
}
