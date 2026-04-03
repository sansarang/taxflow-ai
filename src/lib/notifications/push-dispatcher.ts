/**
 * Push Dispatcher
 * ─────────────────────────────────────────────────────────────────────────────
 * Central orchestration layer for all outbound notifications.
 *
 * Two entry points:
 *
 *   dispatchAlerts(userId, alerts)
 *     Full-flow: inserts alerts into DB → reads user prefs → sends email/kakao
 *     → marks is_pushed=true.  Used by cron jobs and new code paths.
 *
 *   dispatchNotification(options)
 *     Lightweight send-only: does NOT insert into DB.  Kept for backward
 *     compatibility with the classify API route which handles its own inserts.
 */

import {
  sendOptimizationAlert,
  sendDeadlineReminder,
  sendEmail,
  type TaxDeadline,
} from './email'
import {
  sendKakaoOptimizationAlert,
  sendKakaoDeadlineReminder,
  sendKakaoAlert,
} from './kakao'
import type { OptimizationAlert, InsertDto } from '@/types/supabase'

// ─── dispatchAlerts — full-flow ───────────────────────────────────────────────

/**
 * Insert optimization alerts into the DB and fan out to enabled channels.
 *
 * Steps:
 *   1. Fetch user notification preferences (email, kakao, profile) from Supabase
 *   2. Batch-insert alerts into `optimization_alerts` (marks is_pushed=false initially)
 *   3. If notification_email=true → sendOptimizationAlert
 *   4. If notification_kakao=true → sendKakaoOptimizationAlert
 *   5. Mark inserted alert rows as is_pushed=true
 *
 * All channel sends are best-effort (errors logged, not thrown).
 */
export async function dispatchAlerts(
  userId: string,
  alerts: Omit<InsertDto<'optimization_alerts'>, 'user_id'>[]
): Promise<void> {
  if (alerts.length === 0) return

  // Lazy import to avoid module-level instantiation errors at build time
  const { createAdminClient } = await import('@/lib/supabase/server')
  const db = createAdminClient()

  // ── 1. Fetch user preferences ─────────────────────────────────────────────
  const { data: profile, error: profileErr } = await (db as any)
    .from('users_profile')
    .select('email, full_name, notification_email, notification_kakao, kakao_token')
    .eq('id', userId)
    .single()

  if (profileErr || !profile) {
    console.error('[dispatcher] Failed to fetch user profile:', profileErr)
    return
  }

  // ── 2. Insert alerts into DB ──────────────────────────────────────────────
  const rows: InsertDto<'optimization_alerts'>[] = alerts.map((a) => ({
    ...a,
    user_id: userId,
    is_pushed: false,
  }))

  const { data: inserted, error: insertErr } = await (db as any)
    .from('optimization_alerts')
    .insert(rows)
    .select('id')

  if (insertErr) {
    console.error('[dispatcher] Failed to insert alerts:', insertErr)
    return
  }

  const insertedIds: string[] = (inserted ?? []).map((r: { id: string }) => r.id)

  // ── 3 & 4. Fan out to notification channels ───────────────────────────────
  const fullAlerts: OptimizationAlert[] = alerts.map((a, i) => ({
    id: insertedIds[i] ?? '',
    user_id: userId,
    alert_type: a.alert_type,
    title: a.title,
    body: a.body,
    amount_impact: a.amount_impact ?? null,
    is_read: false,
    is_pushed: false,
    created_at: new Date().toISOString(),
  }))

  const userName = profile.full_name ?? profile.email.split('@')[0]

  await Promise.allSettled([
    profile.notification_email && profile.email
      ? sendOptimizationAlert(profile.email, userName, fullAlerts)
      : Promise.resolve(),

    profile.notification_kakao && profile.kakao_token
      ? sendKakaoOptimizationAlert(profile.kakao_token, userName, fullAlerts)
      : Promise.resolve(),
  ])

  // ── 5. Mark as pushed ─────────────────────────────────────────────────────
  if (insertedIds.length > 0) {
    await (db as any)
      .from('optimization_alerts')
      .update({ is_pushed: true })
      .in('id', insertedIds)
  }
}

/**
 * Dispatch a single deadline reminder to a specific user.
 * Inserts a `tax_deadline` alert and sends to enabled channels.
 */
export async function dispatchDeadlineAlert(
  userId: string,
  userEmail: string,
  userName: string,
  deadline: TaxDeadline,
  notificationEmail: boolean,
  notificationKakao: boolean,
  kakaoToken: string | null
): Promise<void> {
  const { createAdminClient } = await import('@/lib/supabase/server')
  const db = createAdminClient()

  const daysLeft = Math.ceil(
    (new Date(deadline.dueDate).getTime() - Date.now()) / 86_400_000
  )

  // Insert alert record
  const { data: inserted } = await (db as any)
    .from('optimization_alerts')
    .insert({
      user_id: userId,
      alert_type: 'tax_deadline',
      title: `${deadline.name} D-${daysLeft}`,
      body: `${deadline.description} · 마감일: ${deadline.dueDate}`,
      amount_impact: null,
      is_pushed: false,
    })
    .select('id')
    .single()

  // Fan out
  await Promise.allSettled([
    notificationEmail
      ? sendDeadlineReminder(userEmail, userName, deadline)
      : Promise.resolve(),
    notificationKakao && kakaoToken
      ? sendKakaoDeadlineReminder(kakaoToken, userName, deadline)
      : Promise.resolve(),
  ])

  // Mark pushed
  if (inserted?.id) {
    await (db as any)
      .from('optimization_alerts')
      .update({ is_pushed: true })
      .eq('id', inserted.id)
  }
}

// ─── dispatchNotification — backward-compat lightweight send ─────────────────

export type NotificationChannel = 'email' | 'kakao' | 'all'

interface DispatchOptions {
  userId: string
  channel: NotificationChannel
  subject: string
  message: string
  email?: string
  kakaoUuid?: string
}

/**
 * Send-only dispatcher (no DB insert).
 * Used by the classify API route which handles its own alert inserts.
 */
export async function dispatchNotification(options: DispatchOptions): Promise<void> {
  const tasks: Promise<void>[] = []

  if ((options.channel === 'email' || options.channel === 'all') && options.email) {
    tasks.push(
      sendEmail({
        to: options.email,
        subject: options.subject,
        html: `<p style="font-family:sans-serif;color:#1e293b;">${options.message}</p>`,
      })
    )
  }

  if ((options.channel === 'kakao' || options.channel === 'all') && options.kakaoUuid) {
    tasks.push(
      sendKakaoAlert(options.kakaoUuid, 'TAXFLOW_GENERIC_01', {
        subject: options.subject,
        message: options.message,
      })
    )
  }

  await Promise.allSettled(tasks)
}
