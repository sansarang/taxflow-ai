/**
 * Cron: Weekly Optimization Report
 * ─────────────────────────────────────────────────────────────────────────────
 * Vercel Cron schedule: 0 0 * * 1  (00:00 UTC Monday = 09:00 KST Monday)
 *
 * For every Pro and Business user:
 *   1. Fetch the last 7 days of classified transactions
 *   2. Run the deduction optimizer
 *   3. Send a weekly summary email (+ Kakao if enabled)
 *
 * Users are processed sequentially to avoid overwhelming Claude or Supabase.
 * One user failure does not stop the rest.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { runDeductionOptimizer } from '@/lib/ai/optimizer'
import { sendWeeklyReport } from '@/lib/notifications/email'
import { sendKakaoWeeklyReport } from '@/lib/notifications/kakao'
import type { TaxReportData } from '@/lib/ai/reporter'
import type { ClassifiedTransaction } from '@/lib/ai/optimizer'
import { DISCLAIMER } from '@/lib/ai/prompts'

// ─── Auth guard ───────────────────────────────────────────────────────────────

function verifyCronSecret(request: NextRequest): boolean {
  return request.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`
}

// ─── Default tax law fallback ─────────────────────────────────────────────────

const DEFAULT_TAX_LAW: import('@/lib/ai/optimizer').TaxLawData = {
  entertainmentAnnualLimit: 3_600_000,
  entertainmentPerReceiptLimit: 30_000,
  vehicleBusinessUseRatio: 0.5,
  yellowUmbrellaMaxDeduction: 5_000_000,
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startedAt = Date.now()
  const db = createAdminClient()

  // Period: last 7 days
  const now = new Date()
  const periodEnd = now.toISOString().slice(0, 10)
  const periodStart = new Date(now.getTime() - 7 * 86_400_000).toISOString().slice(0, 10)

  try {
    // ── Fetch Pro/Business users ──────────────────────────────────────────────
    const { data: users, error: usersErr } = await (db as any)
      .from('users_profile')
      .select(
        'id, email, full_name, business_type, is_simplified_tax, annual_revenue_tier, ' +
        'notification_email, notification_kakao, kakao_token, plan'
      )
      .in('plan', ['pro', 'business'])

    if (usersErr || !users) {
      throw new Error(`Failed to fetch Pro/Business users: ${usersErr?.message}`)
    }

    let processed = 0
    let failed = 0
    const errors: string[] = []

    for (const user of users) {
      try {
        // ── Fetch last 7 days of classified transactions ────────────────────
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
        if (!rows || rows.length === 0) {
          // Skip users with no transactions this week
          continue
        }

        const transactions: ClassifiedTransaction[] = rows.map((r: any) => ({
          id: r.id,
          transactionDate: r.transaction_date,
          description: r.description,
          amount: r.amount,
          taxCategory: r.tax_category,
          categoryLabel: r.category_label,
          vatDeductible: r.vat_deductible ?? null,
          confidence: r.confidence ?? null,
          riskFlag: r.risk_flag ?? [],
          receiptRequired: r.receipt_required ?? false,
        }))

        // ── Run optimizer ─────────────────────────────────────────────────
        const profile = {
          business_type: user.business_type,
          is_simplified_tax: user.is_simplified_tax,
          annual_revenue_tier: user.annual_revenue_tier,
        }
        const optimizerResult = await runDeductionOptimizer(
          transactions,
          profile as any,
          DEFAULT_TAX_LAW
        )

        // ── Build TaxReportData for email ──────────────────────────────────
        const income = transactions
          .filter((t) => t.amount > 0)
          .reduce((s, t) => s + t.amount, 0)
        const expense = transactions
          .filter((t) => t.amount < 0)
          .reduce((s, t) => s + Math.abs(t.amount), 0)

        // Build top categories
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
          totalIncome: income,
          totalExpense: expense,
          vatPayable: income * (user.is_simplified_tax ? 0.04 : 0.10) -
                      expense * (user.is_simplified_tax ? 0 : 0.10),
          estimatedTax: optimizerResult.totalDeductibleAmount > 0
            ? Math.max(0, (income - optimizerResult.totalDeductibleAmount) * 0.15)
            : income * 0.15,
          effectiveRate: 0.15,
          riskScore: optimizerResult.riskScore,
          deductions: {},
          topCategories,
          summary: {
            headline: optimizerResult.recommendations[0]?.title ?? '이번 주 거래 내역을 분석했습니다.',
            keyPoints: optimizerResult.recommendations
              .slice(0, 3)
              .map((r) => r.description),
            actionRequired: optimizerResult.creatorSpecificAlerts[0] ?? '',
          },
          disclaimer: DISCLAIMER,
        }

        const userName = user.full_name ?? user.email.split('@')[0]

        // ── Send notifications ─────────────────────────────────────────────
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
        const msg = `User ${user.id}: ${String(userErr)}`
        errors.push(msg)
        console.error('[cron/weekly-report]', msg)
      }
    }

    console.info(
      `[cron/weekly-report] Complete — processed: ${processed}, failed: ${failed}, elapsed: ${Date.now() - startedAt}ms`
    )

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
    console.error('[cron/weekly-report] Fatal error:', error)
    return NextResponse.json(
      { error: '주간 리포트 생성 실패', detail: String(error) },
      { status: 500 }
    )
  }
}
