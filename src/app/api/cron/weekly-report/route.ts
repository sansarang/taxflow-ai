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
