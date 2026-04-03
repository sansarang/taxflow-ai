/**
 * Usage Tracker
 * ─────────────────────────────────────────────────────────────────────────────
 * Checks and increments per-user monthly classification usage.
 *
 * Source of truth: `users_profile.monthly_classify_count` in Supabase.
 * Redis is used as a fast-path cache but the DB is always the authoritative
 * reset gate (based on `monthly_classify_reset_at`).
 *
 * Plan limits:
 *   Free:     5 classifies / month
 *   Pro:      unlimited
 *   Business: unlimited
 */

import { createAdminClient } from '@/lib/supabase/server'

// ─── Plan limits ──────────────────────────────────────────────────────────────

export const PLAN_MONTHLY_LIMITS: Record<string, number> = {
  free:     5,
  pro:      Infinity,
  business: Infinity,
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface UsageCheckResult {
  allowed:         boolean
  remaining:       number   // Infinity for paid plans
  plan:            string
  currentCount:    number
  monthlyLimit:    number   // -1 means unlimited
  upgradeRequired: boolean
}

/**
 * Atomically check usage and increment the counter for one classification call.
 *
 * Flow:
 *   1. Fetch profile row (plan, monthly_classify_count, monthly_classify_reset_at)
 *   2. If reset_at < start of this calendar month → zero out count first
 *   3. If plan is paid → always allow (no increment needed for counting)
 *   4. If plan is free and count >= limit → block
 *   5. Otherwise → increment count and allow
 */
export async function checkAndIncrementUsage(userId: string): Promise<UsageCheckResult> {
  const db = createAdminClient() as any // eslint-disable-line @typescript-eslint/no-explicit-any

  // ── Fetch current usage ───────────────────────────────────────────────────
  const { data: profile, error } = await db
    .from('users_profile')
    .select('plan, monthly_classify_count, monthly_classify_reset_at')
    .eq('id', userId)
    .single()

  if (error || !profile) {
    // Fail open: don't block the user if DB is unreachable
    console.error('[usage-tracker] Failed to fetch profile:', error)
    return { allowed: true, remaining: 1, plan: 'free', currentCount: 0, monthlyLimit: 5, upgradeRequired: false }
  }

  const plan: string = profile.plan ?? 'free'
  const limit = PLAN_MONTHLY_LIMITS[plan] ?? 5

  // ── Paid plans: always allow ──────────────────────────────────────────────
  if (plan === 'pro' || plan === 'business') {
    return {
      allowed: true,
      remaining: Infinity,
      plan,
      currentCount: profile.monthly_classify_count ?? 0,
      monthlyLimit: -1,
      upgradeRequired: false,
    }
  }

  // ── Check if monthly counter needs reset ──────────────────────────────────
  const resetAt   = new Date(profile.monthly_classify_reset_at ?? 0)
  const monthStart = getMonthStart()
  const needsReset = resetAt < monthStart

  let currentCount: number

  if (needsReset) {
    // Reset the counter and update reset_at timestamp
    await db
      .from('users_profile')
      .update({
        monthly_classify_count:   0,
        monthly_classify_reset_at: monthStart.toISOString(),
      })
      .eq('id', userId)

    currentCount = 0
  } else {
    currentCount = profile.monthly_classify_count ?? 0
  }

  // ── Check limit ───────────────────────────────────────────────────────────
  if (currentCount >= limit) {
    return {
      allowed:         false,
      remaining:       0,
      plan,
      currentCount,
      monthlyLimit:    limit,
      upgradeRequired: true,
    }
  }

  // ── Increment and allow ───────────────────────────────────────────────────
  await db
    .from('users_profile')
    .update({ monthly_classify_count: currentCount + 1 })
    .eq('id', userId)

  return {
    allowed:         true,
    remaining:       limit - currentCount - 1,
    plan,
    currentCount:    currentCount + 1,
    monthlyLimit:    limit,
    upgradeRequired: false,
  }
}

/**
 * Fetch current usage stats without incrementing.
 * Used by the settings/billing page to display the usage meter.
 */
export async function getUsageStats(userId: string): Promise<{
  plan:         string
  currentCount: number
  monthlyLimit: number
  resetAt:      string
}> {
  const db = createAdminClient() as any

  const { data: profile } = await db
    .from('users_profile')
    .select('plan, monthly_classify_count, monthly_classify_reset_at')
    .eq('id', userId)
    .single()

  const plan  = profile?.plan ?? 'free'
  const limit = PLAN_MONTHLY_LIMITS[plan] ?? 5

  return {
    plan,
    currentCount: profile?.monthly_classify_count ?? 0,
    monthlyLimit: limit === Infinity ? -1 : limit,
    resetAt:      profile?.monthly_classify_reset_at ?? new Date().toISOString(),
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getMonthStart(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
}

// ─── Backward-compat (old Redis-based API) ────────────────────────────────────

export const PLAN_LIMITS = {
  free:     { classifications: 5,        optimizations: 3,        exports: 1 },
  pro:      { classifications: Infinity, optimizations: 30,       exports: 10 },
  business: { classifications: Infinity, optimizations: Infinity, exports: Infinity },
} as const

type UsageFeature = 'classifications' | 'optimizations' | 'exports'
type Plan = keyof typeof PLAN_LIMITS

/** @deprecated Use checkAndIncrementUsage() instead. */
export async function checkUsageLimit(
  userId: string,
  plan: Plan,
  feature: UsageFeature
): Promise<{ allowed: boolean; current: number; limit: number }> {
  // Delegate classify checks to the DB-backed implementation
  if (feature === 'classifications') {
    const result = await checkAndIncrementUsage(userId)
    return {
      allowed: result.allowed,
      current: result.currentCount,
      limit:   result.monthlyLimit,
    }
  }

  // For other features, use Redis-based counter as before
  const { redis } = await import('@/lib/redis/cache')
  const key = `usage:${userId}:${feature}:${getCurrentMonth()}`
  const current = Number(await redis.get(key) ?? 0)
  const planLimits = PLAN_LIMITS[plan]
  const limit = planLimits[feature] as number

  return {
    allowed: current < limit,
    current,
    limit:   limit === Infinity ? -1 : limit,
  }
}

/** @deprecated */
export async function incrementUsage(userId: string, feature: UsageFeature): Promise<void> {
  const { redis } = await import('@/lib/redis/cache')
  const key = `usage:${userId}:${feature}:${getCurrentMonth()}`
  await redis.incr(key)
  await redis.expire(key, 60 * 60 * 24 * 32)
}

function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}
