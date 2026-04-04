/**
 * @file src/app/api/classify/route.ts
 * @description TaxFlow AI — /api/classify v7 Final
 *
 * ## 14단계 파이프라인
 *  1. Auth (Supabase JWT)
 *  2. Rate limit (20 req/hour)
 *  3. Body parse & validate
 *  4. Profile load (plan, 간이과세, billing IDs)
 *  5. Free plan 월 사용량 체크 (5회 제한)
 *  6. Batch ownership check
 *  7. Tax law load (DB → default fallback)
 *  8. classifyTransactions()
 *  9. Bulk DB update
 * 10. runDeductionOptimizer()
 * 11. Alert insert + compensation (retry 3회 × 150/300/600ms + dead_letter)
 * 12. Usage billing — Paddle Billing v2 (Stripe fallback)
 * 13. Push notification (fire-and-forget)
 * 14. Response (disclaimer 포함)
 *
 * ## Paddle Billing v2
 *  GET  /subscriptions/{id}  → item quantity 확인
 *  PATCH /subscriptions/{id} → quantity += count
 *  Idempotency-Key: taxflow-usage-{subId}-{minuteTs}
 *  PaddleBillingError: 4xx → 재시도 무의미
 *  일반 Error: 5xx → 호출자 재시도 가능
 */

import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { classifyTransactions, type RawTransaction } from '@/lib/ai/classifier'
import { runDeductionOptimizer, type DeductionOptimizerResult } from '@/lib/ai/optimizer'
import type { ClassificationResult } from '@/lib/ai/classifier'

// ─── Constants ────────────────────────────────────────────────────────────────

const PADDLE_BASE = 'https://api.paddle.com'
const STRIPE_BASE = 'https://api.stripe.com/v1'
const FREE_MONTHLY_LIMIT = 5
const RATE_LIMIT_PER_HOUR = 20
const ALERT_MAX_RETRIES = 3
const ALERT_RETRY_DELAYS = [150, 300, 600] // ms

// ─── Paddle helpers ───────────────────────────────────────────────────────────

class PaddleBillingError extends Error {
  constructor(message: string, public statusCode: number) {
    super(message)
    this.name = 'PaddleBillingError'
  }
}

interface PaddleConfig {
  apiKey: string
  priceId: string
  prorationMode: string
}

function getPaddleConfig(): PaddleConfig | null {
  const apiKey = process.env.PADDLE_API_KEY
  const priceId = process.env.PADDLE_USAGE_PRICE_ID
  if (!apiKey || !priceId) {
    console.warn('[billing] Paddle 환경변수 미설정 — Stripe fallback')
    return null
  }
  return {
    apiKey,
    priceId,
    prorationMode: process.env.PADDLE_PRORATION_MODE ?? 'prorated_immediately',
  }
}

async function paddleRecordUsage(subscriptionId: string, count: number): Promise<void> {
  const cfg = getPaddleConfig()
  if (!cfg) throw new Error('Paddle config unavailable')

  // Step 1: GET current subscription items
  const getRes = await fetch(`${PADDLE_BASE}/subscriptions/${subscriptionId}`, {
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      'Paddle-Version': '1',
    },
  })

  if (!getRes.ok) {
    const status = getRes.status
    if (status >= 400 && status < 500) {
      throw new PaddleBillingError(`Paddle GET subscription failed: ${status}`, status)
    }
    throw new Error(`Paddle GET ${status}`)
  }

  const sub: { data?: { items?: Array<{ price?: { id: string }; quantity?: number; status?: string }> } } =
    await getRes.json()

  const item = sub.data?.items?.find(
    i => i.price?.id === cfg.priceId && i.status !== 'trialing_canceled'
  )
  if (!item) {
    throw new PaddleBillingError(`Paddle: price ${cfg.priceId} not found in subscription`, 404)
  }

  const currentQty: number = typeof item.quantity === 'number' ? item.quantity : 0
  const idempKey = `taxflow-usage-${subscriptionId}-${Math.floor(Date.now() / 60_000)}`

  // Step 2: PATCH quantity
  const patchRes = await fetch(`${PADDLE_BASE}/subscriptions/${subscriptionId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      'Content-Type': 'application/json',
      'Paddle-Version': '1',
      'Idempotency-Key': idempKey,
    },
    body: JSON.stringify({
      proration_billing_mode: cfg.prorationMode,
      items: [{ price_id: cfg.priceId, quantity: currentQty + count }],
    }),
  })

  if (!patchRes.ok) {
    const status = patchRes.status
    if (status >= 400 && status < 500) {
      throw new PaddleBillingError(`Paddle PATCH failed: ${status}`, status)
    }
    throw new Error(`Paddle PATCH ${status}`)
  }

  console.info(`[billing] Paddle +${count} sub=${subscriptionId} qty=${currentQty + count}`)
}

async function stripeRecordUsage(customerId: string, count: number): Promise<void> {
  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) throw new Error('STRIPE_SECRET_KEY 미설정')

  const ts = Math.floor(Date.now() / 1000)
  const identifier = `taxflow-${customerId}-${ts}`

  const body = new URLSearchParams({
    event_name: process.env.STRIPE_METER_EVENT_NAME ?? 'classification_usage',
    'payload[stripe_customer_id]': customerId,
    'payload[value]': String(count),
    timestamp: String(ts),
    identifier,
  })

  const res = await fetch(`${STRIPE_BASE}/billing/meter_events`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  })

  if (!res.ok) throw new Error(`Stripe Meter ${res.status}`)
  console.info(`[billing] Stripe +${count} customer=${customerId}`)
}

/** Paddle 시도 → 실패 시 Stripe fallback */
async function recordUsage(profile: {
  paddle_subscription_id?: string | null
  stripe_customer_id?: string | null
}, count: number): Promise<void> {
  if (profile.paddle_subscription_id) {
    try {
      await paddleRecordUsage(profile.paddle_subscription_id, count)
      return
    } catch (e) {
      if (e instanceof PaddleBillingError) {
        console.error('[billing] Paddle 4xx — Stripe fallback:', e.message)
      } else {
        console.warn('[billing] Paddle 실패 — Stripe fallback:', e)
      }
    }
  }
  if (profile.stripe_customer_id) {
    await stripeRecordUsage(profile.stripe_customer_id, count)
  }
}

// ─── Alert compensation ───────────────────────────────────────────────────────

async function insertAlertsWithCompensation(
  supabase: ReturnType<typeof createServerClient>,
  alerts: Array<{ user_id: string; type: string; message: string; risk_score: number; transaction_id: string }>
): Promise<void> {
  if (!alerts.length) return

  for (let attempt = 0; attempt < ALERT_MAX_RETRIES; attempt++) {
    const { error } = await supabase.from('tax_alerts').insert(alerts)
    if (!error) return
    if (attempt < ALERT_MAX_RETRIES - 1) {
      await sleep(ALERT_RETRY_DELAYS[attempt])
    } else {
      // Dead letter 저장
      supabase
        .from('alert_dead_letter')
        .insert({ user_id: alerts[0]?.user_id, payload: JSON.stringify(alerts), created_at: new Date().toISOString() })
        .then((res: { error: unknown }) => { if (res.error) console.error('[alert] dead_letter 저장 실패:', res.error) })
    }
  }
}

// ─── Rate limit ───────────────────────────────────────────────────────────────

async function checkRateLimit(
  supabase: ReturnType<typeof createServerClient>,
  userId: string
): Promise<boolean> {
  const since = new Date(Date.now() - 3_600_000).toISOString()
  const { count } = await supabase
    .from('classify_requests')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', since)

  return (count ?? 0) < RATE_LIMIT_PER_HOUR
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function json(body: unknown, status: number): NextResponse {
  return NextResponse.json(body, { status })
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}

function nowMonth(): string {
  return new Date().toISOString().slice(0, 7)
}

const DISCLAIMER =
  '본 분석 결과는 AI가 생성한 참고용 정보이며, 법적 세무 조언이 아닙니다. ' +
  '실제 세금 신고 및 납부는 공인 세무사와 반드시 상담하시기 바랍니다.'

// ─── POST /api/classify ───────────────────────────────────────────────────────

export async function POST(req: Request): Promise<NextResponse> {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )

  // ── 1. Auth ──
  const { data: { session }, error: authErr } = await supabase.auth.getSession()
  if (authErr || !session?.user) {
    return json({ error: '인증이 필요합니다.' }, 401)
  }
  const userId = session.user.id

  // ── 2. Rate limit ──
  const allowed = await checkRateLimit(supabase, userId)
  if (!allowed) {
    return json({ error: '요청 한도를 초과했습니다. 1시간 후 다시 시도해 주세요.' }, 429)
  }

  // ── 3. Body parse ──
  let body: { transactionIds?: unknown; totalIncome?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: '요청 형식이 올바르지 않습니다.' }, 400)
  }

  if (!Array.isArray(body.transactionIds) || body.transactionIds.length === 0) {
    return json({ error: 'transactionIds 배열이 필요합니다.' }, 400)
  }
  const transactionIds: string[] = body.transactionIds.map(String)
  const totalIncome: number = typeof body.totalIncome === 'number' ? body.totalIncome : 0

  // ── 4. Profile load ──
  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('plan, business_type, is_simplified_vat, paddle_subscription_id, stripe_customer_id')
    .eq('id', userId)
    .single()

  if (profileErr || !profile) {
    return json({ error: '프로필을 찾을 수 없습니다.' }, 404)
  }

  const plan: string = profile.plan ?? 'free'
  const businessType: string = profile.business_type ?? '크리에이터'
  const isSimplifiedVat: boolean = profile.is_simplified_vat ?? false

  // ── 5. Free plan 월 사용량 체크 ──
  if (plan === 'free') {
    const month = nowMonth()
    const { count: usedCount } = await supabase
      .from('classify_usage')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', `${month}-01`)

    if ((usedCount ?? 0) >= FREE_MONTHLY_LIMIT) {
      return json({
        error: `무료 플랜은 월 ${FREE_MONTHLY_LIMIT}회까지 이용 가능합니다. Pro 업그레이드 후 무제한 이용하세요.`,
        upgradeRequired: true,
      }, 402)
    }
  }

  // ── 6. Ownership check ──
  const { data: txRows, error: txErr } = await supabase
    .from('transactions')
    .select('id, description, amount, date, memo')
    .in('id', transactionIds)
    .eq('user_id', userId)

  if (txErr || !txRows?.length) {
    return json({ error: '거래 내역을 찾을 수 없거나 접근 권한이 없습니다.' }, 403)
  }

  const transactions: RawTransaction[] = txRows.map((row: Record<string, unknown>) => ({
    id: String(row.id ?? ''),
    description: String(row.description ?? ''),
    amount: Number(row.amount ?? 0),
    date: String(row.date ?? new Date().toISOString().slice(0, 10)),
    memo: row.memo ? String(row.memo) : undefined,
  }))

  // ── 7. Tax law load ──
  const { data: taxLaws } = await supabase
    .from('tax_laws')
    .select('category, deduction_rate, notes')
    .eq('year', new Date().getFullYear())

  const taxLawMap = new Map<string, number>(
    (taxLaws ?? []).map(l => [l.category, l.deduction_rate ?? 1])
  )

  // ── 8. Classify ──
  let classified: ClassificationResult[]
  try {
    classified = await classifyTransactions(transactions, businessType, isSimplifiedVat)
  } catch (e) {
    console.error('[classify] classifyTransactions 오류:', e)
    return json({ error: '분류 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' }, 500)
  }

  // ── 9. Bulk DB update ──
  const updatePayloads = classified.map(c => ({
    id: c.transactionId,
    category: c.category,
    sub_category: c.subCategory,
    is_deductible: c.isDeductible,
    deduction_ratio: taxLawMap.get(c.category) ?? c.deductionRatio,
    confidence: c.confidence,
    risk_flags: c.riskFlags,
    ai_reasoning: c.reasoning,
    classified_at: new Date().toISOString(),
  }))

  const { error: updateErr } = await supabase
    .from('transactions')
    .upsert(updatePayloads, { onConflict: 'id' })

  if (updateErr) {
    console.error('[classify] bulk upsert 오류:', (updateErr as Error).message)
    // 비치명적 — 계속 진행
  }

  // ── 10. Optimizer ──
  let optimizer: DeductionOptimizerResult | null = null
  try {
    optimizer = await runDeductionOptimizer(classified, totalIncome, businessType, isSimplifiedVat)
  } catch (e) {
    console.error('[classify] optimizer 오류:', e)
    // 비치명적 — null로 계속
  }

  // ── 11. Alert insert + compensation ──
  const alerts = (optimizer?.anomalyAlerts ?? []).map(a => ({
    user_id: userId,
    type: a.type,
    message: a.message,
    risk_score: a.riskScore,
    transaction_id: a.transactionId,
  }))
  insertAlertsWithCompensation(supabase, alerts)
    .catch(e => console.error('[classify] alert 삽입 오류:', e))

  // ── 12. Usage billing (비동기 — 응답 차단 안 함) ──
  const txCount = classified.length
  ;(async () => {
    try {
      if (plan !== 'free') {
        await recordUsage(profile, txCount)
      }
      // 사용량 로그 기록
      await supabase.from('classify_usage').insert({
        user_id: userId,
        count: txCount,
        plan,
        created_at: new Date().toISOString(),
      })
      // rate limit 로그
      await supabase.from('classify_requests').insert({
        user_id: userId,
        created_at: new Date().toISOString(),
      })
    } catch (e) {
      console.error('[classify] billing/usage 기록 오류:', e)
    }
  })()

  // ── 13. Push notification (fire-and-forget) ──
  if (optimizer && optimizer.riskScore >= 70) {
    supabase.from('notifications').insert({
      user_id: userId,
      type: 'high_risk',
      message: `[참고용] 세금 위험도가 높게 감지되었습니다 (점수: ${optimizer.riskScore}). 검토를 권장드립니다.`,
      created_at: new Date().toISOString(),
    }).then(() => {})
  }

  // ── 14. Response ──
  return json({
    success: true,
    disclaimer: DISCLAIMER,
    summary: buildSummary(classified, optimizer),
    classified,
    optimizer,
  }, 200)
}

// ─── Summary builder ──────────────────────────────────────────────────────────

function buildSummary(
  classified: ClassificationResult[],
  opt: DeductionOptimizerResult | null
) {
  const n = classified.length || 1
  return {
    total: classified.length,
    deductible: classified.filter(c => c.isDeductible).length,
    reviewNeeded: classified.filter(c => c.riskFlags.includes('review_needed')).length,
    highConfidence: classified.filter(c => c.confidence >= 0.85).length,
    cacheHitRate: +((classified.filter(c => c.cacheSource !== 'claude').length / n).toFixed(3)),
    missedDeductionCount: opt?.missedDeductions?.length ?? 0,
    estimatedMissedSaving: opt?.missedDeductions?.reduce((s, m) => s + m.estimatedSaving, 0) ?? 0,
    estimatedTotalBurden: opt?.estimatedTotalBurden ?? 0,
    riskScore: opt?.riskScore ?? 0,
  }
}