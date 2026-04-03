import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server'
import { classifyTransactions, type TransactionInput } from '@/lib/ai/classifier'
import { runDeductionOptimizer, type ClassifiedTransaction, type TaxLawData } from '@/lib/ai/optimizer'
import { dispatchNotification } from '@/lib/notifications/push-dispatcher'
import type { ReportType } from '@/types/supabase'

// ─── Plan limits ──────────────────────────────────────────────────────────────
const PLAN_MONTHLY_LIMITS: Record<string, number> = {
  free: 100,
  pro: 5000,
  business: Infinity,
}

// ─── Default tax law data (fallback if DB unavailable) ────────────────────────
const DEFAULT_TAX_LAW: TaxLawData = {
  entertainmentAnnualLimit: 3_600_000,
  entertainmentPerReceiptLimit: 30_000,
  vehicleBusinessUseRatio: 0.5,
  yellowUmbrellaMaxDeduction: 5_000_000,
}

// ─── POST /api/classify ───────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  // ── 1. Auth ──────────────────────────────────────────────────────────────────
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
  }

  // ── 2. Parse body ─────────────────────────────────────────────────────────────
  let batchId: string
  try {
    const body = await request.json()
    batchId = body.batchId
    if (!batchId || typeof batchId !== 'string') throw new Error('missing batchId')
  } catch {
    return NextResponse.json({ error: 'batchId가 필요합니다' }, { status: 400 })
  }

  const admin = createAdminClient()
  const db = admin as any // eslint-disable-line @typescript-eslint/no-explicit-any

  // ── 3. Verify batch ownership ─────────────────────────────────────────────────
  const { data: batch, error: batchError } = await db
    .from('csv_batches')
    .select('id, user_id, status, bank_name')
    .eq('id', batchId)
    .single()

  if (batchError || !batch) {
    return NextResponse.json({ error: '배치를 찾을 수 없습니다' }, { status: 404 })
  }
  if (batch.user_id !== user.id) {
    return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 })
  }

  // ── 4. Fetch user profile ─────────────────────────────────────────────────────
  const { data: profile } = await db
    .from('users_profile')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return NextResponse.json({ error: '프로필을 찾을 수 없습니다' }, { status: 404 })
  }

  const plan: string = profile.plan ?? 'free'
  const monthlyLimit = PLAN_MONTHLY_LIMITS[plan] ?? 100

  // ── 5. Check plan usage ───────────────────────────────────────────────────────
  if (monthlyLimit !== Infinity) {
    // Reset monthly count if needed
    const resetAt = new Date(profile.monthly_classify_reset_at ?? 0)
    const now = new Date()
    const needsReset = resetAt.getMonth() !== now.getMonth() || resetAt.getFullYear() !== now.getFullYear()

    if (needsReset) {
      await db.from('users_profile').update({
        monthly_classify_count: 0,
        monthly_classify_reset_at: now.toISOString(),
      }).eq('id', user.id)
      profile.monthly_classify_count = 0
    }

    const currentUsage: number = profile.monthly_classify_count ?? 0

    if (currentUsage >= monthlyLimit) {
      return NextResponse.json(
        {
          error: `무료 플랜 월 분류 한도(${monthlyLimit}건)에 도달했습니다.`,
          upgradeMessage: 'Pro 플랜으로 업그레이드하면 월 5,000건까지 분류할 수 있습니다.',
          currentUsage,
          limit: monthlyLimit,
        },
        { status: 402 }
      )
    }
  }

  // ── 6. Fetch unclassified transactions ────────────────────────────────────────
  const { data: txRows, error: txError } = await db
    .from('transactions')
    .select('id, tx_hash, transaction_date, description, amount')
    .eq('batch_id', batchId)
    .is('tax_category', null)
    .order('transaction_date', { ascending: true })

  if (txError) {
    return NextResponse.json({ error: '거래 내역 조회 실패' }, { status: 500 })
  }

  if (!txRows || txRows.length === 0) {
    return NextResponse.json({ message: '분류할 거래 내역이 없습니다', classified: 0 })
  }

  const transactions: TransactionInput[] = txRows.map((r: Record<string, unknown>) => ({
    txHash: String(r.tx_hash),
    date: String(r.transaction_date),
    description: String(r.description),
    amount: Number(r.amount),
  }))

  // ── 7. Fetch tax law data ─────────────────────────────────────────────────────
  const { data: taxLawRows } = await db
    .from('tax_law_table')
    .select('key, value')
    .in('key', ['entertainment', 'vehicle'])

  const taxLaw: TaxLawData = { ...DEFAULT_TAX_LAW }
  for (const row of (taxLawRows ?? []) as Array<{ key: string; value: Record<string, number> }>) {
    if (row.key === 'entertainment') {
      taxLaw.entertainmentAnnualLimit = row.value.annual_limit ?? DEFAULT_TAX_LAW.entertainmentAnnualLimit
      taxLaw.entertainmentPerReceiptLimit = row.value.per_receipt_limit ?? DEFAULT_TAX_LAW.entertainmentPerReceiptLimit
    }
    if (row.key === 'vehicle') {
      taxLaw.vehicleBusinessUseRatio = row.value.business_use_ratio ?? DEFAULT_TAX_LAW.vehicleBusinessUseRatio
    }
  }

  // ── 8. Run classification ─────────────────────────────────────────────────────
  let classificationResults
  try {
    classificationResults = await classifyTransactions(
      transactions,
      {
        businessType: profile.business_type ?? 'creator',
        isSimplifiedTax: profile.is_simplified_tax ?? false,
        annualRevenueTier: profile.annual_revenue_tier ?? 'under_50m',
      },
      user.id
    )
  } catch (err) {
    console.error('[classify] classifyTransactions error:', err)
    return NextResponse.json({ error: 'AI 분류에 실패했습니다' }, { status: 500 })
  }

  // ── 9. Bulk update transactions ───────────────────────────────────────────────
  const hashToId = new Map<string, string>(
    txRows.map((r: Record<string, unknown>) => [String(r.tx_hash), String(r.id)])
  )

  const updatePromises = classificationResults.map((result) => {
    const txId = hashToId.get(result.txHash)
    if (!txId) return Promise.resolve()
    return db.from('transactions').update({
      tax_category: result.taxCategory,
      category_label: result.categoryLabel,
      vat_deductible: result.vatDeductible,
      expense_type: result.expenseType,
      confidence: result.confidence,
      ai_reason: result.aiReason,
      risk_flag: result.riskFlags,
      receipt_required: result.receiptRequired,
    }).eq('id', txId)
  })

  await Promise.all(updatePromises)

  // Update batch status
  await db.from('csv_batches').update({ status: 'done' }).eq('id', batchId)

  // ── 10. Update monthly usage counter ─────────────────────────────────────────
  if (monthlyLimit !== Infinity) {
    await db.from('users_profile').update({
      monthly_classify_count: (profile.monthly_classify_count ?? 0) + classificationResults.length,
    }).eq('id', user.id)
  }

  // ── 11. Run deduction optimizer ───────────────────────────────────────────────
  // Fetch now-classified transactions for optimizer
  const { data: classifiedRows } = await db
    .from('transactions')
    .select('*')
    .eq('batch_id', batchId)

  const classifiedTxs: ClassifiedTransaction[] = (classifiedRows ?? []).map(
    (r: Record<string, unknown>) => ({
      id: String(r.id),
      transactionDate: String(r.transaction_date),
      description: String(r.description),
      amount: Number(r.amount),
      taxCategory: r.tax_category ? String(r.tax_category) : null,
      categoryLabel: r.category_label ? String(r.category_label) : null,
      vatDeductible: r.vat_deductible !== null ? Boolean(r.vat_deductible) : null,
      confidence: r.confidence !== null ? Number(r.confidence) : null,
      riskFlag: Array.isArray(r.risk_flag) ? r.risk_flag as string[] : null,
      receiptRequired: Boolean(r.receipt_required),
      manuallyReviewed: Boolean(r.manually_reviewed),
      userCategory: r.user_category ? String(r.user_category) : null,
    })
  )

  let optimizerResult
  try {
    optimizerResult = await runDeductionOptimizer(classifiedTxs, profile, taxLaw)
  } catch (err) {
    console.error('[classify] optimizer error:', err)
    // Non-fatal — continue without optimizer results
  }

  // ── 12. Insert optimization alerts ───────────────────────────────────────────
  const alerts: Array<{
    id: string
    user_id: string
    alert_type: string
    title: string
    body: string
    amount_impact: number | null
  }> = []

  if (optimizerResult) {
    for (const rec of optimizerResult.recommendations.slice(0, 3)) {
      const alertRow = {
        id: crypto.randomUUID(),
        user_id: user.id,
        alert_type: 'saving_opportunity',
        title: rec.title,
        body: rec.description,
        amount_impact: rec.savingsImpact > 0 ? rec.savingsImpact : null,
      }
      alerts.push(alertRow)
    }

    for (const alert of optimizerResult.creatorSpecificAlerts.slice(0, 2)) {
      const alertRow = {
        id: crypto.randomUUID(),
        user_id: user.id,
        alert_type: 'deduction_found',
        title: '크리에이터 공제 알림',
        body: alert,
        amount_impact: null,
      }
      alerts.push(alertRow)
    }

    // Receipt-missing alerts (up to 1)
    const missingReceipts = classifiedTxs.filter((t) => t.receiptRequired && !t.manuallyReviewed)
    if (missingReceipts.length > 0) {
      alerts.push({
        id: crypto.randomUUID(),
        user_id: user.id,
        alert_type: 'receipt_missing',
        title: `영수증 미보관 거래 ${missingReceipts.length}건`,
        body: '세무조사 대비를 위해 영수증을 보관하세요.',
        amount_impact: null,
      })
    }
  }

  if (alerts.length > 0) {
    await db.from('optimization_alerts').insert(alerts)
  }

  // ── 13. Push notification ─────────────────────────────────────────────────────
  const notifyChannel =
    profile.notification_email && profile.notification_kakao ? 'all'
    : profile.notification_kakao ? 'kakao'
    : 'email'

  if (profile.notification_email || profile.notification_kakao) {
    dispatchNotification({
      userId: user.id,
      channel: notifyChannel as 'email' | 'kakao' | 'all',
      subject: `TaxFlow AI: ${classificationResults.length}건 거래 분류 완료`,
      message: `${batch.bank_name} CSV ${classificationResults.length}건 분류가 완료됐습니다. 앱에서 결과를 확인하세요.`,
      email: profile.notification_email ? profile.email : undefined,
      kakaoUuid: profile.notification_kakao ? (profile.kakao_token ?? undefined) : undefined,
    }).catch((e) => console.warn('[classify] notification error:', e))
  }

  // ── 14. Build summary ─────────────────────────────────────────────────────────
  const income = classifiedTxs
    .filter((t) => t.amount > 0 && ['101','102','103'].includes(t.taxCategory ?? ''))
    .reduce((s, t) => s + t.amount, 0)
  const expense = classifiedTxs
    .filter((t) => t.amount < 0)
    .reduce((s, t) => s + Math.abs(t.amount), 0)

  return NextResponse.json({
    classified: classificationResults.length,
    riskScore: optimizerResult?.riskScore ?? 0,
    alerts: alerts.slice(0, 5),
    summary: {
      totalIncome: income,
      totalExpense: expense,
      estimatedTax: 0,  // calculated on full-year basis in reporter.ts
      topCategory: classificationResults[0]?.categoryLabel ?? '',
    },
  })
}
