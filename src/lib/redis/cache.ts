import { Redis } from '@upstash/redis'
import { Ratelimit } from '@upstash/ratelimit'
import type { ClassificationResult } from '@/lib/ai/classifier'

// ─── Singleton Redis client ───────────────────────────────────────────────────
//
// Instantiated once at module load.  In tests / build-time the env vars may be
// absent — the client will throw only when a method is actually called.

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

// ─── TTL constants ────────────────────────────────────────────────────────────

const TTL = {
  classifyResult: 7 * 24 * 60 * 60,    // 7 days
  dashboardCache: 5 * 60,              // 5 minutes
  uploadRateWindow: '1 h' as const,
} as const

// ─── Dashboard summary shape ──────────────────────────────────────────────────

export interface DashboardSummary {
  totalIncome: number
  totalExpense: number
  estimatedTax: number
  vatPayable: number
  riskScore: number
  transactionCount: number
  unclassifiedCount: number
  alertCount: number
  periodStart: string
  periodEnd: string
  generatedAt: string
}

// ─── 1. Classification result cache ──────────────────────────────────────────
//
// Keyed by `classify:{userId}:{txHash}`.
// The txHash (SHA-256 of date|desc|amount) guarantees a deterministic cache key
// so re-uploading the same bank CSV skips all Claude calls.

export const classifyCache = {
  /**
   * Fetch a single cached classification result.
   * Returns null on cache miss or Redis error (graceful degradation).
   */
  async get(userId: string, txHash: string): Promise<ClassificationResult | null> {
    try {
      const val = await redis.get<ClassificationResult>(`classify:${userId}:${txHash}`)
      return val ?? null
    } catch (err) {
      console.warn('[classifyCache.get] Redis error:', err)
      return null
    }
  },

  /**
   * Store a classification result.  Uses SETEX so the key auto-expires.
   */
  async set(userId: string, txHash: string, result: ClassificationResult): Promise<void> {
    try {
      await redis.setex(
        `classify:${userId}:${txHash}`,
        TTL.classifyResult,
        JSON.stringify(result)
      )
    } catch (err) {
      console.warn('[classifyCache.set] Redis error:', err)
    }
  },

  /**
   * Batch fetch for a list of hashes — one round-trip via MGET.
   * Preserves input order; misses and errors appear as null.
   */
  async mget(
    userId: string,
    hashes: string[]
  ): Promise<(ClassificationResult | null)[]> {
    if (hashes.length === 0) return []
    try {
      const keys = hashes.map((h) => `classify:${userId}:${h}`)
      // Cast away the tuple-type constraint that mget imposes; values are JSON strings
      const values = await (redis.mget(...keys) as Promise<(string | null)[]>)
      return values.map((v) => {
        if (!v) return null
        if (typeof v === 'string') {
          try { return JSON.parse(v) as ClassificationResult } catch { return null }
        }
        return v as unknown as ClassificationResult
      })
    } catch (err) {
      console.warn('[classifyCache.mget] Redis error:', err)
      return hashes.map(() => null)
    }
  },

  /**
   * Batch write — fires all SET operations in parallel.
   */
  async mset(userId: string, results: ClassificationResult[]): Promise<void> {
    if (results.length === 0) return
    try {
      await Promise.all(results.map((r) => classifyCache.set(userId, r.txHash, r)))
    } catch (err) {
      console.warn('[classifyCache.mset] Redis error:', err)
    }
  },
} as const

// ─── 2. Rate-limit cache ──────────────────────────────────────────────────────
//
// Sliding-window rate limiter: 20 uploads per user per hour.
// The limiter is constructed lazily so the build doesn't crash when Redis env
// vars are absent at build time.

let _uploadRatelimiter: Ratelimit | null = null

function getUploadRatelimiter(): Ratelimit {
  if (!_uploadRatelimiter) {
    _uploadRatelimiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(20, TTL.uploadRateWindow),
      prefix: 'taxflow:upload',
      analytics: false,
    })
  }
  return _uploadRatelimiter
}

export const rateLimitCache = {
  /**
   * Check and consume one upload token for a user.
   *
   * @returns `{ allowed: boolean; remaining: number; resetAt: number }`
   */
  async checkUploadLimit(userId: string): Promise<{
    allowed: boolean
    remaining: number
    resetAt: number
  }> {
    try {
      const limiter = getUploadRatelimiter()
      const { success, remaining, reset } = await limiter.limit(userId)
      return { allowed: success, remaining, resetAt: reset }
    } catch (err) {
      // Degrade gracefully: if Redis is unavailable, allow the upload
      console.warn('[rateLimitCache] Redis unavailable, allowing upload:', err)
      return { allowed: true, remaining: 19, resetAt: Date.now() + 3_600_000 }
    }
  },
} as const

// ─── 3. Session / dashboard cache ────────────────────────────────────────────
//
// Short-lived (5 min) cache for the expensive dashboard aggregate query.
// Invalidated manually after CSV upload / classification.

export const sessionCache = {
  async getDashboardSummary(userId: string): Promise<DashboardSummary | null> {
    try {
      const val = await redis.get<DashboardSummary>(`dashboard:${userId}`)
      if (!val) return null
      if (typeof val === 'string') {
        try { return JSON.parse(val) as DashboardSummary } catch { return null }
      }
      return val as DashboardSummary
    } catch (err) {
      console.warn('[sessionCache.getDashboardSummary] Redis error:', err)
      return null
    }
  },

  async setDashboardSummary(userId: string, data: DashboardSummary): Promise<void> {
    try {
      await redis.setex(`dashboard:${userId}`, TTL.dashboardCache, JSON.stringify(data))
    } catch (err) {
      console.warn('[sessionCache.setDashboardSummary] Redis error:', err)
    }
  },

  /** Bust the dashboard cache after new data arrives. */
  async invalidateDashboard(userId: string): Promise<void> {
    try {
      await redis.del(`dashboard:${userId}`)
    } catch (err) {
      console.warn('[sessionCache.invalidateDashboard] Redis error:', err)
    }
  },
} as const

// ─── Generic low-level helpers (kept for backward compatibility) ──────────────

export async function getCached<T>(key: string): Promise<T | null> {
  try {
    const val = await redis.get<T>(key)
    return val ?? null
  } catch {
    return null
  }
}

export async function setCached<T>(
  key: string,
  value: T,
  ttlSeconds = 3600
): Promise<void> {
  try {
    await redis.set(key, value, { ex: ttlSeconds })
  } catch (err) {
    console.warn('[setCached] Redis error:', err)
  }
}

export async function invalidateCache(key: string): Promise<void> {
  try {
    await redis.del(key)
  } catch (err) {
    console.warn('[invalidateCache] Redis error:', err)
  }
}
