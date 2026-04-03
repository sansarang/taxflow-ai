/**
 * Pattern Learning System
 * ─────────────────────────────────────────────────────────────────────────────
 * Stores per-user and global transaction description patterns so that future
 * classifications can skip Claude entirely for recurring merchants/expenses.
 *
 * Key structure:
 *   User pattern:    `pattern:{userId}:{normalizedDesc}`   → ClassificationResult JSON
 *   Global data:     `pattern:global:{normalizedDesc}`     → ClassificationResult JSON
 *   Global count:    `pattern:global:{normalizedDesc}:cnt` → integer (frequency)
 *
 * A pattern is trusted when confidence >= CONFIDENCE_THRESHOLD (0.85).
 * All keys use a 90-day TTL; every write refreshes the TTL.
 */

import { redis } from './cache'
import type { ClassificationResult } from '@/lib/ai/classifier'

// ─── Constants ────────────────────────────────────────────────────────────────

const TTL_90_DAYS = 90 * 24 * 60 * 60          // seconds
const CONFIDENCE_THRESHOLD = 0.85
const MAX_GLOBAL_PATTERNS = 1000               // guard against unbounded growth

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Store a newly obtained classification result as a learned pattern.
 *
 * Both a user-specific record and a global frequency record are written.
 * Only results with confidence >= CONFIDENCE_THRESHOLD are stored so that
 * low-quality Claude outputs don't pollute the pattern store.
 */
export async function learnPattern(
  userId: string,
  description: string,
  classification: ClassificationResult
): Promise<void> {
  // Only persist high-confidence results
  if (classification.confidence < CONFIDENCE_THRESHOLD) return

  const normalized = normalizeDesc(description)
  if (!normalized) return

  const serialized = JSON.stringify(classification)

  try {
    await Promise.all([
      // User-specific pattern — highest priority on lookup
      redis.setex(`pattern:${userId}:${normalized}`, TTL_90_DAYS, serialized),

      // Global data: store the most recent high-confidence result
      redis.setex(`pattern:global:${normalized}`, TTL_90_DAYS, serialized),

      // Global count: increment and reset TTL
      incrementGlobalCount(normalized),
    ])
  } catch (err) {
    // Pattern learning is non-critical — log and continue
    console.warn('[pattern-learner] learnPattern error:', err)
  }
}

/**
 * Look up a prior classification for a transaction description.
 *
 * Lookup order:
 *   1. User-specific pattern  (highest trust — learned from this user's data)
 *   2. Global pattern         (learned from all users — lower trust)
 *
 * Returns null when:
 *   - No pattern exists
 *   - Stored confidence is below CONFIDENCE_THRESHOLD
 *   - Redis is unavailable
 */
export async function lookupPattern(
  userId: string,
  description: string
): Promise<ClassificationResult | null> {
  const normalized = normalizeDesc(description)
  if (!normalized) return null

  try {
    // ── Try user-specific pattern first ────────────────────────────────────
    const userResult = await fetchAndValidate(`pattern:${userId}:${normalized}`)
    if (userResult) return userResult

    // ── Fall back to global pattern ─────────────────────────────────────────
    const globalResult = await fetchAndValidate(`pattern:global:${normalized}`)
    return globalResult
  } catch (err) {
    console.warn('[pattern-learner] lookupPattern error:', err)
    return null
  }
}

/**
 * Batch lookup — one Redis call per key pair (user + global).
 * Returns an array parallel to the input descriptions array.
 */
export async function lookupPatternsBatch(
  userId: string,
  descriptions: string[]
): Promise<(ClassificationResult | null)[]> {
  if (descriptions.length === 0) return []

  const normalized = descriptions.map(normalizeDesc)

  // Deduplicate keys to minimize Redis calls
  const userKeys = normalized.map((n) => (n ? `pattern:${userId}:${n}` : ''))
  const globalKeys = normalized.map((n) => (n ? `pattern:global:${n}` : ''))

  // Build a flat list of all non-empty keys for a single MGET
  const allKeys = [...userKeys, ...globalKeys].filter(Boolean) as string[]

  if (allKeys.length === 0) return descriptions.map(() => null)

  try {
    // Cast away the tuple-type constraint that mget imposes; values are JSON strings
    const values = await (redis.mget(...allKeys) as Promise<(string | null)[]>)

    // Map back — first half is user keys, second half is global keys
    return normalized.map((_, i) => {
      const userKeyIdx = userKeys[i] ? allKeys.indexOf(userKeys[i]) : -1
      const userVal = userKeyIdx >= 0 ? values[userKeyIdx] : null
      if (userVal) {
        const r = parseAndValidate(userVal)
        if (r) return r
      }

      const globalKeyIdx = globalKeys[i] ? allKeys.indexOf(globalKeys[i]) : -1
      const globalVal = globalKeyIdx >= 0 ? values[globalKeyIdx] : null
      if (globalVal) {
        const r = parseAndValidate(globalVal)
        if (r) return r
      }

      return null
    })
  } catch (err) {
    console.warn('[pattern-learner] lookupPatternsBatch error:', err)
    return descriptions.map(() => null)
  }
}

/**
 * Delete a user's learned pattern for a description (e.g. after manual override).
 */
export async function forgetPattern(userId: string, description: string): Promise<void> {
  const normalized = normalizeDesc(description)
  if (!normalized) return
  try {
    await redis.del(`pattern:${userId}:${normalized}`)
  } catch (err) {
    console.warn('[pattern-learner] forgetPattern error:', err)
  }
}

// ─── normalizeDesc ────────────────────────────────────────────────────────────

/**
 * Normalise a transaction description to a stable cache key.
 *
 * Rules:
 *   1. Lowercase
 *   2. Remove all digit characters (0-9, ０-９ fullwidth)
 *   3. Remove punctuation / special characters — keep Korean + Latin letters + spaces
 *   4. Collapse whitespace
 *   5. Trim and truncate to 50 characters
 *
 * Examples:
 *   "Adobe Creative Cloud 2024-01"  → "adobe creative cloud"
 *   "카카오페이 결제 12,000원"           → "카카오페이 결제 원"  (numbers stripped)
 *   "STARBUCKS #0123"               → "starbucks"
 */
export function normalizeDesc(description: string): string {
  return description
    .toLowerCase()
    // Remove ASCII digits and fullwidth digits (U+FF10–U+FF19)
    .replace(/[0-9０-９]/g, '')
    // Keep Korean syllables (AC00–D7A3), Hangul jamo (1100–11FF),
    // basic Latin letters, and spaces.  Remove everything else.
    .replace(/[^\uAC00-\uD7A3\u1100-\u11FFa-z\s]/g, '')
    // Collapse multiple spaces
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 50)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function fetchAndValidate(key: string): Promise<ClassificationResult | null> {
  const raw = await redis.get<string | ClassificationResult>(key)
  if (!raw) return null
  return parseAndValidate(raw)
}

function parseAndValidate(
  raw: string | ClassificationResult
): ClassificationResult | null {
  let result: ClassificationResult

  if (typeof raw === 'string') {
    try {
      result = JSON.parse(raw) as ClassificationResult
    } catch {
      return null
    }
  } else {
    result = raw
  }

  // Enforce minimum confidence
  if (!result || typeof result.confidence !== 'number') return null
  if (result.confidence < CONFIDENCE_THRESHOLD) return null

  return result
}

async function incrementGlobalCount(normalized: string): Promise<void> {
  const countKey = `pattern:global:${normalized}:cnt`
  try {
    const count = await redis.incr(countKey)
    // Refresh TTL on every write
    await redis.expire(countKey, TTL_90_DAYS)

    // Safety cap: if this key has become extremely popular, log it
    if (count === MAX_GLOBAL_PATTERNS) {
      console.info(`[pattern-learner] Global pattern "${normalized}" reached ${count} occurrences`)
    }
  } catch {
    // Non-critical — ignore count errors
  }
}
