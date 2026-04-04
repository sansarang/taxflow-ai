content = r"""/**
 * @file src/app/api/classify/route.ts
 * @description TaxFlow AI — /api/classify v7 Final
 */

import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { classifyTransactions, type RawTransaction } from '@/lib/ai/classifier'
import { runDeductionOptimizer, type DeductionOptimizerResult } from '@/lib/ai/optimizer'
import type { ClassificationResult } from '@/lib/ai/classifier'

const PADDLE_BASE = 'https://api.paddle.com'
const STRIPE_BASE = 'https://api.stripe.com/v1'
const FREE_MONTHLY_LIMIT = 5
const RATE_LIMIT_PER_HOUR = 20
const ALERT_MAX_RETRIES = 3
const ALERT_RETRY_DELAYS = [150, 300, 600]

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

  const getRes = await fetch(`${PADDLE_BASE}/subscriptions/${subscriptionId}`, {
    headers: { Authorization: `Bearer ${cfg.apiKey}`, 'Paddle-Version': '1' },
  })
  if (!getRes.ok) {
    const status = getRes.status
    if (status >= 400 && status < 500) throw new PaddleBillingError(`Paddle GET ${status}`, status)
    throw new Error(`Paddle GET ${status}`)
  }

  const sub: { data?: { items?: Array<{ price?: { id: string }; quantity?: number; status?: string }> } } =
    await getRes.json()

  const item = sub.data?.items?.find(
    i => i.price?.id === cfg.priceId && i.status !== 'trialing_canceled'
  )
  if (!item) throw new PaddleBillingError(`Paddle: price ${cfg.priceId} not found`, 404)

  const currentQty: number = typeof item.quantity === 'number' ? item.quantity : 0
  const idempKey = `taxflow-usage-${subscriptionId}-${Math.floor(Date.now() / 60_000)}`

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
    if (status >= 400 && status < 500) throw new PaddleBillingError(`Paddle PATCH ${status}`, status)
    throw new Error(`Paddle PATCH ${status}`)
  }
  console.info(`[billing] Paddle +${count} sub=${subscriptionId}`)
}

async function stripeRecordUsage(customerId: string, count: number): Promise<void> {
  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) throw new Error('STRIPE_SECRET_KEY 미설정')
  const ts = Math.floor(Date.now() / 1000)
  const body = new URLSearchParams({
    event_name: process.env.STRIPE_METER_EVENT_NAME ?? 'classification_usage',
    'payload[stripe_customer_id]': customerId,
    'payload[value]': String(count),
    timestamp: String(ts),
    identifier: `taxflow-${customerId}-${ts}`,
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

async function recordUsage(
  profile: { paddle_subscription_id?: string | null; stripe_customer_id?: string | null },
  count: number
): Promise<void> {
  if (profile.paddle_subscription_id) {
    try {
      await paddleRecordUsage(profile.paddle_subscription_id, count)
      return
    } catch (e) {
      console.warn('[billing] Paddle 실패 — Stripe fallback:', e)
    }
  }
  if (profile.stripe_customer_id) {
    await stripeRecordUsage(profile.stripe_customer_id, count)
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}

type SupabaseClient = ReturnType<typeof createServerClient>

async function insertAlertsWithCompensation(
  supabase: SupabaseClient,
  alerts: Array<{ user_id: string; type: string; message: string; risk_score: number; transaction_id: string }>
): Promise<void> {
  if (!alerts.length) return
  for (let attempt = 0; attempt < ALERT_MAX_RETRIES; attempt++) {
    const { error } = await supabase.from('tax_alerts').insert(alerts)
    if (!error) return
    if (attempt < ALERT_MAX_RETRIES - 1) {
      await sleep(ALERT_RETRY_DELAYS[attempt])
    } else {
      supabase
        .from('alert_dead_letter')
        .insert({ user_id: alerts[0]?.user_id, payload: JSON.stringify(alerts), created_at: new Date().toISOString() })
        .then((res: { error: unknown }) => { if (res.error) console.error('[alert] dead_letter 실패:', res.error) })
    }
  }
}

async function checkRateLimit(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const since = new Date(Date.now() - 3_600_000).toISOString()
  const { count } = await supabase
    .from('classify_requests')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', since)
  return (count ?? 0) < RATE_LIMIT_PER_HOUR
}

function json(body: unknown, status: number): NextResponse {
  return NextResponse.json(body, { status })
}

function nowMonth(): string {
  return new Date().toISOString().slice(0, 7)
}

const DISCLAIMER =
  '본 분석 결과는 AI가 생성한 참고용 정보이며, 법적 세무 조언이 아닙니다. ' +
  '실제 세금 신고 및 납부는 공인 세무사와 반드시 상담하시기 바랍니다.'

export async function POST(req: Request): Promise<NextResponse> {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )

  const { data: { session }, error: authErr } = await supabase.auth.getSession()
  if (authErr || !session?.user) return json({ error: '인증이 필요합니다.' }, 401)
  const userId = session.user.id

  const allowed = await checkRateLimit(supabase, userId)
  if (!allowed) return json({ error: '요청 한도 초과. 1시간 후 재시도해 주세요.' }, 429)

  let body: { transactionIds?: unknown; totalIncome?: unknown }
  try { body = await req.json() }
  catch { return json({ error: '요청 형식이 올바르지 않습니다.' }, 400) }

  if (!Array.isArray(body.transactionIds) || body.transactionIds.length === 0)
    return json({ error: 'transactionIds 배열이 필요합니다.' }, 400)

  const transactionIds: string[] = body.transactionIds.map(String)
  const totalIncome: number = typeof body.totalIncome === 'number' ? body.totalIncome : 0

  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('plan, business_type, is_simplified_vat, paddle_subscription_id, stripe_customer_id')
    .eq('id', userId)
    .single()
  if (profileErr || !profile) return json({ error: '프로필을 찾을 수 없습니다.' }, 404)

  const plan: string = (profile as Record<string, unknown>).plan as string ?? 'free'
  const businessType: string = (profile as Record<string, unknown>).business_type as string ?? '크리에이터'
  const isSimplifiedVat: boolean = Boolean((profile as Record<string, unknown>).is_simplified_vat)

  if (plan === 'free') {
    const month = nowMonth()
    const { count: usedCount } = await supabase
      .from('classify_usage')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', `${month}-01`)
    if ((usedCount ?? 0) >= FREE_MONTHLY_LIMIT)
      return json({ error: `무료 플랜은 월 ${FREE_MONTHLY_LIMIT}회 제한. Pro로 업그레이드하세요.`, upgradeRequired: true }, 402)
  }

  const { data: txRows, error: txErr } = await supabase
    .from('transactions')
    .select('id, description, amount, date, memo')
    .in('id', transactionIds)
    .eq('user_id', userId)
  if (txErr || !txRows?.length) return json({ error: '거래 내역 접근 권한이 없습니다.' }, 403)

  const transactions: RawTransaction[] = (txRows as Record<string, unknown>[]).map(row => ({
    id: String(row.id ?? ''),
    description: String(row.description ?? ''),
    amount: Number(row.amount ?? 0),
    date: String(row.date ?? new Date().toISOString().slice(0, 10)),
    memo: row.memo ? String(row.memo) : undefined,
  }))

  const { data: taxLaws } = await supabase
    .from('tax_laws')
    .select('category, deduction_rate')
    .eq('year', new Date().getFullYear())
  const taxLawMap = new Map<string, number>(
    ((taxLaws ?? []) as Record<string, unknown>[]).map(l => [String(l.category), Number(l.deduction_rate ?? 1)])
  )

  let classified: ClassificationResult[]
  try {
    classified = await classifyTransactions(transactions, businessType, isSimplifiedVat)
  } catch (e) {
    console.error('[classify] 오류:', e)
    return json({ error: '분류 중 오류가 발생했습니다.' }, 500)
  }

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
  const { error: updateErr } = await supabase.from('transactions').upsert(updatePayloads, { onConflict: 'id' })
  if (updateErr) console.error('[classify] upsert 오류:', (updateErr as Error).message)

  let optimizer: DeductionOptimizerResult | null = null
  try {
    optimizer = await runDeductionOptimizer(classified, totalIncome, businessType, isSimplifiedVat)
  } catch (e) {
    console.error('[classify] optimizer 오류:', e)
  }

  const alerts = (optimizer?.anomalyAlerts ?? []).map(a => ({
    user_id: userId,
    type: a.type,
    message: a.message,
    risk_score: a.riskScore,
    transaction_id: a.transactionId,
  }))
  insertAlertsWithCompensation(supabase, alerts)
    .catch(e => console.error('[classify] alert 오류:', e))

  const txCount = classified.length
  ;(async () => {
    try {
      if (plan !== 'free') await recordUsage(profile as { paddle_subscription_id?: string; stripe_customer_id?: string }, txCount)
      await supabase.from('classify_usage').insert({ user_id: userId, count: txCount, plan, created_at: new Date().toISOString() })
      await supabase.from('classify_requests').insert({ user_id: userId, created_at: new Date().toISOString() })
    } catch (e) {
      console.error('[classify] billing 오류:', e)
    }
  })()

  if (optimizer && optimizer.riskScore >= 70) {
    supabase.from('notifications').insert({
      user_id: userId,
      type: 'high_risk',
      message: `[참고용] 세금 위험도 높음 (점수: ${optimizer.riskScore}). 검토 권장.`,
      created_at: new Date().toISOString(),
    }).then(() => {})
  }

  return json({ success: true, disclaimer: DISCLAIMER, summary: buildSummary(classified, optimizer), classified, optimizer }, 200)
}

function buildSummary(classified: ClassificationResult[], opt: DeductionOptimizerResult | null) {
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
"""

with open("src/app/api/classify/route.ts", "w", encoding="utf-8") as f:
    f.write(content)

print("✅ route.ts 작성 완료")