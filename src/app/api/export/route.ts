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
