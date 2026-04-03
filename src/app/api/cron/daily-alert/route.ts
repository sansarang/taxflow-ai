/**
 * Cron: Daily Tax Deadline Alert
 * ─────────────────────────────────────────────────────────────────────────────
 * Vercel Cron schedule: 0 10 * * *  (10:00 UTC = 19:00 KST)
 *
 * Scans all 2026 Korean tax deadlines and, for any deadline within the next
 * 7 days, fans out reminder emails / Kakao messages to all users who have
 * notifications enabled and have not already been alerted today.
 *
 * 2026 Korean tax deadlines:
 *   - 01/25  부가세 확정신고 (2025년 2기)
 *   - 04/25  부가세 예정신고 (2026년 1기)
 *   - 05/31  종합소득세 확정신고 (2025년 귀속)
 *   - 07/25  부가세 확정신고 (2026년 1기)
 *   - 10/25  부가세 예정신고 (2026년 2기)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { dispatchDeadlineAlert } from '@/lib/notifications/push-dispatcher'
import type { TaxDeadline } from '@/lib/notifications/email'

// ─── Auth guard ───────────────────────────────────────────────────────────────

function verifyCronSecret(request: NextRequest): boolean {
  const auth = request.headers.get('authorization')
  return auth === `Bearer ${process.env.CRON_SECRET}`
}

// ─── Korean tax deadlines (2026) ──────────────────────────────────────────────

function getTaxDeadlines(year: number): TaxDeadline[] {
  return [
    {
      name: '부가세 2기 확정신고',
      dueDate: `${year}-01-25`,
      description: `신고 기간: ${year - 1}년 7월 ~ 12월`,
      penaltyNote: '무신고 시 납부세액의 20% 가산세 부과',
    },
    {
      name: '부가세 1기 예정신고',
      dueDate: `${year}-04-25`,
      description: `신고 기간: ${year}년 1월 ~ 3월`,
      penaltyNote: '예정신고 미이행 시 예정고지로 대체 (사업자 불이익)',
    },
    {
      name: '종합소득세 확정신고',
      dueDate: `${year}-05-31`,
      description: `신고 기간: ${year - 1}년 1월 ~ 12월 귀속 소득`,
      penaltyNote: '무신고 시 산출세액의 20%(부당 무신고 40%) 가산세',
    },
    {
      name: '부가세 1기 확정신고',
      dueDate: `${year}-07-25`,
      description: `신고 기간: ${year}년 1월 ~ 6월`,
      penaltyNote: '무신고 시 납부세액의 20% 가산세 부과',
    },
    {
      name: '부가세 2기 예정신고',
      dueDate: `${year}-10-25`,
      description: `신고 기간: ${year}년 7월 ~ 9월`,
      penaltyNote: '예정신고 미이행 시 예정고지로 대체',
    },
  ]
}

/** Returns deadlines that fall within the next `windowDays` days from today. */
function getUpcomingDeadlines(deadlines: TaxDeadline[], windowDays = 7): TaxDeadline[] {
  const now = Date.now()
  const windowMs = windowDays * 24 * 60 * 60 * 1000

  return deadlines.filter((d) => {
    const due = new Date(d.dueDate).getTime()
    return due >= now && due <= now + windowMs
  })
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startedAt = Date.now()
  const year = new Date().getFullYear()

  try {
    const upcoming = getUpcomingDeadlines(getTaxDeadlines(year))

    if (upcoming.length === 0) {
      return NextResponse.json({
        success: true,
        message: '다가오는 마감일 없음',
        elapsed: Date.now() - startedAt,
      })
    }

    const db = createAdminClient()

    // Fetch all users with at least one notification channel enabled
    const { data: users, error: usersErr } = await (db as any)
      .from('users_profile')
      .select('id, email, full_name, notification_email, notification_kakao, kakao_token')
      .or('notification_email.eq.true,notification_kakao.eq.true')

    if (usersErr || !users) {
      throw new Error(`Failed to fetch users: ${usersErr?.message}`)
    }

    // Deduplicate: don't re-alert a user if they already have a tax_deadline alert
    // for this exact deadline title created within the last 24 hours.
    const { data: recentAlerts } = await (db as any)
      .from('optimization_alerts')
      .select('user_id, title')
      .eq('alert_type', 'tax_deadline')
      .gte('created_at', new Date(Date.now() - 86_400_000).toISOString())

    const alreadyAlerted = new Set<string>(
      (recentAlerts ?? []).map((a: { user_id: string; title: string }) =>
        `${a.user_id}::${a.title}`
      )
    )

    let dispatched = 0
    let skipped = 0

    for (const deadline of upcoming) {
      const daysLeft = Math.ceil(
        (new Date(deadline.dueDate).getTime() - Date.now()) / 86_400_000
      )
      const alertTitle = `${deadline.name} D-${daysLeft}`

      for (const user of users) {
        const dedupKey = `${user.id}::${alertTitle}`
        if (alreadyAlerted.has(dedupKey)) {
          skipped++
          continue
        }

        try {
          await dispatchDeadlineAlert(
            user.id,
            user.email,
            user.full_name ?? user.email.split('@')[0],
            deadline,
            user.notification_email ?? false,
            user.notification_kakao ?? false,
            user.kakao_token ?? null
          )
          dispatched++
        } catch (err) {
          console.error(`[cron/daily-alert] Failed for user ${user.id}:`, err)
        }
      }
    }

    console.info(
      `[cron/daily-alert] Complete — deadlines: ${upcoming.length}, dispatched: ${dispatched}, skipped: ${skipped}`
    )

    return NextResponse.json({
      success: true,
      upcomingDeadlines: upcoming.map((d) => d.name),
      dispatched,
      skipped,
      elapsed: Date.now() - startedAt,
    })
  } catch (error) {
    console.error('[cron/daily-alert]', error)
    return NextResponse.json(
      { error: '일일 마감일 알림 발송 실패', detail: String(error) },
      { status: 500 }
    )
  }
}
