/**
 * Korean Tax Calculator
 * ─────────────────────────────────────────────────────────────────────────────
 * All monetary values are in KRW (원).
 * Uses 2026 tax brackets from src/lib/tax/constants.ts as defaults; callers
 * may pass live brackets fetched from the `tax_law_table` DB table.
 */

import {
  TAX_BRACKETS_2024,
  LOCAL_TAX_RATE,
  STANDARD_EXPENSE_RATES,
  BASIC_DEDUCTION,
  VAT_RATE,
} from './constants'
import type { ClassifiedTransaction } from '@/lib/ai/optimizer'
import type { TaxBracket } from '@/types/supabase'

// ─── Public return types ──────────────────────────────────────────────────────

export interface VATCalculation {
  taxableSales: number          // 101 과세매출 합계
  taxFreeIncome: number         // 102 면세수입 합계
  zeroRatedSales: number        // 103 영세율매출 합계
  outputVAT: number             // 매출세액 (taxableSales × rate)
  deductibleInputVAT: number    // 매입세액 공제 (201,202,203 × 0.10)
  nonDeductibleInputVAT: number // 불공제매입 합계 (401)
  vatPayable: number            // 납부세액 = outputVAT - deductibleInputVAT
  isSimplified: boolean
  vatRate: number               // 0.10 or 0.04
}

export interface IncomeTaxCalculation {
  grossIncome: number
  totalExpenses: number
  standardDeduction: number     // 소득공제 기본공제
  taxableIncome: number         // 과세표준
  incomeTax: number             // 산출세액
  smeReduction: number          // 중소기업특별세액감면 (20%)
  localTax: number              // 지방소득세 10%
  totalTax: number              // 최종 납부세액
  effectiveRate: number
  appliedBracket: { min: number; max: number | null; rate: number; deduction: number }
  quarterlyPrepayment: number   // 분기 예납 (총세액 ÷ 4)
}

export interface ReportPeriod {
  year: number
  quarter?: number
  startDate: string   // YYYY-MM-DD
  endDate: string
  label: string
}

// ─── VAT calculation ──────────────────────────────────────────────────────────

/**
 * Calculate VAT from classified transactions.
 *
 * Income codes:     101=과세, 102=면세, 103=영세율
 * Deductible input: 201=매입공제, 202=카드매입, 203=현금영수증
 * Non-deductible:   401=불공제매입
 *
 * Simplified taxpayer (간이과세자): output VAT rate = 4%, no input deduction
 */
export function calculateVAT(
  transactions: ClassifiedTransaction[],
  isSimplified: boolean
): VATCalculation {
  let taxableSales = 0
  let taxFreeIncome = 0
  let zeroRatedSales = 0
  let inputVATBase = 0    // sum of 201,202,203 purchase amounts (absolute)
  let nonDeductible = 0   // sum of 401

  for (const tx of transactions) {
    const cat = tx.taxCategory ?? ''
    const abs = Math.abs(tx.amount)

    switch (cat) {
      case '101': taxableSales    += abs; break
      case '102': taxFreeIncome   += abs; break
      case '103': zeroRatedSales  += abs; break
      case '201':
      case '202':
      case '203': inputVATBase    += abs; break
      case '401': nonDeductible   += abs; break
    }
  }

  const vatRate = isSimplified ? 0.04 : VAT_RATE
  const outputVAT = Math.round(taxableSales * vatRate)
  // Simplified taxpayers cannot deduct input VAT
  const deductibleInputVAT = isSimplified ? 0 : Math.round(inputVATBase * VAT_RATE)
  const vatPayable = Math.max(0, outputVAT - deductibleInputVAT)

  return {
    taxableSales,
    taxFreeIncome,
    zeroRatedSales,
    outputVAT,
    deductibleInputVAT,
    nonDeductibleInputVAT: nonDeductible,
    vatPayable,
    isSimplified,
    vatRate,
  }
}

// ─── Income tax calculation ───────────────────────────────────────────────────

/**
 * Calculate comprehensive income tax using progressive brackets.
 *
 * Deduction flow:
 *   grossIncome
 *   − totalExpenses            (필요경비)
 *   − standardDeduction        (소득공제 기본: 1,500,000)
 *   = taxableIncome            (과세표준)
 *
 * Progressive bracket tax → SME reduction → local tax.
 *
 * 중소기업특별세액감면: 20 % reduction for creators/freelancers with income < 300M
 */
export function calculateIncomeTax(
  annualIncome: number,
  totalExpenses: number,
  taxBrackets: TaxBracket[] = TAX_BRACKETS_2024 as unknown as TaxBracket[]
): IncomeTaxCalculation {
  const standardDeduction = BASIC_DEDUCTION
  const taxableIncome = Math.max(0, annualIncome - totalExpenses - standardDeduction)

  // Find applicable bracket
  const defaultBracket = { min: 0, max: null as number | null, rate: 0.06, deduction: 0 }
  const bracket = [...taxBrackets]
    .sort((a, b) => b.min - a.min)
    .find((b) => taxableIncome >= b.min) ?? defaultBracket

  const rawTax = Math.max(0, taxableIncome * bracket.rate - bracket.deduction)

  // 중소기업특별세액감면 20 % — applicable when annual income < 300,000,000
  const smeReduction = annualIncome < 300_000_000 ? Math.round(rawTax * 0.20) : 0
  const incomeTax = Math.round(rawTax - smeReduction)

  const localTax = Math.round(incomeTax * LOCAL_TAX_RATE)
  const totalTax = incomeTax + localTax
  const effectiveRate = annualIncome > 0 ? totalTax / annualIncome : 0
  const quarterlyPrepayment = Math.round(totalTax / 4)

  return {
    grossIncome: annualIncome,
    totalExpenses,
    standardDeduction,
    taxableIncome,
    incomeTax,
    smeReduction,
    localTax,
    totalTax,
    effectiveRate,
    appliedBracket: {
      min: bracket.min,
      max: bracket.max,
      rate: bracket.rate,
      deduction: bracket.deduction,
    },
    quarterlyPrepayment,
  }
}

// ─── Risk score ───────────────────────────────────────────────────────────────

/**
 * Calculate an audit/review risk score 0–100.
 *
 * Weights (sum = 100 when all transactions are "bad"):
 *   - Missing receipts on expense transactions   × 40
 *   - Unclassified / fallback category (402)     × 30
 *   - Unreviewed high-amount transactions (≥100K) × 30
 *
 * The score is the sum of (count / total) × weight, clamped to 0–100.
 */
export function calculateRiskScore(transactions: ClassifiedTransaction[]): number {
  const total = transactions.length
  if (total === 0) return 0

  const expenses = transactions.filter((t) => t.amount < 0)
  const expenseCount = Math.max(expenses.length, 1)

  const missingReceipt = expenses.filter(
    (t) => t.receiptRequired && !t.manuallyReviewed
  ).length

  const unclassified = transactions.filter(
    (t) => !t.taxCategory || t.taxCategory === '402'
  ).length

  const HIGH_AMOUNT = 100_000
  const unreviewedHigh = transactions.filter(
    (t) => t.amount < -HIGH_AMOUNT && !t.manuallyReviewed
  ).length

  const score =
    (missingReceipt / expenseCount) * 40 +
    (unclassified / total) * 30 +
    (unreviewedHigh / total) * 30

  return Math.min(100, Math.round(score))
}

// ─── Backward-compatible helpers (used by reporter.ts) ───────────────────────

/**
 * Compute total tax (income tax + local tax) from gross income and expenses.
 * Uses progressive brackets from constants and the standard deduction.
 */
export function calculateTax(grossIncome: number, expenses: number): number {
  const result = calculateIncomeTax(grossIncome, expenses)
  return result.totalTax
}

/**
 * Simple VAT payable: (revenue − expenses) × 10 %, clamped to 0.
 * @deprecated Use calculateVAT() with ClassifiedTransaction[] for accurate results.
 */
export function calculateVat(revenue: number, expenses: number): number {
  return Math.max(0, Math.round((revenue - expenses) * VAT_RATE))
}

export function calculateEffectiveRate(grossIncome: number, tax: number): number {
  if (grossIncome === 0) return 0
  return tax / grossIncome
}

export function estimateQuarterlyPrepayment(annualTax: number): number {
  return Math.round(annualTax / 4)
}

/** Standard expense rate for a given business type (creator, freelancer, etc.) */
export function getStandardExpenseRate(businessType: string): number {
  return STANDARD_EXPENSE_RATES[businessType] ?? 0.30
}
