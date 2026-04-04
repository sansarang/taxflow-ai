import os

files = {}

files['src/app/api/cron/weekly-report/route.ts'] = '''\
/**
 * Cron: Weekly Optimization Report
 * Schedule: 0 0 * * 1
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { runDeductionOptimizer } from '@/lib/ai/optimizer'
import { sendWeeklyReport } from '@/lib/notifications/email'
import { sendKakaoWeeklyReport } from '@/lib/notifications/kakao'
import type { TaxReportData } from '@/lib/ai/reporter'
import { DISCLAIMER } from '@/lib/ai/prompts'

function verifyCronSecret(request: NextRequest): boolean {
  return request.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`
}

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startedAt = Date.now()
  const db = createAdminClient()
  const now = new Date()
  const periodEnd = now.toISOString().slice(0, 10)
  const periodStart = new Date(now.getTime() - 7 * 86_400_000).toISOString().slice(0, 10)

  try {
    const { data: users, error: usersErr } = await (db as any)
      .from('users_profile')
      .select(
        'id, email, full_name, business_type, is_simplified_tax, annual_revenue_tier, ' +
        'notification_email, notification_kakao, kakao_token, plan'
      )
      .in('plan', ['pro', 'business'])

    if (usersErr || !users) {
      throw new Error(`Failed to fetch users: ${usersErr?.message}`)
    }

    let processed = 0
    let failed = 0
    const errors: string[] = []

    for (const user of users) {
      try {
        const { data: rows, error: txErr } = await (db as any)
          .from('transactions')
          .select(
            'id, transaction_date, description, amount, tax_category, ' +
            'category_label, vat_deductible, confidence, risk_flag, receipt_required'
          )
          .eq('user_id', user.id)
          .gte('transaction_date', periodStart)
          .lte('transaction_date', periodEnd)
          .not('tax_category', 'is', null)

        if (txErr) throw new Error(`Tx fetch error: ${txErr.message}`)
        if (!rows || rows.length === 0) continue

        const transactions: any[] = rows.map((r: any) => ({
          id: r.id,
          transactionDate: r.transaction_date,
          description: r.description,
          amount: Number(r.amount),
          taxCategory: r.tax_category,
          categoryLabel: r.category_label,
          vatDeductible: r.vat_deductible ?? null,
          confidence: r.confidence ?? null,
          riskFlag: r.risk_flag ?? [],
          receiptRequired: r.receipt_required ?? false,
        }))

        const totalIncome = transactions
          .filter((t: any) => t.amount > 0)
          .reduce((s: number, t: any) => s + t.amount, 0)

        const optimizerResult = await runDeductionOptimizer(
          transactions as any,
          totalIncome,
          user.business_type ?? 'creator',
          Boolean(user.is_simplified_tax)
        )

        const expense = transactions
          .filter((t: any) => t.amount < 0)
          .reduce((s: number, t: any) => s + Math.abs(t.amount), 0)

        const categoryTotals = new Map<string, number>()
        for (const t of transactions) {
          if (t.amount < 0 && t.categoryLabel) {
            categoryTotals.set(
              t.categoryLabel,
              (categoryTotals.get(t.categoryLabel) ?? 0) + Math.abs(t.amount)
            )
          }
        }
        const topCategories = [...categoryTotals.entries()]
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)
          .map(([label, amount]) => ({ label, amount }))

        const reportData: TaxReportData = {
          reportType: 'monthly',
          periodYear: now.getFullYear(),
          period: `${periodStart} ~ ${periodEnd}`,
          totalIncome,
          totalExpense: expense,
          vatPayable:
            totalIncome * (user.is_simplified_tax ? 0.04 : 0.1) -
            expense * (user.is_simplified_tax ? 0 : 0.1),
          estimatedTax: Math.max(0, (totalIncome - (optimizerResult.totalExpense ?? 0)) * 0.15),
          effectiveRate: 0.15,
          riskScore: optimizerResult.riskScore,
          deductions: {},
          topCategories,
          summary: {
            headline:
              (optimizerResult.recommendations as string[])[0] ??
              'This week transactions analyzed.',
            keyPoints: (optimizerResult.recommendations as string[]).slice(0, 3),
            actionRequired: optimizerResult.anomalyAlerts?.[0]?.message ?? '',
          },
          disclaimer: DISCLAIMER,
        }

        const userName = user.full_name ?? user.email.split('@')[0]

        await Promise.allSettled([
          user.notification_email
            ? sendWeeklyReport(user.email, userName, reportData)
            : Promise.resolve(),
          user.notification_kakao && user.kakao_token
            ? sendKakaoWeeklyReport(
                user.kakao_token,
                userName,
                reportData.estimatedTax,
                reportData.riskScore
              )
            : Promise.resolve(),
        ])

        processed++
      } catch (userErr) {
        failed++
        errors.push(`User ${user.id}: ${String(userErr)}`)
        console.error('[cron/weekly-report]', String(userErr))
      }
    }

    return NextResponse.json({
      success: true,
      period: { start: periodStart, end: periodEnd },
      totalUsers: users.length,
      processed,
      failed,
      errors: errors.slice(0, 5),
      elapsed: Date.now() - startedAt,
    })
  } catch (error) {
    console.error('[cron/weekly-report] Fatal:', error)
    return NextResponse.json({ error: 'Weekly report failed', detail: String(error) }, { status: 500 })
  }
}
'''

files['src/app/api/export/route.ts'] = '''\
/**
 * POST /api/export
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server'
import { calculateVAT, calculateIncomeTax, calculateRiskScore } from '@/lib/tax/calculator'
import { generateVATDeclarationCSV, generateExpenseCSV } from '@/lib/export/hometax-csv'
import { generateVATXML } from '@/lib/export/hometax-xml'
import { generateOptimizationPDF } from '@/lib/export/pdf-report'
import { runDeductionOptimizer } from '@/lib/ai/optimizer'
import type { ReportType } from '@/types/supabase'
import type { ReportPeriod } from '@/lib/tax/calculator'

function buildPeriod(reportType: ReportType, year: number, quarter?: number): ReportPeriod {
  if (reportType === 'income_tax') {
    return {
      year, quarter: undefined,
      startDate: `${year}-01-01`, endDate: `${year}-12-31`,
      label: `${year} Income Tax`,
    }
  }
  if (reportType === 'monthly' && quarter) {
    const month = String(quarter).padStart(2, '0')
    const lastDay = new Date(year, quarter, 0).getDate()
    return {
      year, quarter,
      startDate: `${year}-${month}-01`,
      endDate: `${year}-${month}-${lastDay}`,
      label: `${year}-${month}`,
    }
  }
  const qRanges: Record<string, { s: number; e: number }> = {
    vat_q1: { s: 1, e: 3 }, vat_q2: { s: 4, e: 6 },
    vat_q3: { s: 7, e: 9 }, vat_q4: { s: 10, e: 12 },
  }
  const range = qRanges[reportType] ?? { s: 1, e: 12 }
  const q = Math.ceil(range.s / 3)
  const lastDay = new Date(year, range.e, 0).getDate()
  return {
    year, quarter: q,
    startDate: `${year}-${String(range.s).padStart(2, '0')}-01`,
    endDate: `${year}-${String(range.e).padStart(2, '0')}-${lastDay}`,
    label: `${year} ${reportType.toUpperCase()}`,
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'Login required' }, { status: 401 })
  }

  let body: { reportType?: string; year?: number; quarter?: number; format?: string }
  try { body = await request.json() }
  catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }) }

  const { reportType, year, quarter, format } = body
  if (!reportType || !year || !format) {
    return NextResponse.json({ error: 'reportType, year, format required' }, { status: 400 })
  }

  const validTypes = ['vat_q1','vat_q2','vat_q3','vat_q4','income_tax','monthly'] as const
  if (!validTypes.includes(reportType as ReportType)) {
    return NextResponse.json({ error: 'Invalid reportType' }, { status: 400 })
  }
  if (!['csv','xml','pdf'].includes(format)) {
    return NextResponse.json({ error: 'format must be csv, xml, or pdf' }, { status: 400 })
  }

  const db = createAdminClient()
  const period = buildPeriod(reportType as ReportType, year, quarter)

  try {
    const { data: profile, error: profileErr } = await (db as any)
      .from('users_profile').select('*').eq('id', user.id).single()
    if (profileErr || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const { data: rows, error: txErr } = await (db as any)
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .gte('transaction_date', period.startDate)
      .lte('transaction_date', period.endDate)
      .order('transaction_date', { ascending: true })

    if (txErr) {
      return NextResponse.json({ error: `Transaction fetch failed: ${txErr.message}` }, { status: 500 })
    }

    const transactions: any[] = (rows ?? []).map((r: any) => ({
      id: String(r.id),
      transactionDate: String(r.transaction_date),
      description: String(r.description),
      amount: Number(r.amount),
      taxCategory: r.tax_category ?? null,
      categoryLabel: r.category_label ?? null,
      vatDeductible: r.vat_deductible ?? null,
      confidence: r.confidence ?? null,
      riskFlag: r.risk_flag ?? [],
      receiptRequired: r.receipt_required ?? false,
      manuallyReviewed: r.manually_reviewed ?? false,
      userCategory: r.user_category ?? null,
    }))

    const isVAT = reportType.startsWith('vat')
    const vatData = calculateVAT(transactions, profile.is_simplified_tax ?? false)

    const totalIncome = transactions
      .filter((t: any) => t.amount > 0 && ['101','102','103'].includes(t.taxCategory ?? ''))
      .reduce((s: number, t: any) => s + t.amount, 0)
    const totalExpense = transactions
      .filter((t: any) => t.amount < 0)
      .reduce((s: number, t: any) => s + Math.abs(t.amount), 0)

    const incomeTaxCalc = calculateIncomeTax(totalIncome, totalExpense)
    const riskScore = calculateRiskScore(transactions)

    let fileContent: Buffer
    let contentType: string
    let fileExt: string

    if (format === 'csv') {
      const csvText = isVAT
        ? generateVATDeclarationCSV(vatData, period)
        : generateExpenseCSV(transactions)
      fileContent = Buffer.from(csvText, 'utf-8')
      contentType = 'text/csv; charset=utf-8'
      fileExt = 'csv'

    } else if (format === 'xml') {
      const xmlText = generateVATXML(vatData, {
        business_number: profile.business_number ?? '',
        business_name: profile.business_name ?? '',
        business_type: profile.business_type ?? '',
        full_name: profile.full_name ?? '',
      }, period)
      fileContent = Buffer.from(xmlText, 'utf-8')
      contentType = 'application/xml; charset=utf-8'
      fileExt = 'xml'

    } else {
      const optimizerResult = await runDeductionOptimizer(
        transactions as any,
        totalIncome,
        profile.business_type ?? 'creator',
        Boolean(profile.is_simplified_tax)
      )

      const catMap = new Map<string, number>()
      for (const tx of transactions) {
        if (tx.amount < 0 && tx.categoryLabel) {
          catMap.set(tx.categoryLabel, (catMap.get(tx.categoryLabel) ?? 0) + Math.abs(tx.amount))
        }
      }
      const topCategories = [...catMap.entries()]
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([label, amount]) => ({ label, amount }))

      const deductions: Record<string, number> = {}
      for (const tx of transactions) {
        const cat = tx.taxCategory ?? ''
        if (tx.amount < 0 && cat && !['401','402'].includes(cat)) {
          deductions[cat] = (deductions[cat] ?? 0) + Math.abs(tx.amount)
        }
      }

      const doc = generateOptimizationPDF({
        reportData: {
          reportType: reportType as ReportType,
          periodYear: year,
          periodQuarter: quarter,
          period: period.label,
          totalIncome,
          totalExpense,
          vatPayable: vatData.vatPayable,
          estimatedTax: incomeTaxCalc.totalTax,
          effectiveRate: incomeTaxCalc.effectiveRate,
          riskScore,
          deductions,
          topCategories,
          summary: {
            headline: period.label + ' Tax Report',
            keyPoints: (optimizerResult.recommendations as string[]).slice(0, 3),
            actionRequired: optimizerResult.anomalyAlerts?.[0]?.message ?? '',
          },
          disclaimer: 'AI-generated reference only. Not legal tax advice.',
        },
        optimizerResult,
        userName: profile.full_name ?? user.email ?? 'User',
        businessName: profile.business_name ?? undefined,
      })

      fileContent = Buffer.from(doc.output('arraybuffer'))
      contentType = 'application/pdf'
      fileExt = 'pdf'
    }

    const BUCKET = 'tax-reports'
    const filePath = `${user.id}/${year}-${reportType}-${Date.now()}.${fileExt}`

    const { error: uploadErr } = await db.storage
      .from(BUCKET)
      .upload(filePath, fileContent, { contentType, upsert: true })

    if (uploadErr) {
      console.error('[export] upload error:', uploadErr)
      return NextResponse.json({ error: 'File upload failed' }, { status: 500 })
    }

    const { data: signed, error: signErr } = await db.storage
      .from(BUCKET)
      .createSignedUrl(filePath, 60 * 60 * 24)

    if (signErr || !signed?.signedUrl) {
      return NextResponse.json({ error: 'Signed URL creation failed' }, { status: 500 })
    }

    await (db as any).from('tax_reports').upsert({
      user_id: user.id,
      report_type: reportType,
      period_year: year,
      period_quarter: quarter ?? null,
      total_income: totalIncome,
      total_expense: totalExpense,
      vat_payable: vatData.vatPayable,
      estimated_tax: incomeTaxCalc.totalTax,
      risk_score: riskScore,
      file_url: signed.signedUrl,
      disclaimer_shown: true,
      generated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,report_type,period_year,period_quarter', ignoreDuplicates: false })

    return NextResponse.json({
      url: signed.signedUrl,
      filePath,
      reportType,
      format,
      period: period.label,
      riskScore,
      summary: { totalIncome, totalExpense, vatPayable: vatData.vatPayable, estimatedTax: incomeTaxCalc.totalTax },
    })

  } catch (error) {
    console.error('[export] Fatal:', error)
    return NextResponse.json({ error: `Export failed: ${String(error)}` }, { status: 500 })
  }
}
'''

files['src/app/api/optimize/route.ts'] = '''\
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
'''

for path, content in files.items():
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f'OK {path}')

print('All done')