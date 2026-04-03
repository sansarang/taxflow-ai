import Anthropic from '@anthropic-ai/sdk'
import {
  SYSTEM_PROMPT_BASE,
  CREATOR_DEDUCTIONS_CONTEXT,
  DISCLAIMER,
  buildOptimizationUserPrompt,
} from './prompts'
import type { UserProfile } from '@/types/supabase'

// ─── Public types ─────────────────────────────────────────────────────────────

export interface ClassifiedTransaction {
  id: string
  transactionDate: string
  description: string
  amount: number
  taxCategory: string | null
  categoryLabel: string | null
  vatDeductible: boolean | null
  confidence: number | null
  riskFlag: string[] | null
  receiptRequired: boolean
  manuallyReviewed: boolean
  userCategory: string | null
}

export interface TaxLawData {
  entertainmentAnnualLimit: number         // 접대비 연한도 (default 3,600,000)
  entertainmentPerReceiptLimit: number     // 접대비 1회 한도 (30,000)
  vehicleBusinessUseRatio: number          // 업무용 차량 비율 (0.5)
  yellowUmbrellaMaxDeduction: number       // 노란우산공제 한도 (5,000,000)
}

export interface Recommendation {
  title: string
  description: string
  actionItem: string
  savingsImpact: number
  deadline?: string
  difficulty: 'easy' | 'medium' | 'hard'
  category: string
}

export interface DeductionOptimizerResult {
  riskScore: number                        // 0~100
  totalDeductibleAmount: number
  missedDeductionEstimate: number
  recommendations: Recommendation[]
  creatorSpecificAlerts: string[]
  disclaimer: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

// Category codes that are deductible expenses (not income, not personal)
const DEDUCTIBLE_CATEGORIES = new Set([
  '201','202','203',
  '301','302','303','304','305','306','307','308','309','310','311',
])

// Categories where receipts are mandatory
const RECEIPT_MANDATORY_CATEGORIES = new Set(['304', '308', '309', '310', '311'])

// Known creator-relevant keywords that suggest missed deductions
const CREATOR_DEDUCTION_KEYWORDS = [
  { pattern: /카메라|렌즈|조명|마이크|삼각대|짐벌|드론/i, category: '장비', code: '308' },
  { pattern: /어도비|adobe|파이널컷|다빈치|캡컷|canva|노션/i, category: '소프트웨어', code: '309' },
  { pattern: /스튜디오|배경지|소품/i, category: '스튜디오', code: '310' },
  { pattern: /유튜브|인스타|네이버 광고|카카오 광고/i, category: '광고비', code: '305' },
  { pattern: /편집자|디자이너|작가|외주/i, category: '외주비', code: '311' },
]

const CLAUDE_MODEL = 'claude-sonnet-4-20250514'

const OPTIMIZATION_SYSTEM = [SYSTEM_PROMPT_BASE, '', CREATOR_DEDUCTIONS_CONTEXT].join('\n')

// ─── Risk score weights ───────────────────────────────────────────────────────

const WEIGHTS = {
  missingReceipt: 1.5,       // each transaction missing receipt
  unclassified: 2.0,         // each unclassified transaction
  highAmountUnreviewed: 3.0, // transactions > 500,000 not manually reviewed
  lowConfidence: 1.0,        // transactions with confidence < 0.7
  entertainmentOverLimit: 10, // flat penalty if entertainment exceeded
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function runDeductionOptimizer(
  transactions: ClassifiedTransaction[],
  userProfile: Pick<UserProfile, 'business_type' | 'is_simplified_tax' | 'annual_revenue_tier'>,
  taxLawData: TaxLawData
): Promise<DeductionOptimizerResult> {
  // ── Step 1: aggregate totals ────────────────────────────────────────────────
  const { totalDeductible, byCategory } = aggregateTotals(transactions)

  // ── Step 2: check legal caps ────────────────────────────────────────────────
  const entertainmentTotal = byCategory['304'] ?? 0
  const entertainmentOverLimit = entertainmentTotal > taxLawData.entertainmentAnnualLimit
  const vehicleTotal = byCategory['303'] ?? 0
  const vehicleDeductible = vehicleTotal * taxLawData.vehicleBusinessUseRatio

  // ── Step 3: identify missed deductions ─────────────────────────────────────
  const potentialMissedDeductions = findMissedDeductions(transactions)

  // ── Step 4: risk score ──────────────────────────────────────────────────────
  const riskScore = computeRiskScore(
    transactions,
    entertainmentOverLimit,
    WEIGHTS
  )

  // ── Step 5: estimate missed savings ────────────────────────────────────────
  const missedDeductionEstimate = estimateMissedSavings(
    potentialMissedDeductions,
    userProfile.annual_revenue_tier
  )

  // ── Step 6: call Claude for Korean recommendations ─────────────────────────
  const expenseByCategory: Record<string, number> = {}
  for (const [cat, amount] of Object.entries(byCategory)) {
    expenseByCategory[cat] = amount
  }

  const optimizationSummary = {
    businessType: userProfile.business_type,
    isSimplifiedTax: userProfile.is_simplified_tax,
    totalIncome: byCategory['income'] ?? 0,
    totalExpenseByCategory: expenseByCategory,
    missingReceiptCount: transactions.filter((t) => t.receiptRequired && !t.manuallyReviewed).length,
    unclassifiedCount: transactions.filter((t) => !t.taxCategory).length,
    highAmountUnreviewed: transactions.filter(
      (t) => Math.abs(t.amount) > 500_000 && !t.manuallyReviewed
    ).length,
    potentialMissedDeductions: potentialMissedDeductions.map((p) => p.category),
    entertainmentOverLimit,
    vehicleDeductible,
    vehicleTotal,
  }

  const recommendations = await fetchClaudeRecommendations(optimizationSummary)

  const creatorAlerts = buildCreatorAlerts(
    entertainmentTotal,
    taxLawData.entertainmentAnnualLimit,
    vehicleTotal,
    vehicleDeductible,
    potentialMissedDeductions
  )

  return {
    riskScore,
    totalDeductibleAmount: totalDeductible,
    missedDeductionEstimate,
    recommendations,
    creatorSpecificAlerts: creatorAlerts,
    disclaimer: DISCLAIMER,
  }
}

// ─── Risk score computation ───────────────────────────────────────────────────

function computeRiskScore(
  transactions: ClassifiedTransaction[],
  entertainmentOverLimit: boolean,
  weights: typeof WEIGHTS
): number {
  let raw = 0

  for (const tx of transactions) {
    if (tx.receiptRequired && !tx.manuallyReviewed) raw += weights.missingReceipt
    if (!tx.taxCategory) raw += weights.unclassified
    if (Math.abs(tx.amount) > 500_000 && !tx.manuallyReviewed) raw += weights.highAmountUnreviewed
    if (tx.confidence !== null && tx.confidence < 0.7) raw += weights.lowConfidence
  }

  if (entertainmentOverLimit) raw += weights.entertainmentOverLimit

  // Normalise to 0~100 using transaction count as denominator baseline
  const maxExpected = transactions.length * (weights.missingReceipt + weights.unclassified + weights.lowConfidence)
  const normalised = maxExpected > 0 ? (raw / maxExpected) * 100 : 0

  return Math.min(100, Math.round(normalised))
}

// ─── Aggregate totals ────────────────────────────────────────────────────────

function aggregateTotals(transactions: ClassifiedTransaction[]) {
  const byCategory: Record<string, number> = {}
  let totalDeductible = 0

  for (const tx of transactions) {
    const cat = tx.taxCategory ?? 'unknown'
    const abs = Math.abs(tx.amount)
    byCategory[cat] = (byCategory[cat] ?? 0) + abs

    if (DEDUCTIBLE_CATEGORIES.has(cat)) {
      totalDeductible += abs
    }

    if (tx.amount > 0) {
      byCategory['income'] = (byCategory['income'] ?? 0) + tx.amount
    }
  }

  return { totalDeductible, byCategory }
}

// ─── Missed deduction detection ───────────────────────────────────────────────

function findMissedDeductions(
  transactions: ClassifiedTransaction[]
): Array<{ category: string; code: string; description: string }> {
  const missed: Array<{ category: string; code: string; description: string }> = []

  for (const tx of transactions) {
    if (tx.manuallyReviewed) continue
    // Already classified in the correct category — skip
    const currentCat = tx.taxCategory
    for (const { pattern, category, code } of CREATOR_DEDUCTION_KEYWORDS) {
      if (currentCat === code) continue
      if (pattern.test(tx.description)) {
        missed.push({ category, code, description: tx.description })
      }
    }
  }

  // Deduplicate by category
  const seen = new Set<string>()
  return missed.filter(({ category }) => {
    if (seen.has(category)) return false
    seen.add(category)
    return true
  })
}

// ─── Missed savings estimate (rough calculation) ─────────────────────────────

const MARGINAL_TAX_BY_TIER: Record<string, number> = {
  under_50m: 0.165,   // 6%~15% + 지방세
  '50m_150m': 0.264,  // 24% + 지방세
  over_150m: 0.385,   // 35% + 지방세
}

function estimateMissedSavings(
  missed: Array<{ category: string; code: string }>,
  tier: string
): number {
  const marginalRate = MARGINAL_TAX_BY_TIER[tier] ?? 0.165
  // Rough estimate: each missed category type costs avg 200,000 in missed deductions
  const estimatedMissedExpense = missed.length * 200_000
  return Math.round(estimatedMissedExpense * marginalRate)
}

// ─── Creator-specific alert strings ──────────────────────────────────────────

function buildCreatorAlerts(
  entertainmentTotal: number,
  entertainmentLimit: number,
  vehicleTotal: number,
  vehicleDeductible: number,
  missed: Array<{ category: string }>
): string[] {
  const alerts: string[] = []

  if (entertainmentTotal > entertainmentLimit) {
    alerts.push(
      `접대비가 연간 한도(${(entertainmentLimit / 10000).toFixed(0)}만원)를 초과했습니다. 초과분(${((entertainmentTotal - entertainmentLimit) / 10000).toFixed(0)}만원)은 경비로 인정되지 않습니다.`
    )
  }

  if (vehicleTotal > 0) {
    alerts.push(
      `업무용 차량 비용 ${(vehicleTotal / 10000).toFixed(0)}만원 중 50%(${(vehicleDeductible / 10000).toFixed(0)}만원)만 공제 가능합니다. 운행일지 작성을 권장합니다.`
    )
  }

  if (missed.some((m) => m.category === '외주비')) {
    alerts.push('외주비 지급 시 3.3% 원천징수 후 지급해야 합니다. 미이행 시 가산세가 부과될 수 있습니다.')
  }

  if (missed.some((m) => m.category === '장비')) {
    alerts.push('장비 구입비는 업무 목적임을 입증하는 문서(계약서, 사용 용도 설명)를 보관하세요.')
  }

  return alerts
}

// ─── Claude recommendations ───────────────────────────────────────────────────

async function fetchClaudeRecommendations(
  summary: Parameters<typeof buildOptimizationUserPrompt>[0]
): Promise<Recommendation[]> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  let raw: string
  try {
    const message = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 3000,
      system: OPTIMIZATION_SYSTEM,
      messages: [{ role: 'user', content: buildOptimizationUserPrompt(summary) }],
    })

    const content = message.content[0]
    if (content.type !== 'text') return []
    raw = content.text
  } catch (err) {
    console.error('[optimizer] Claude API error:', err)
    return []
  }

  try {
    const clean = raw.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim()
    const parsed = JSON.parse(clean) as { recommendations?: unknown[] }
    const recs = parsed.recommendations

    if (!Array.isArray(recs)) return []

    return recs
      .slice(0, 5)
      .map((r): Recommendation => {
        const rec = r as Record<string, unknown>
        return {
          title: String(rec.title ?? '').slice(0, 30),
          description: String(rec.description ?? '').slice(0, 150),
          actionItem: String(rec.actionItem ?? ''),
          savingsImpact: Math.max(0, Number(rec.savingsImpact ?? 0)),
          deadline: typeof rec.deadline === 'string' ? rec.deadline : undefined,
          difficulty: (['easy', 'medium', 'hard'] as const).includes(rec.difficulty as 'easy' | 'medium' | 'hard')
            ? (rec.difficulty as 'easy' | 'medium' | 'hard')
            : 'medium',
          category: String(rec.category ?? '기타'),
        }
      })
      .sort((a, b) => b.savingsImpact - a.savingsImpact)
  } catch (err) {
    console.error('[optimizer] JSON parse error:', err)
    return []
  }
}
