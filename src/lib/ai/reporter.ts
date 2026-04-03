import Anthropic from '@anthropic-ai/sdk'
import Papa from 'papaparse'
import { createAdminClient } from '@/lib/supabase/server'
import { calculateTax, calculateIncomeTax, calculateEffectiveRate, calculateVat } from '@/lib/tax/calculator'
import { generateHometaxXml } from '@/lib/export/hometax-xml'
import { SYSTEM_PROMPT_BASE, DISCLAIMER, buildReportSummaryPrompt } from './prompts'
import type { ReportType } from '@/types/supabase'

// ─── Public types ─────────────────────────────────────────────────────────────

export interface TaxReportData {
  reportType: ReportType
  periodYear: number
  periodQuarter?: number
  period: string
  totalIncome: number
  totalExpense: number
  vatPayable: number
  estimatedTax: number
  effectiveRate: number
  riskScore: number
  deductions: Record<string, number>      // categoryCode → amount
  topCategories: Array<{ label: string; amount: number }>
  summary: {
    headline: string
    keyPoints: string[]
    actionRequired: string
  }
  disclaimer: string
}

export interface ReportFileUrls {
  csv?: string
  xml?: string
}

// ─── Period helpers ───────────────────────────────────────────────────────────

function getPeriodRange(
  reportType: ReportType,
  year: number,
  quarter?: number
): { start: string; end: string; label: string } {
  if (reportType === 'income_tax') {
    return { start: `${year}-01-01`, end: `${year}-12-31`, label: `${year}년` }
  }
  if (reportType === 'monthly' && quarter) {
    const month = String(quarter).padStart(2, '0')
    const lastDay = new Date(year, quarter, 0).getDate()
    return {
      start: `${year}-${month}-01`,
      end: `${year}-${month}-${lastDay}`,
      label: `${year}년 ${quarter}월`,
    }
  }
  // VAT quarters: q1=1~3월, q2=4~6월, q3=7~9월, q4=10~12월
  const qMap: Record<string, { startM: number; endM: number }> = {
    vat_q1: { startM: 1, endM: 3 },
    vat_q2: { startM: 4, endM: 6 },
    vat_q3: { startM: 7, endM: 9 },
    vat_q4: { startM: 10, endM: 12 },
  }
  const q = qMap[reportType]
  if (!q) throw new Error(`Unknown report type: ${reportType}`)
  const endDay = new Date(year, q.endM, 0).getDate()
  return {
    start: `${year}-${String(q.startM).padStart(2, '0')}-01`,
    end: `${year}-${String(q.endM).padStart(2, '0')}-${endDay}`,
    label: `${year}년 ${q.startM}~${q.endM}월`,
  }
}

// ─── Category labels ──────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  '101': '매출(과세)', '102': '매출(면세)', '103': '매출(영세율)',
  '201': '매입공제', '202': '카드매입', '203': '현금영수증매입',
  '301': '인건비', '302': '임차료', '303': '차량유지비', '304': '접대비',
  '305': '광고선전비', '306': '통신비', '307': '소모품비',
  '308': '장비구입비', '309': '소프트웨어구독',
  '310': '콘텐츠제작비', '311': '외주편집비',
  '401': '불공제매입', '402': '개인지출',
}

const CLAUDE_MODEL = 'claude-sonnet-4-20250514'
const STORAGE_BUCKET = 'tax-reports'

// ─── Main export ──────────────────────────────────────────────────────────────

export async function generateTaxReport(
  userId: string,
  reportType: ReportType,
  year: number,
  quarter?: number
): Promise<{ reportData: TaxReportData; fileUrls: ReportFileUrls }> {
  const admin = createAdminClient()
  const db = admin as any // eslint-disable-line @typescript-eslint/no-explicit-any
  const period = getPeriodRange(reportType, year, quarter)

  // ── 1. Fetch classified transactions ────────────────────────────────────────
  const { data: rows, error: txError } = await db
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .gte('transaction_date', period.start)
    .lte('transaction_date', period.end)
    .order('transaction_date', { ascending: true })

  if (txError) throw new Error(`거래 내역 조회 실패: ${txError.message}`)

  const transactions: Array<{
    id: string
    transactionDate: string
    description: string
    amount: number
    taxCategory: string | null
    categoryLabel: string | null
  }> = (rows ?? []).map((r: Record<string, unknown>) => ({
    id: String(r.id),
    transactionDate: String(r.transaction_date),
    description: String(r.description),
    amount: Number(r.amount),
    taxCategory: r.tax_category ? String(r.tax_category) : null,
    categoryLabel: r.category_label ? String(r.category_label) : null,
  }))

  // ── 2. Calculate tax figures ─────────────────────────────────────────────────
  const INCOME_CODES = new Set(['101', '102', '103'])
  const DEDUCTIBLE_CODES = new Set([
    '201','202','203','301','302','303','305','306','307','308','309','310','311',
  ])
  // 접대비 연한도: 3,600,000
  const ENTERTAINMENT_LIMIT = 3_600_000

  let totalIncome = 0
  let totalExpense = 0
  const byCategory: Record<string, number> = {}

  for (const tx of transactions) {
    const cat = tx.taxCategory ?? 'unknown'
    const abs = Math.abs(tx.amount)
    byCategory[cat] = (byCategory[cat] ?? 0) + abs

    if (tx.amount > 0 && INCOME_CODES.has(cat)) totalIncome += tx.amount
    if (tx.amount < 0 && DEDUCTIBLE_CODES.has(cat)) totalExpense += abs
  }

  // Cap entertainment
  const entertainment = Math.min(byCategory['304'] ?? 0, ENTERTAINMENT_LIMIT)
  const cappedExpense = totalExpense - (byCategory['304'] ?? 0) + entertainment

  const vatPayable = reportType.startsWith('vat')
    ? calculateVat(totalIncome, cappedExpense)
    : 0

  const estimatedTax = reportType === 'income_tax' || reportType === 'monthly'
    ? calculateTax(totalIncome, cappedExpense)
    : 0

  const effectiveRate = calculateEffectiveRate(totalIncome, estimatedTax || vatPayable)

  // Top categories (expense only, sorted by amount desc)
  const topCategories = Object.entries(byCategory)
    .filter(([cat]) => DEDUCTIBLE_CODES.has(cat))
    .map(([cat, amount]) => ({ label: CATEGORY_LABELS[cat] ?? cat, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)

  // Build deductions map
  const deductions: Record<string, number> = {}
  for (const [cat, amount] of Object.entries(byCategory)) {
    if (DEDUCTIBLE_CODES.has(cat)) deductions[cat] = amount
  }

  // ── 3. Calculate risk score ──────────────────────────────────────────────────
  const missingReceipts = (rows ?? []).filter(
    (r: Record<string, unknown>) => r.receipt_required && !r.manually_reviewed
  ).length
  const riskScore = Math.min(100, Math.round((missingReceipts / Math.max(transactions.length, 1)) * 100))

  // ── 4. Call Claude for natural-language summary ──────────────────────────────
  const summary = await fetchReportSummary({
    reportType,
    period: period.label,
    totalIncome,
    totalExpense: cappedExpense,
    vatPayable,
    estimatedTax,
    riskScore,
    topCategories,
  })

  // ── 5. Generate CSV ──────────────────────────────────────────────────────────
  const csvRows = transactions.map((tx) => ({
    거래일자: tx.transactionDate,
    적요: tx.description,
    금액: tx.amount,
    세금코드: tx.taxCategory ?? '',
    분류: tx.categoryLabel ?? CATEGORY_LABELS[tx.taxCategory ?? ''] ?? '미분류',
  }))
  const csvText = Papa.unparse(csvRows, { header: true })

  // ── 6. Generate XML ──────────────────────────────────────────────────────────
  const xmlText = generateHometaxXml(
    transactions.map((tx) => ({
      id: tx.id,
      date: tx.transactionDate,
      description: tx.description,
      amount: tx.amount,
      category: (tx.taxCategory ?? 'unknown') as import('@/types/transaction').TransactionCategory,
      source: undefined,
      createdAt: undefined,
      updatedAt: undefined,
    })),
    userId
  )

  // ── 7. Upload to Supabase Storage ────────────────────────────────────────────
  const filePrefix = `${userId}/${year}-${reportType}`
  const fileUrls: ReportFileUrls = {}

  const csvPath = `${filePrefix}.csv`
  const { error: csvErr } = await admin.storage
    .from(STORAGE_BUCKET)
    .upload(csvPath, Buffer.from(csvText, 'utf-8'), { contentType: 'text/csv', upsert: true })

  if (!csvErr) {
    const { data: signedCsv } = await admin.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(csvPath, 60 * 60 * 24 * 7) // 7 days
    fileUrls.csv = signedCsv?.signedUrl
  } else {
    console.warn('[reporter] CSV upload failed:', csvErr.message)
  }

  const xmlPath = `${filePrefix}.xml`
  const { error: xmlErr } = await admin.storage
    .from(STORAGE_BUCKET)
    .upload(xmlPath, Buffer.from(xmlText, 'utf-8'), { contentType: 'application/xml', upsert: true })

  if (!xmlErr) {
    const { data: signedXml } = await admin.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(xmlPath, 60 * 60 * 24 * 7)
    fileUrls.xml = signedXml?.signedUrl
  } else {
    console.warn('[reporter] XML upload failed:', xmlErr.message)
  }

  // ── 8. Persist tax_reports record ───────────────────────────────────────────
  const reportId = crypto.randomUUID()
  await db.from('tax_reports').upsert({
    id: reportId,
    user_id: userId,
    report_type: reportType,
    period_year: year,
    period_quarter: quarter ?? null,
    total_income: totalIncome,
    total_expense: cappedExpense,
    vat_payable: vatPayable,
    estimated_tax: estimatedTax,
    risk_score: riskScore,
    deductions: deductions,
    optimization_tips: summary.keyPoints,
    file_url: fileUrls.csv ?? fileUrls.xml ?? null,
    disclaimer_shown: true,
  }, { onConflict: 'id' })

  const reportData: TaxReportData = {
    reportType,
    periodYear: year,
    periodQuarter: quarter,
    period: period.label,
    totalIncome,
    totalExpense: cappedExpense,
    vatPayable,
    estimatedTax,
    effectiveRate,
    riskScore,
    deductions,
    topCategories,
    summary,
    disclaimer: DISCLAIMER,
  }

  return { reportData, fileUrls }
}

// ─── Claude summary call ──────────────────────────────────────────────────────

async function fetchReportSummary(
  data: Parameters<typeof buildReportSummaryPrompt>[0]
): Promise<TaxReportData['summary']> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const fallback = {
    headline: `${data.period} 세금 리포트`,
    keyPoints: [
      `총 수입: ${(data.totalIncome / 10000).toFixed(0)}만원`,
      `필요경비: ${(data.totalExpense / 10000).toFixed(0)}만원`,
      `예상 세금: ${((data.vatPayable || data.estimatedTax) / 10000).toFixed(0)}만원`,
    ],
    actionRequired: '세무사와 함께 최종 확인하세요.',
  }

  try {
    const message = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1000,
      system: SYSTEM_PROMPT_BASE,
      messages: [{ role: 'user', content: buildReportSummaryPrompt(data) }],
    })

    const content = message.content[0]
    if (content.type !== 'text') return fallback

    const clean = content.text
      .replace(/^```(?:json)?\n?/m, '')
      .replace(/\n?```$/m, '')
      .trim()
    const parsed = JSON.parse(clean) as Partial<TaxReportData['summary']>

    return {
      headline: String(parsed.headline ?? fallback.headline).slice(0, 80),
      keyPoints: Array.isArray(parsed.keyPoints)
        ? parsed.keyPoints.map(String).slice(0, 5)
        : fallback.keyPoints,
      actionRequired: String(parsed.actionRequired ?? fallback.actionRequired),
    }
  } catch (err) {
    console.error('[reporter] Summary fetch error:', err)
    return fallback
  }
}
