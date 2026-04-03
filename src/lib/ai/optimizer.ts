/**
 * @file src/lib/ai/optimizer.ts
 * @description TaxFlow AI — Deduction Optimizer v7 Final
 */
import Anthropic from '@anthropic-ai/sdk'
import type { Transaction, ClassificationResult } from '@/types/transaction'

let _c: Anthropic | null = null
const ant = () => (_c ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! }))

export const CREATOR_SEASONAL_W = [
  0.07, 0.07, 0.08, 0.09, 0.09, 0.10,
  0.08, 0.09, 0.09, 0.10, 0.08, 0.06,
] as const

const BRACKETS = [
  { l: 14_000_000,    r: 0.06, d: 0 },
  { l: 50_000_000,    r: 0.15, d: 1_260_000 },
  { l: 88_000_000,    r: 0.24, d: 5_760_000 },
  { l: 150_000_000,   r: 0.35, d: 15_440_000 },
  { l: 300_000_000,   r: 0.38, d: 19_940_000 },
  { l: 500_000_000,   r: 0.40, d: 25_940_000 },
  { l: 1_000_000_000, r: 0.42, d: 35_940_000 },
  { l: Infinity,      r: 0.45, d: 65_940_000 },
]

function progressive(n: number): number {
  for (const b of BRACKETS) {
    if (n <= b.l) return Math.max(0, Math.round(n * b.r - b.d))
  }
  return 0
}

function marginal(n: number): number {
  for (const b of BRACKETS) { if (n <= b.l) return b.r }
  return 0.45
}

function fmt(n: number): string { return n.toLocaleString('ko-KR') }

const MISSED_PATTERNS: [RegExp, string][] = [
  [/adobe|figma|notion|slack|canva|github|vercel|chatgpt|openai/i, '202'],
  [/카메라|렌즈|조명|마이크|스피커|헤드폰|모니터/i, '202'],
  [/스튜디오|촬영|녹음|편집|작업실/i, '203'],
  [/구글광고|google ads|네이버광고|카카오광고/i, '201'],
  [/외주|프리랜서|디자인비|편집비|번역/i, '201'],
]

export async function runDeductionOptimizer(
  userId: string,
  transactions: Transaction[],
  classified: ClassificationResult[],
  taxLaw: Record<string, unknown>,
  opts: {
    year: number
    quarter?: number
    isSimplifiedVat?: boolean
    businessType?: string
  },
) {
  const { year, isSimplifiedVat = false } = opts
  const cmap = new Map(classified.map(c => [c.transactionId, c]))

  // ── 1. Aggregate ──────────────────────────────────────────────────────────
  let income = 0, deductible = 0, entertainment = 0, vehicle = 0
  const missed: any[] = []

  for (const tx of transactions) {
    const c = cmap.get(tx.id)
    if (!c) continue
    const amt = Math.abs(tx.amount ?? 0)

    if (c.taxCategory.startsWith('1')) {
      income += amt
      continue
    }

    if (!c.isDeductible) {
      for (const [re, cat] of MISSED_PATTERNS) {
        if (re.test(tx.description ?? '')) {
          missed.push({
            txId: tx.id,
            description: tx.description ?? '',
            amount: amt,
            suggestedCat: cat,
            estimatedSaving: Math.round(amt * marginal(income)),
          })
          break
        }
      }
      continue
    }

    deductible += amt
    if (c.taxCategory === '204') entertainment += amt
    if (c.taxCategory === '205') vehicle += amt * 0.5
  }

  // ── 2. 4대보험 ────────────────────────────────────────────────────────────
  const h = income * 0.0709
  const l = h * 0.1295
  const p = Math.min(income / 12, 5_900_000) * 12 * 0.09
  const e = income * 0.008
  const ins = {
    health: Math.round(h),
    ltci: Math.round(l),
    pension: Math.round(p),
    empIns: Math.round(e),
    totalAnnual: Math.round(h + l + p + e),
    monthlyEst: Math.round((h + l + p + e) / 12),
  }

  // ── 3. 간이과세 ───────────────────────────────────────────────────────────
  const vat = (!isSimplifiedVat || income >= 48_000_000)
    ? { applicable: false, annualPayment: 0, quarterlyPayment: 0, q1: 0, q2: 0, q3: 0, q4: 0, nextDue: '' }
    : (() => {
        const a = Math.round(income * 0.04)
        const q = Math.round(a / 4)
        const now = new Date()
        const nq = Math.ceil((now.getMonth() + 1) / 3)
        const dm = [4, 7, 10, 1][nq - 1]
        const dy = dm === 1 ? year + 1 : year
        return { applicable: true, annualPayment: a, quarterlyPayment: q, q1: q, q2: q, q3: q, q4: q, nextDue: `${dy}-${String(dm).padStart(2, '0')}-25` }
      })()

  // ── 4. 감가상각 ───────────────────────────────────────────────────────────
  const deprs = transactions.flatMap(tx => {
    const c = cmap.get(tx.id)
    if (!c?.riskFlags.includes('creator_equipment')) return []
    const amt = Math.abs(tx.amount ?? 0)
    if (amt < 500_000) return []
    const py = tx.date ? parseInt(tx.date.slice(0, 4), 10) : year
    const el = year - py
    if (el >= 5) return []
    const bv = amt * Math.pow(1 - 0.451, el)
    const ann = Math.round(bv * 0.451)
    return [{
      txId: tx.id,
      description: tx.description ?? '',
      originalAmt: amt,
      purchaseYear: py,
      yearsElapsed: el,
      annualDeduction: ann,
      bookValue: Math.max(Math.round(bv - ann), Math.round(amt * 0.1)),
    }]
  })

  // ── 5. Risk score ─────────────────────────────────────────────────────────
  let risk = 0
  for (const tx of transactions) {
    const c = cmap.get(tx.id)
    if (!c) continue
    const amt = Math.abs(tx.amount ?? 0)
    if (c.taxCategory === '402') risk += 2
    if (c.riskFlags.includes('missing_receipt')) risk += Math.min(1.5 * (amt / 100_000), 6)
    if (c.riskFlags.includes('review_needed')) risk += 2
    if (c.riskFlags.includes('high_amount') && amt > 500_000) risk += 3
    if (c.confidence < 0.6) risk += 1
  }
  if (entertainment > 3_600_000) risk += 10
  risk = Math.min(100, Math.round(risk))

  // ── 6. Forecast ───────────────────────────────────────────────────────────
  const dt = deprs.reduce((s, d) => s + d.annualDeduction, 0)
  const effDed = deductible - entertainment + Math.min(entertainment, 3_600_000) + dt + vehicle
  const taxable = Math.max(0, income - effDed - ins.totalAnnual)
  const incomeTax = progressive(taxable)
  const localTax = Math.round(incomeTax * 0.1)
  const vatPay = vat.applicable ? vat.annualPayment : Math.max(0, Math.round((income - deductible) * 0.1))
  const total = incomeTax + localTax + vatPay

  const mb: Record<string, number> = {}
  for (let m = 0; m < 12; m++) mb[`m${m + 1}`] = Math.round(total * CREATOR_SEASONAL_W[m])

  const messages = [
    `[참고용] 예상 소득세 약 ${fmt(incomeTax)}원, 지방소득세 약 ${fmt(localTax)}원으로 추정됩니다.`,
    `[참고용] 4대보험 월 약 ${fmt(ins.monthlyEst)}원 납부 준비를 권장드립니다.`,
    vat.applicable
      ? `[참고용] 간이과세 분기별 약 ${fmt(vat.quarterlyPayment)}원 납부 예정.`
      : `[참고용] 일반과세 부가세 약 ${fmt(vatPay)}원 예상됩니다.`,
  ]
  if (dt > 0) messages.push(`[참고용] 장비 감가상각 공제 가능 금액 약 ${fmt(dt)}원으로 추정됩니다.`)
  if (missed.length > 0) messages.push(`[참고용] 공제 누락 가능성 ${missed.length}건 — 검토 시 절세 가능성이 있습니다.`)

  const forecast = {
    taxableIncome: taxable, incomeTax, localTax,
    vatPayable: vatPay, insuranceAnnual: ins.totalAnnual,
    depreciationDeduction: dt, estimatedTotal: total,
    monthlyBreakdown: mb, messages,
  }

  // ── 7. Burnout ────────────────────────────────────────────────────────────
  const burnout = (() => {
    const mo: Record<string, number> = {}
    for (const tx of transactions) {
      if (!tx.date || (tx.amount ?? 0) <= 0) continue
      const m = tx.date.slice(0, 7)
      mo[m] = (mo[m] ?? 0) + tx.amount!
    }
    const vals = Object.values(mo)
    if (vals.length < 2) return { score: 0, cv: 0, trend: 'stable' as const, message: null }
    const mean = vals.reduce((s, v) => s + v, 0) / vals.length
    const cv = mean > 0
      ? Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length) / mean
      : 0
    const sorted = Object.entries(mo).sort(([a], [b]) => a.localeCompare(b))
    const rA = sorted.slice(-3).reduce((s, [, v]) => s + v, 0) / 3
    const pA = sorted.slice(-6, -3).reduce((s, [, v]) => s + v, 0) / (sorted.slice(-6, -3).length || 1)
    const trend = rA > pA * 1.1 ? 'growing' as const : rA < pA * 0.9 ? 'declining' as const : 'stable' as const
    const score = Math.min(100, Math.round(cv * 60 + (trend === 'declining' ? 20 : 0)))
    return {
      score, cv: Math.round(cv * 100) / 100, trend,
      message: score >= 60 ? '수입 변동성이 높아 세금 납부 준비금 확보를 권장드립니다. (참고용)' : null,
    }
  })()

  // ── 8. Claude 추천 ────────────────────────────────────────────────────────
  let recs: any[] = []
  try {
    const resp = await ant().messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 800,
      system: '크리에이터 세금 코치. 한국어. 법적 안전 표현만. JSON: {"recommendations":[]}',
      messages: [{ role: 'user', content: `수입:${income}원 공제:${deductible}원 위험:${risk}점 누락:${missed.length}건. 절세 추천 3가지` }],
    })
    const t = (resp.content.find((b: any) => b.type === 'text') as any)?.text ?? ''
    recs = (JSON.parse(t.replace(/```json|```/g, '').trim()).recommendations ?? []).slice(0, 3)
  } catch (err) {
    console.error('[optimizer] claude error:', err)
  }

  // ── 9. Alerts ─────────────────────────────────────────────────────────────
  const alerts: any[] = []
  if (vat.applicable) {
    alerts.push({ type: 'vat_quarterly', priority: 'medium', title: `간이과세 납부 예정 (${vat.nextDue})`, message: `분기별 약 ${fmt(vat.quarterlyPayment)}원. (참고용)`, savingsImpact: 0, actionRequired: false })
  }
  if (dt > 0) {
    alerts.push({ type: 'depreciation', priority: 'medium', title: '장비 감가상각 공제 가능성', message: `약 ${fmt(dt)}원 공제 가능성. (참고용)`, savingsImpact: Math.round(dt * marginal(income)), actionRequired: false })
  }
  const top = [...missed].sort((a: any, b: any) => b.estimatedSaving - a.estimatedSaving)[0]
  if (top) {
    alerts.push({ type: 'missed_deduction', priority: 'high', title: `공제 누락: ${top.description.slice(0, 25)}`, message: `약 ${fmt(top.estimatedSaving)}원 절세 가능성. (참고용)`, savingsImpact: top.estimatedSaving, actionRequired: true })
  }
  if (risk >= 70) {
    alerts.push({ type: 'risk_warning', priority: 'high', title: `세금 위험도 ${risk}점`, message: '세무사 상담 권장. (참고용)', savingsImpact: 0, actionRequired: true })
  }

  return {
    riskScore: risk,
    totalIncome: income,
    totalDeductible: deductible,
    cappedEntertainment: Math.min(entertainment, 3_600_000),
    estimatedTax: total,
    effectiveRate: income > 0 ? total / income : 0,
    insurance: ins,
    vatForecast: vat,
    depreciations: deprs,
    anomalies: [],
    alerts: [...alerts, ...recs].slice(0, 6),
    forecast,
    burnout,
    missedDeductions: missed,
    disclaimer: '※ 본 분석은 참고용 AI 코치 결과입니다. AI 판단은 법적 효력이 없습니다.',
  }
}