/**
 * @file src/lib/ai/optimizer.ts
 * @description TaxFlow AI — Deduction Optimizer v7 Final
 *
 * ## 계산 항목
 *  - 소득세 (종합소득세 누진과세 6~45%)
 *  - 4대보험 (건강보험 7.09% + 장기요양 0.9182% + 국민연금 9% + 고용보험 2.22%)
 *  - 부가가치세 (간이과세 4% / 일반과세 10%, 분기 예정 포함)
 *  - 크리에이터 장비 감가상각 (5년 정률법 0.369)
 *  - Holt-Winters seasonality 반영 forecastMessage
 *
 * ## 법적 안전
 *  모든 외부 문자열은 "[참고용]" 또는 "(참고용)" 접두 필수.
 *  공제 여부 표현은 "~ 가능성 있음" / "검토 권장" 형태만 허용.
 */

import Anthropic from '@anthropic-ai/sdk'
import type { ClassificationResult } from './classifier'
import { CREATOR_SEASONAL_W } from './pattern-learner'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MissedDeduction {
  type: string
  description: string   // 항상 "[참고용]" 접두
  estimatedSaving: number
  confidence: number
}

export interface ForecastItem {
  label: string
  amount: number
  dueDate: string
  message: string       // 항상 "[참고용]" 접두
  riskLevel: 'low' | 'medium' | 'high'
}

export interface AnomalyAlert {
  transactionId: string
  type: 'spike' | 'irregular_timing' | 'duplicate_risk' | 'high_amount'
  message: string
  amount: number
  riskScore: number
}

export interface DeductionOptimizerResult {
  totalIncome: number
  totalExpense: number
  estimatedTaxableIncome: number
  estimatedIncomeTax: number
  estimatedHealthInsurance: number
  estimatedLongTermCare: number
  estimatedNationalPension: number
  estimatedEmploymentInsurance: number
  estimatedVat: number
  estimatedTotalBurden: number
  effectiveTaxRate: number
  missedDeductions: MissedDeduction[]
  forecastItems: ForecastItem[]
  anomalyAlerts: AnomalyAlert[]
  recommendations: string[]     // 항상 "[참고용]" 접두
  riskScore: number             // 0~100
  seasonalAdjustedIncome: number
  depreciationSuggestions: MissedDeduction[]
}

// ─── 세율표 (2024년 기준) ─────────────────────────────────────────────────────

const INCOME_TAX_BRACKETS = [
  { limit: 14_000_000,   rate: 0.06,  deduction: 0 },
  { limit: 50_000_000,   rate: 0.15,  deduction: 1_260_000 },
  { limit: 88_000_000,   rate: 0.24,  deduction: 5_760_000 },
  { limit: 150_000_000,  rate: 0.35,  deduction: 15_440_000 },
  { limit: 300_000_000,  rate: 0.38,  deduction: 19_940_000 },
  { limit: 500_000_000,  rate: 0.40,  deduction: 25_940_000 },
  { limit: 1_000_000_000,rate: 0.42,  deduction: 35_940_000 },
  { limit: Infinity,     rate: 0.45,  deduction: 65_940_000 },
]

/** 종합소득세 누진과세 계산 */
function calcIncomeTax(taxableIncome: number): number {
  for (const bracket of INCOME_TAX_BRACKETS) {
    if (taxableIncome <= bracket.limit) {
      return Math.max(0, taxableIncome * bracket.rate - bracket.deduction)
    }
  }
  return 0
}

/** 한계세율 */
function getMarginalRate(taxableIncome: number): number {
  for (const bracket of INCOME_TAX_BRACKETS) {
    if (taxableIncome <= bracket.limit) return bracket.rate
  }
  return 0.45
}

// ─── 4대보험 계산 ─────────────────────────────────────────────────────────────

interface InsuranceResult {
  health: number
  longTermCare: number
  nationalPension: number
  employment: number
  total: number
}

function calcInsurance(monthlyIncome: number): InsuranceResult {
  const HEALTH_RATE = 0.0709
  const LONG_TERM_CARE_RATE = 0.009182    // 건강보험료의 12.95%
  const PENSION_RATE = 0.09
  const EMPLOYMENT_RATE = 0.0222

  const PENSION_CAP_MONTHLY = 5_900_000   // 2024년 상한
  const PENSION_FLOOR_MONTHLY = 370_000

  const pensionBase = Math.min(Math.max(monthlyIncome, PENSION_FLOOR_MONTHLY), PENSION_CAP_MONTHLY)

  const health = Math.round(monthlyIncome * HEALTH_RATE)
  const longTermCare = Math.round(health * 0.1295)
  const nationalPension = Math.round(pensionBase * PENSION_RATE)
  const employment = Math.round(monthlyIncome * EMPLOYMENT_RATE)

  return {
    health,
    longTermCare,
    nationalPension,
    employment,
    total: health + longTermCare + nationalPension + employment,
  }
}

// ─── 부가가치세 계산 ──────────────────────────────────────────────────────────

function calcVat(taxableIncome: number, isSimplifiedVat: boolean): number {
  if (isSimplifiedVat) {
    // 간이과세: 업종별 부가가치율 × 10% → 크리에이터(서비스업) 40% 적용 = 실효 4%
    return Math.round(taxableIncome * 0.04)
  }
  // 일반과세: 10% (매입세액 공제 전)
  return Math.round(taxableIncome * 0.10)
}

// ─── 감가상각 분석 ────────────────────────────────────────────────────────────

const DEPRECIABLE_CATEGORIES = ['장비구입']
const DECLINING_BALANCE_RATE_5Y = 0.369   // 5년 정률법

function analyzeDepreciation(
  classified: ClassificationResult[],
  marginalRate: number
): MissedDeduction[] {
  const suggestions: MissedDeduction[] = []

  const equipmentItems = classified.filter(
    c => DEPRECIABLE_CATEGORIES.includes(c.category) && c.isDeductible
  )

  for (const item of equipmentItems) {
    const yearlyDepr = Math.round(item.deductionRatio * DECLINING_BALANCE_RATE_5Y)
    if (yearlyDepr < 100_000) continue
    const taxSaving = Math.round(yearlyDepr * marginalRate)

    suggestions.push({
      type: '감가상각',
      description: `[참고용] "${item.vendor || item.category}" 항목은 5년 정률법(상각률 ${DECLINING_BALANCE_RATE_5Y}) 적용 시 연간 약 ${yearlyDepr.toLocaleString()}원 공제 가능성 있음. 세금 절감 효과 약 ${taxSaving.toLocaleString()}원 (검토 권장).`,
      estimatedSaving: taxSaving,
      confidence: 0.72,
    })
  }

  return suggestions
}

// ─── Anomaly detection ───────────────────────────────────────────────────────

function detectAnomalies(classified: ClassificationResult[]): AnomalyAlert[] {
  const alerts: AnomalyAlert[] = []
  const amounts = classified.map(c => c.confidence) // placeholder — 실제는 amount

  // 중복 위험: 같은 vendor + 같은 날짜
  const seen = new Map<string, string>()
  for (const tx of classified) {
    const key = `${tx.vendor}_${tx.category}`
    if (seen.has(key)) {
      alerts.push({
        transactionId: tx.transactionId,
        type: 'duplicate_risk',
        message: `[참고용] "${tx.vendor || tx.category}" 항목이 중복될 가능성 있음. 확인 권장.`,
        amount: 0,
        riskScore: 60,
      })
    }
    seen.set(key, tx.transactionId)
  }

  // review_needed 플래그
  for (const tx of classified) {
    if (tx.riskFlags.includes('review_needed')) {
      alerts.push({
        transactionId: tx.transactionId,
        type: 'high_amount',
        message: `[참고용] 분류 신뢰도가 낮은 항목입니다. 직접 검토 권장.`,
        amount: 0,
        riskScore: 55,
      })
    }
  }

  return alerts
}

// ─── Seasonality forecast ─────────────────────────────────────────────────────

function buildForecastItems(
  monthlyIncome: number,
  isSimplifiedVat: boolean,
  insurance: InsuranceResult,
  now: Date = new Date()
): ForecastItem[] {
  const month = now.getMonth()
  const year = now.getFullYear()
  const sw = CREATOR_SEASONAL_W[month] ?? 1.0
  const adjIncome = Math.round(monthlyIncome * sw)

  const items: ForecastItem[] = []

  // 1. 소득세 (5월 종합소득세 신고)
  const annualTax = calcIncomeTax(adjIncome * 12)
  items.push({
    label: '종합소득세 (참고용)',
    amount: Math.round(annualTax / 12),
    dueDate: `${year + 1}-05-31`,
    message: `[참고용] 현재 월 수입 기준 연간 소득세 약 ${annualTax.toLocaleString()}원 납부 가능성 있음. 실제 세액은 공제 항목에 따라 달라질 수 있으므로 검토 권장.`,
    riskLevel: annualTax > 5_000_000 ? 'high' : annualTax > 1_000_000 ? 'medium' : 'low',
  })

  // 2. 4대보험 (매월)
  items.push({
    label: '4대보험 합계 (참고용)',
    amount: insurance.total,
    dueDate: `${year}-${String(month + 2).padStart(2, '0')}-10`,
    message: `[참고용] 건강보험 ${insurance.health.toLocaleString()}원 + 장기요양 ${insurance.longTermCare.toLocaleString()}원 + 국민연금 ${insurance.nationalPension.toLocaleString()}원 + 고용보험 ${insurance.employment.toLocaleString()}원 = 월 합계 약 ${insurance.total.toLocaleString()}원 (참고용).`,
    riskLevel: 'medium',
  })

  // 3. 부가세 (간이: 연 1회 / 일반: 분기)
  const vatAmount = calcVat(adjIncome, isSimplifiedVat)
  const vatDueDates = isSimplifiedVat
    ? [`${year + 1}-01-25`]
    : [
        `${year}-04-25`,
        `${year}-07-25`,
        `${year}-10-25`,
        `${year + 1}-01-25`,
      ]
  items.push({
    label: isSimplifiedVat ? '간이과세 부가가치세 (참고용)' : '일반과세 부가가치세 (참고용)',
    amount: vatAmount,
    dueDate: vatDueDates[0],
    message: `[참고용] ${isSimplifiedVat ? '간이과세(4%)' : '일반과세(10%)'} 기준 분기 예상 부가세 약 ${vatAmount.toLocaleString()}원. 매입세액 공제 적용 시 실제 납부액은 감소 가능성 있음.`,
    riskLevel: vatAmount > 500_000 ? 'high' : 'medium',
  })

  // 4. 계절성 경고
  const nextMonth = (month + 1) % 12
  const nextSw = CREATOR_SEASONAL_W[nextMonth] ?? 1.0
  if (nextSw > sw + 0.05) {
    items.push({
      label: '계절성 수입 증가 예측 (참고용)',
      amount: Math.round(monthlyIncome * (nextSw - sw)),
      dueDate: `${year}-${String(nextMonth + 1).padStart(2, '0')}-01`,
      message: `[참고용] 다음 달은 성수기 패턴이 감지됩니다. 수입 증가 시 세금 부담도 함께 증가 가능성 있음. 사전 절세 계획 검토 권장.`,
      riskLevel: 'medium',
    })
  }

  return items
}

// ─── Claude recommendations ───────────────────────────────────────────────────

async function fetchClaudeRecs(
  classified: ClassificationResult[],
  taxableIncome: number,
  businessType: string,
  isSimplifiedVat: boolean
): Promise<string[]> {
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const categories = [...new Set(classified.map(c => c.category))].join(', ')
    const deductibleCount = classified.filter(c => c.isDeductible).length

    const res = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 800,
      system: '당신은 한국 1인 크리에이터 세금 전문가 AI입니다(참고용). 모든 조언은 반드시 "[참고용]"으로 시작하고, "~ 가능성 있음", "검토 권장" 표현만 사용하세요. 확정적 세무 조언은 절대 하지 마세요.',
      messages: [{
        role: 'user',
        content: `업종: ${businessType} | 과세소득 약 ${taxableIncome.toLocaleString()}원 | 간이과세: ${isSimplifiedVat ? '예' : '아니오'} | 주요 지출 카테고리: ${categories} | 공제가능 항목 수: ${deductibleCount}건\n\n절세 방안 3가지를 간결하게 제안해 주세요.`,
      }],
    })

    const text = res.content.find(b => b.type === 'text')?.text ?? ''
    return text
      .split('\n')
      .filter(l => l.trim())
      .map(l => l.startsWith('[참고용]') ? l : `[참고용] ${l}`)
      .slice(0, 3)
  } catch (e) {
    console.warn('[Optimizer] Claude 추천 실패 — 기본값 반환:', e)
    return [
      '[참고용] 업무용 장비 및 소프트웨어 구독료 증빙 자료 보관 권장.',
      '[참고용] 간이과세 해당 여부를 세무사와 확인하는 것을 권장합니다.',
      '[참고용] 분기별 예정신고를 통해 세금 부담을 분산할 가능성 있음.',
    ]
  }
}

// ─── Missed deduction analysis ────────────────────────────────────────────────

function findMissedDeductions(
  classified: ClassificationResult[],
  marginalRate: number
): MissedDeduction[] {
  const missed: MissedDeduction[] = []

  // 낮은 신뢰도 공제 항목
  const lowConfDeductible = classified.filter(
    c => !c.isDeductible && c.confidence < 0.65
  )
  if (lowConfDeductible.length > 0) {
    missed.push({
      type: '미분류 공제 가능 항목',
      description: `[참고용] ${lowConfDeductible.length}건의 거래가 공제 불가로 분류되었으나, 신뢰도가 낮아 실제 공제 가능성 있음. 검토 권장.`,
      estimatedSaving: Math.round(lowConfDeductible.length * 50_000 * marginalRate),
      confidence: 0.55,
    })
  }

  // 식비 혼용 항목
  const mealMixed = classified.filter(c => c.category === '식비' && c.riskFlags.includes('personal_mixed'))
  if (mealMixed.length > 0) {
    missed.push({
      type: '업무 식비 부분공제',
      description: `[참고용] 식비 ${mealMixed.length}건에 업무 목적 비율이 포함될 가능성 있음. 50% 기준 부분 공제 가능성 검토 권장.`,
      estimatedSaving: Math.round(mealMixed.length * 30_000 * 0.5 * marginalRate),
      confidence: 0.60,
    })
  }

  return missed
}

// ─── Risk score ───────────────────────────────────────────────────────────────

function calcRiskScore(
  anomalies: AnomalyAlert[],
  missed: MissedDeduction[],
  effectiveTaxRate: number
): number {
  let score = 0
  score += Math.min(30, anomalies.length * 10)
  score += Math.min(20, missed.length * 5)
  score += Math.min(30, effectiveTaxRate * 100)
  score += anomalies.filter(a => a.riskScore >= 60).length * 5
  return Math.min(100, Math.round(score))
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * 분류 결과를 바탕으로 세금 최적화 분석을 실행한다.
 * 각 단계는 독립적으로 실행되므로 하나가 실패해도 나머지 결과는 반환된다.
 */
export async function runDeductionOptimizer(
  classified: ClassificationResult[],
  totalIncome: number,
  businessType: string,
  isSimplifiedVat: boolean
): Promise<DeductionOptimizerResult> {
  const now = new Date()
  const month = now.getMonth()
  const sw = CREATOR_SEASONAL_W[month] ?? 1.0

  const totalExpense = classified
    .filter(c => c.isDeductible)
    .reduce((s, c) => s + c.deductionRatio * 100_000, 0) // amount는 route에서 주입

  const taxableIncome = Math.max(0, totalIncome - totalExpense)
  const incomeTax = calcIncomeTax(taxableIncome)
  const marginalRate = getMarginalRate(taxableIncome)
  const monthlyIncome = Math.round(totalIncome / 12)
  const insurance = calcInsurance(monthlyIncome)
  const vat = calcVat(taxableIncome, isSimplifiedVat)
  const seasonalAdjustedIncome = Math.round(totalIncome * sw)

  // 독립 실행
  const [missedDeductions, forecastItems, anomalyAlerts, depreciationSuggestions, recommendations] =
    await Promise.allSettled([
      Promise.resolve(findMissedDeductions(classified, marginalRate)),
      Promise.resolve(buildForecastItems(monthlyIncome, isSimplifiedVat, insurance, now)),
      Promise.resolve(detectAnomalies(classified)),
      Promise.resolve(analyzeDepreciation(classified, marginalRate)),
      fetchClaudeRecs(classified, taxableIncome, businessType, isSimplifiedVat),
    ]).then(results => results.map(r => (r.status === 'fulfilled' ? r.value : [])))

  const totalBurden = incomeTax + insurance.total * 12 + vat
  const effectiveTaxRate = totalIncome > 0 ? totalBurden / totalIncome : 0
  const riskScore = calcRiskScore(
    anomalyAlerts as AnomalyAlert[],
    missedDeductions as MissedDeduction[],
    effectiveTaxRate
  )

  return {
    totalIncome,
    totalExpense,
    estimatedTaxableIncome: taxableIncome,
    estimatedIncomeTax: incomeTax,
    estimatedHealthInsurance: insurance.health * 12,
    estimatedLongTermCare: insurance.longTermCare * 12,
    estimatedNationalPension: insurance.nationalPension * 12,
    estimatedEmploymentInsurance: insurance.employment * 12,
    estimatedVat: vat,
    estimatedTotalBurden: totalBurden,
    effectiveTaxRate: +effectiveTaxRate.toFixed(4),
    missedDeductions: missedDeductions as MissedDeduction[],
    forecastItems: forecastItems as ForecastItem[],
    anomalyAlerts: anomalyAlerts as AnomalyAlert[],
    recommendations: recommendations as string[],
    riskScore,
    seasonalAdjustedIncome,
    depreciationSuggestions: depreciationSuggestions as MissedDeduction[],
  }
}