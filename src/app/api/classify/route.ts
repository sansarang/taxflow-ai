/**
 * @file src/app/api/classify/route.ts
 * @description TaxFlow AI — /api/classify v7 Final
 * Free: 월 5회 / Pro: 무제한+OCR / Business: 무제한+OCR+세무사
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { classifyTransactions } from '@/lib/ai/classifier'
import { runDeductionOptimizer } from '@/lib/ai/optimizer'
import { dispatchPushNotification } from '@/lib/notifications/push-dispatcher'
import { rateLimitCache } from '@/lib/redis/cache'
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import type { ClassificationResult } from '@/types/transaction'
import type { DeductionOptimizerResult } from '@/types/tax'

const FREE_LIMIT  = 5
const MAX_RETRIES = 3
const PADDLE_BASE = 'https://api.paddle.com'
const STRIPE_BASE = 'https://api.stripe.com/v1'
const TAX_FORM    = process.env.NEXT_PUBLIC_TAX_ADVISOR_FORM_URL ?? 'https://forms.gle/XXXXXXXXXX'
const DEFAULT_TAX_LAW = { year: new Date().getFullYear(), vatRate: 0.1, entertainmentCap: 3_600_000, simplifiedVatLimit: 48_000_000 }

const BodySchema = z.object({
  transactionIds: z.array(z.string().uuid()).min(1).max(500),
  year:    z.number().int().min(2020).max(2030).default(() => new Date().getFullYear()),
  quarter: z.number().int().min(1).max(4).optional(),
  receiptImages: z.array(z.object({
    base64: z.string(),
    mimeType: z.enum(['image/jpeg','image/png','image/webp','image/heic']),
    filename: z.string().optional(),
  })).max(5).optional(),
})

let _ant: Anthropic|null = null
const ant = () => (_ant ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! }))

export async function POST(req: NextRequest): Promise<NextResponse> {
  const supabase = await createServerClient()
  const { data: { user }, error: ae } = await supabase.auth.getUser()
  if (ae || !user) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })

  const rl = await rateLimitCache.checkUploadLimit(user.id)
  if (!rl.allowed) return NextResponse.json({ error: '시간당 업로드 한도를 초과했습니다.' }, { status: 429 })

  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: '요청 형식이 올바르지 않습니다.' }, { status: 400 })
  const { transactionIds, year, quarter, receiptImages } = parsed.data

  const { data: profile } = await supabase.from('profiles')
    .select('plan,business_type,is_simplified_vat,stripe_customer_id,paddle_subscription_id')
    .eq('id', user.id).single()

  const plan            = (profile?.plan as string) ?? 'free'
  const isSimplifiedVat = (profile?.is_simplified_vat as boolean) ?? false
  const businessType    = (profile?.business_type as string) ?? 'creator'
  const isFree = plan === 'free', isBiz = plan === 'business'

  // Free 월 5회 체크
  if (isFree) {
    const { data: ur } = await supabase.from('usage_logs').select('count').eq('user_id', user.id).eq('month', nowM()).maybeSingle()
    const used = (ur as any)?.count ?? 0
    if (used + transactionIds.length > FREE_LIMIT) {
      const missed = await estimateMissed(supabase, user.id)
      return NextResponse.json(buildLimitResp(used, FREE_LIMIT - used, missed), { status: 402 })
    }
  }

  const { data: txRows, error: txe } = await supabase.from('transactions').select('*').in('id', transactionIds).eq('user_id', user.id)
  if (txe || !txRows?.length) return NextResponse.json({ error: '거래 내역을 찾을 수 없습니다.' }, { status: 404 })
  if (txRows.length !== transactionIds.length) return NextResponse.json({ error: '접근 권한 오류.' }, { status: 403 })

  let taxLaw: Record<string, unknown> = DEFAULT_TAX_LAW
  try { const { data: l } = await supabase.from('tax_law_table').select('data').eq('year', year).single(); if (l?.data) taxLaw = l.data as Record<string, unknown> } catch {}

  // 영수증 OCR (Pro/Business 전용)
  const ocrResults: OcrResult[] = []
  if (!isFree && receiptImages?.length) {
    for (const img of receiptImages) {
      const ocr = await ocrReceipt(img.base64, img.mimeType)
      if (ocr) { ocrResults.push(ocr); await saveReceipt(supabase, user.id, img.base64, img.mimeType, ocr, img.filename) }
    }
  }

  let classified: ClassificationResult[]
  try { classified = await classifyTransactions(user.id, txRows as any, taxLaw, businessType) }
  catch (e) { console.error('[classify]', e); return NextResponse.json({ error: '분류 처리 중 오류가 발생했습니다.' }, { status: 500 }) }

  await Promise.allSettled(classified.map(c =>
    supabase.from('transactions').update({ tax_category:c.taxCategory, is_deductible:c.isDeductible, confidence:c.confidence, risk_flags:c.riskFlags, vendor:c.vendor, korean_reason:c.koreanReason, classified_at:new Date().toISOString(), cache_source:c.cacheSource }).eq('id', c.transactionId).eq('user_id', user.id)
  ))

  let optimizer: DeductionOptimizerResult|null = null
  try { optimizer = await runDeductionOptimizer(user.id, txRows as any, classified, taxLaw, { year, quarter, isSimplifiedVat, businessType }) }
  catch (e) { console.error('[optimizer]', e) }

  let alerts: any[] = []
  if (optimizer?.alerts?.length) alerts = await insertAlerts(supabase, user.id, optimizer.alerts)

  recordUsage(supabase, user.id, plan, classified.length, profile).catch(e => console.error('[billing]', e))
  if (!isFree && alerts.length > 0) dispatchPushNotification(user.id, alerts.slice(0, 3)).catch(() => {})

  const freeTeaser = isFree ? buildInlineTeaser(classified, optimizer) : null
  const bizData = isBiz ? { taxAdvisorFormUrl: TAX_FORM, canRequestAdvisor: true } : null

  return NextResponse.json({
    classified: classified.length, riskScore: optimizer?.riskScore ?? 0,
    alerts: alerts.slice(0, 5), forecast: optimizer?.forecast ?? null,
    forecastMessages: optimizer?.forecast?.messages ?? [],
    insurance: optimizer?.insurance ?? null, vatForecast: optimizer?.vatForecast ?? null,
    depreciations: optimizer?.depreciations ?? [],
    burnout: isFree ? null : (optimizer?.burnout ?? null),
    missedDeductions: optimizer?.missedDeductions ?? [],
    ocrResults: isFree ? [] : ocrResults,
    summary: buildSummary(classified, optimizer), freeTeaser, bizData,
    disclaimer: '※ 본 분석은 참고용 AI 코치 결과입니다. 최종 세금 신고 시 세무사와 함께 확인하시길 권장드립니다. AI 판단은 법적 효력이 없습니다.',
  })
}

function buildLimitResp(used: number, remaining: number, missed: { amount: number; riskScore: number }) {
  const { amount, riskScore } = missed
  return {
    error: 'free_limit_reached', code: 'UPGRADE_REQUIRED',
    currentUsage: used, limit: FREE_LIMIT, remaining: Math.max(0, remaining),
    teaser: {
      bannerMessage: amount > 0 ? `이번 달 놓친 공제 ${fmt(amount)}원 → Pro에서 바로 확인하세요 (첫 달 19,500원)` : '이번 달 공제 누락 가능성이 감지됩니다. Pro 상세 분석을 권장드립니다. (참고용)',
      modalTitle: '공제 기회를 놓치고 계십니다',
      modalBody: 'Pro 사용자들은 실시간으로 놓친 공제를 카카오톡으로 받고 있습니다. 지금 업그레이드하면 첫 달 19,500원에 이용 가능합니다.',
      riskMessage: riskScore >= 60 ? `세금 위험도 ${riskScore}점 — Pro 전환 시 매일 위험 알림 수신 가능성이 있습니다. (참고용)` : null,
      missedAmountKrw: amount, riskScore,
      proPrice: '19,500원 (첫 달 50% 할인)', bizPrice: '44,500원 (첫 달 50% 할인)',
      proCheckoutUrl: '/api/checkout?plan=pro&ref=limit', bizCheckoutUrl: '/api/checkout?plan=business&ref=limit',
    },
    disclaimer: '※ 참고용 AI 코치 결과입니다. AI 판단은 법적 효력이 없습니다.',
  }
}

function buildInlineTeaser(c: ClassificationResult[], opt: DeductionOptimizerResult|null): object|null {
  if (!opt) return null
  const top  = [...(opt.missedDeductions??[])].sort((a:any,b:any)=>b.estimatedSaving-a.estimatedSaving)[0]
  const risk = opt.riskScore ?? 0
  const depr = (opt.depreciations??[]).reduce((s:number,d:any)=>s+d.annualDeduction,0)
  if (!top && risk < 30 && depr === 0) return null
  const msgs: string[] = []
  if (top)        msgs.push(`공제 누락 가능성: ${top.description?.slice(0,20)} — 약 ${fmt(top.estimatedSaving)}원 (참고용)`)
  if (risk >= 50) msgs.push(`세금 위험도 ${risk}점 — Pro 실시간 알림 권장 (참고용)`)
  if (depr)       msgs.push(`장비 감가상각 공제 약 ${fmt(depr)}원 — Pro 상세 분석 가능 (참고용)`)
  msgs.push('번아웃 시뮬레이터·주간 리포트는 Pro에서 이용하실 수 있습니다.')
  return { messages: msgs, proPrice: '19,500원', proCheckoutUrl: '/api/checkout?plan=pro&ref=inline' }
}

interface OcrResult { description:string; amount:number; date:string|null; vendor:string; category:string; isDeductible:boolean; rawText:string }

async function ocrReceipt(base64: string, mimeType: string): Promise<OcrResult|null> {
  try {
    const resp = await ant().messages.create({
      model: 'claude-sonnet-4-20250514', max_tokens: 500,
      system: '한국 영수증 OCR. JSON만 출력: {"description":"가맹점명","amount":숫자,"date":"YYYY-MM-DD or null","vendor":"업체명","category":"소프트웨어구독|장비구입|광고비|접대비|소모품비|기타","isDeductible":true/false,"rawText":"텍스트요약"}. 모든 판단 참고용, 법적 효력 없음.',
      messages: [{ role:'user', content:[{ type:'image', source:{ type:'base64', media_type:mimeType as any, data:base64 } },{ type:'text', text:'이 영수증을 분석해주세요.' }] }],
    })
    const text = (resp.content.find(b=>b.type==='text') as Anthropic.TextBlock)?.text ?? ''
    return JSON.parse(text.replace(/```json|```/g,'').trim()) as OcrResult
  } catch (e) { console.error('[OCR]', e); return null }
}

async function saveReceipt(supabase: any, userId: string, base64: string, mimeType: string, ocr: OcrResult, filename?: string) {
  try {
    const ext = mimeType.split('/')[1] ?? 'jpg'
    const key = `${userId}/${Date.now()}.${ext}`
    await supabase.storage.from('receipts').upload(key, Buffer.from(base64,'base64'), { contentType:mimeType, upsert:false })
    const { data: { publicUrl } } = supabase.storage.from('receipts').getPublicUrl(key)
    await supabase.from('receipts').insert({ user_id:userId, description:ocr.description, amount:ocr.amount, date:ocr.date, vendor:ocr.vendor, category:ocr.category, is_deductible:ocr.isDeductible, image_url:publicUrl, raw_text:ocr.rawText, created_at:new Date().toISOString() })
  } catch (e) { console.error('[saveReceipt]', e) }
}

async function estimateMissed(supabase: any, userId: string): Promise<{ amount:number; riskScore:number }> {
  try {
    const { data } = await supabase.from('transactions').select('amount,is_deductible,risk_flags').eq('user_id',userId).gte('date',`${new Date().getFullYear()}-01-01`).limit(200)
    if (!data?.length) return { amount:0, riskScore:0 }
    const missed = (data as any[]).filter(t=>t.risk_flags?.includes('review_needed')||!t.is_deductible).reduce((s,t)=>s+Math.abs(t.amount??0),0)
    const rc = (data as any[]).filter(t=>t.risk_flags?.includes('review_needed')).length
    return { amount:Math.round(missed*0.15), riskScore:Math.min(100,Math.round((rc/data.length)*150)) }
  } catch { return { amount:0, riskScore:0 } }
}

async function insertAlerts(supabase: any, userId: string, alerts: any[]): Promise<any[]> {
  const ins: any[] = [], dead: any[] = []
  await Promise.all(alerts.slice(0,6).map(async a => {
    let le: unknown
    for (let i=0; i<MAX_RETRIES; i++) {
      try {
        const { data, error } = await supabase.from('optimization_alerts').insert({ user_id:userId, type:a.type??'general', priority:a.priority??'medium', title:a.title, message:a.message, savings_impact:a.savingsImpact??0, action_required:a.actionRequired??false, created_at:new Date().toISOString() }).select().single()
        if (error) throw error; ins.push(data); return
      } catch (e) { le=e; await sl(150*2**i) }
    }
    dead.push({ alert:a, error:String(le) })
  }))
  if (dead.length) supabase.from('alert_dead_letter').insert(dead.map(d=>({ user_id:userId, payload:d.alert, error_message:d.error, created_at:new Date().toISOString() }))).then(()=>{}).catch((e:unknown)=>console.error('[dead_letter]',e))
  return ins
}

async function recordUsage(sb: any, uid: string, plan: string, count: number, profile: any) {
  await sb.from('usage_logs').upsert({ user_id:uid, month:nowM(), count }, { onConflict:'user_id,month' }).catch(()=>{})
  if (plan === 'free') return
  const cfg = paddleCfg()
  if (cfg && profile?.paddle_subscription_id) { await paddleUsage(profile.paddle_subscription_id,count,cfg).catch(e=>console.error('[Paddle]',e)); return }
  if (process.env.STRIPE_SECRET_KEY && profile?.stripe_customer_id) await stripeUsage(profile.stripe_customer_id,count).catch(e=>console.error('[Stripe]',e))
}

function paddleCfg() {
  const k=process.env.PADDLE_API_KEY, p=process.env.PADDLE_USAGE_PRICE_ID
  if (!k||!p) return null
  const m=process.env.PADDLE_PRORATION_MODE??'prorated_immediately'
  return { k, p, m:(m==='prorated_next_billing_period'?m:'prorated_immediately') as 'prorated_immediately'|'prorated_next_billing_period' }
}

async function paddleUsage(subId: string, count: number, cfg: NonNullable<ReturnType<typeof paddleCfg>>) {
  const { k, p, m } = cfg
  const g = await fetch(`${PADDLE_BASE}/subscriptions/${subId}`, { headers:{ Authorization:`Bearer ${k}`, 'Content-Type':'application/json' } })
  if (!g.ok) throw new Error(`Paddle GET ${g.status}`)
  const sub = await g.json() as { data?:{ items?:{ price?:{ id:string }; quantity?:number }[] } }
  const item = sub.data?.items?.find(i=>i.price?.id===p)
  if (!item) throw new Error(`Paddle price ${p} not in sub`)
  const iKey = `taxflow-${subId}-${Math.floor(Date.now()/60_000)}`
  const r = await fetch(`${PADDLE_BASE}/subscriptions/${subId}`, { method:'PATCH', headers:{ Authorization:`Bearer ${k}`, 'Content-Type':'application/json', 'Paddle-Version':'1', 'Idempotency-Key':iKey }, body:JSON.stringify({ proration_billing_mode:m, items:[{ price_id:p, quantity:(item.quantity??0)+count }] }) })
  if (!r.ok) throw new Error(`Paddle PATCH ${r.status}`)
}

async function stripeUsage(cid: string, count: number) {
  const ts=Math.floor(Date.now()/1000)
  const r = await fetch(`${STRIPE_BASE}/billing/meter_events`, { method:'POST', headers:{ Authorization:`Bearer ${process.env.STRIPE_SECRET_KEY}`, 'Content-Type':'application/x-www-form-urlencoded' }, body:new URLSearchParams({ event_name:process.env.STRIPE_METER_EVENT_NAME??'classification_usage', 'payload[stripe_customer_id]':cid, 'payload[value]':String(count), timestamp:String(ts), identifier:`taxflow-${cid}-${ts}` }) })
  if (!r.ok) throw new Error(`Stripe ${r.status}`)
}

function buildSummary(c: ClassificationResult[], opt: DeductionOptimizerResult|null) {
  const n=c.length||1
  return { total:c.length, deductible:c.filter(x=>x.isDeductible).length, reviewNeeded:c.filter(x=>x.riskFlags?.includes('review_needed')).length, highConfidence:c.filter(x=>x.confidence>=0.85).length, cacheHitRate:+((c.filter(x=>x.cacheSource!=='claude').length/n).toFixed(3)), missedDeductionCount:opt?.missedDeductions?.length??0, estimatedMissedSaving:opt?.missedDeductions?.reduce((s:number,m:any)=>s+m.estimatedSaving,0)??0 }
}

const sl    = (ms: number) => new Promise<void>(r => setTimeout(r, ms))
const nowM  = ()           => new Date().toISOString().slice(0, 7)
const fmt   = (n: number)  => n.toLocaleString('ko-KR')
