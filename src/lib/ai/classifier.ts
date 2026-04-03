/**
 * Transaction Classifier
 * ─────────────────────────────────────────────────────────────────────────────
 * Three-tier lookup for each transaction:
 *
 *   Tier 0 — Pattern cache  (by normalised description)
 *     Redis key: `pattern:{userId}:{normalizedDesc}`
 *     Hit condition: confidence >= 0.85
 *     → Fastest: skips both txHash lookup and Claude
 *
 *   Tier 1 — TxHash cache   (exact SHA-256 hash of date|desc|amount)
 *     Redis key: `classify:{userId}:{txHash}`
 *     Hit condition: key exists (any confidence)
 *     → Still fast: skips Claude; result was validated on first call
 *
 *   Tier 2 — Claude API     (batch size ≤ 15)
 *     On fresh result: write to BOTH pattern cache and txHash cache
 *
 * This ordering means:
 *   • Re-uploading the same CSV → 100 % cache hits (Tier 1)
 *   • Uploading a new month from the same bank → most hits via Tier 0
 *     (recurring merchants like Adobe / KT / 스타벅스 are already known)
 *   • Brand-new descriptions → Tier 2 with automatic cache population
 */

import Anthropic from '@anthropic-ai/sdk'
import { classifyCache } from '@/lib/redis/cache'
import { lookupPatternsBatch, learnPattern } from '@/lib/redis/pattern-learner'
import {
  SYSTEM_PROMPT_BASE,
  CREATOR_DEDUCTIONS_CONTEXT,
  TAX_CATEGORY_CODES,
  DISCLAIMER,
  buildClassificationUserPrompt,
} from './prompts'

// ─── Public types ─────────────────────────────────────────────────────────────

export interface ClassificationResult {
  txHash: string
  taxCategory: string          // '101'~'402'
  categoryLabel: string        // 한국어 분류명
  vatDeductible: boolean
  expenseType: string
  confidence: number           // 0.0~1.0
  aiReason: string
  riskFlags: string[]          // e.g. ['receipt_required','review_needed']
  receiptRequired: boolean
  disclaimer: string
}

export interface TransactionInput {
  txHash: string
  date: string
  description: string
  amount: number
}

export interface UserProfileContext {
  businessType: string
  isSimplifiedTax: boolean
  annualRevenueTier: string
}

// ─── Internal hit-source tracking (useful for logging / analytics) ────────────

type HitSource = 'pattern' | 'txhash' | 'claude' | 'fallback'

interface ResolvedResult {
  result: ClassificationResult
  source: HitSource
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BATCH_SIZE = 15
const CLAUDE_MODEL = 'claude-sonnet-4-20250514'

const CLASSIFICATION_SYSTEM = [
  SYSTEM_PROMPT_BASE,
  '',
  CREATOR_DEDUCTIONS_CONTEXT,
  '',
  TAX_CATEGORY_CODES,
].join('\n')

// ─── Fallback result ──────────────────────────────────────────────────────────

function fallbackResult(txHash: string): ClassificationResult {
  return {
    txHash,
    taxCategory: '402',
    categoryLabel: '분류 실패',
    vatDeductible: false,
    expenseType: '개인',
    confidence: 0,
    aiReason: '자동 분류에 실패했습니다. 수동 검토가 필요합니다.',
    riskFlags: ['review_needed'],
    receiptRequired: false,
    disclaimer: DISCLAIMER,
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function classifyTransactions(
  transactions: TransactionInput[],
  userProfile: UserProfileContext,
  userId: string
): Promise<ClassificationResult[]> {
  if (transactions.length === 0) return []

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const resolvedMap = new Map<string, ResolvedResult>()

  // ── Tier 0: Pattern cache lookup (batch) ──────────────────────────────────
  //
  // One MGET round-trip for all descriptions.  Any hit with confidence >= 0.85
  // is accepted immediately and does NOT consume a txHash cache slot — the
  // pattern cache IS the cache for this description going forward.

  const patternResults = await lookupPatternsBatch(
    userId,
    transactions.map((tx) => tx.description)
  )

  const afterPatternMiss: TransactionInput[] = []

  for (let i = 0; i < transactions.length; i++) {
    const tx = transactions[i]
    const patternHit = patternResults[i]

    if (patternHit) {
      // Stamp the correct txHash (pattern result may have a different hash from
      // the original classification run, since txHash encodes amount+date too)
      resolvedMap.set(tx.txHash, {
        result: { ...patternHit, txHash: tx.txHash },
        source: 'pattern',
      })
    } else {
      afterPatternMiss.push(tx)
    }
  }

  // ── Tier 1: TxHash cache lookup (batch MGET) ──────────────────────────────
  //
  // For everything that the pattern cache didn't cover, try the exact-hash key.

  const afterTxHashMiss: TransactionInput[] = []

  if (afterPatternMiss.length > 0) {
    const cachedResults = await classifyCache.mget(
      userId,
      afterPatternMiss.map((tx) => tx.txHash)
    )

    for (let i = 0; i < afterPatternMiss.length; i++) {
      const tx = afterPatternMiss[i]
      const cached = cachedResults[i]

      if (cached) {
        resolvedMap.set(tx.txHash, { result: cached, source: 'txhash' })
      } else {
        afterTxHashMiss.push(tx)
      }
    }
  }

  // ── Tier 2: Claude batch calls ────────────────────────────────────────────
  //
  // Only transactions that missed both caches reach Claude.

  if (afterTxHashMiss.length > 0) {
    const batches = chunk(afterTxHashMiss, BATCH_SIZE)
    const cacheWriteQueue: ClassificationResult[] = []

    for (const batch of batches) {
      const batchResults = await classifyBatch(anthropic, batch, userProfile)

      for (const result of batchResults) {
        resolvedMap.set(result.txHash, { result, source: 'claude' })
        cacheWriteQueue.push(result)
      }
    }

    // ── Write-back: txHash cache + pattern learning ────────────────────────
    // Fire all writes in parallel; failures are non-fatal.
    await Promise.all([
      // Tier 1 write-back
      classifyCache.mset(userId, cacheWriteQueue),
      // Tier 0 write-back — only high-confidence results
      ...cacheWriteQueue.map((result) => {
        const originalTx = afterTxHashMiss.find((tx) => tx.txHash === result.txHash)
        if (!originalTx) return Promise.resolve()
        return learnPattern(userId, originalTx.description, result)
      }),
    ])
  }

  // ── Log cache efficiency ──────────────────────────────────────────────────
  if (process.env.NODE_ENV !== 'production') {
    const patternHits = [...resolvedMap.values()].filter((r) => r.source === 'pattern').length
    const txHashHits = [...resolvedMap.values()].filter((r) => r.source === 'txhash').length
    const claudeHits = [...resolvedMap.values()].filter((r) => r.source === 'claude').length
    const fallbacks = [...resolvedMap.values()].filter((r) => r.source === 'fallback').length
    console.debug(
      `[classifier] ${transactions.length} tx → pattern:${patternHits} txhash:${txHashHits} claude:${claudeHits} fallback:${fallbacks}`
    )
  }

  // ── Restore original order ────────────────────────────────────────────────
  return transactions.map(
    (tx) => resolvedMap.get(tx.txHash)?.result ?? fallbackResult(tx.txHash)
  )
}

// ─── Batch classification ─────────────────────────────────────────────────────

async function classifyBatch(
  anthropic: Anthropic,
  batch: TransactionInput[],
  userProfile: UserProfileContext
): Promise<ClassificationResult[]> {
  const userPrompt = buildClassificationUserPrompt(batch, userProfile)

  let raw: string
  try {
    const message = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 4000,
      system: CLASSIFICATION_SYSTEM,
      messages: [{ role: 'user', content: userPrompt }],
    })
    const content = message.content[0]
    if (content.type !== 'text') throw new Error('Unexpected non-text response from Claude')
    raw = content.text
  } catch (err) {
    console.error('[classifier] Claude API error:', err)
    return batch.map((tx) => fallbackResult(tx.txHash))
  }

  // ── Parse ────────────────────────────────────────────────────────────────
  let parsed: unknown[]
  try {
    const clean = raw.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim()
    parsed = JSON.parse(clean)
    if (!Array.isArray(parsed)) throw new Error('Response is not a JSON array')
  } catch {
    console.error('[classifier] JSON parse error. Raw (first 500 chars):', raw.slice(0, 500))
    return batch.map((tx) => fallbackResult(tx.txHash))
  }

  // ── Validate and normalise ────────────────────────────────────────────────
  return batch.map((tx, i) => {
    const item = parsed[i] as Record<string, unknown> | undefined
    if (!item || typeof item !== 'object') return fallbackResult(tx.txHash)

    try {
      return {
        txHash: String(item.txHash ?? tx.txHash),
        taxCategory: validateTaxCategory(String(item.taxCategory ?? '402')),
        categoryLabel: String(item.categoryLabel ?? '미분류'),
        vatDeductible: Boolean(item.vatDeductible ?? false),
        expenseType: String(item.expenseType ?? '개인'),
        confidence: clamp(Number(item.confidence ?? 0), 0, 1),
        aiReason: String(item.aiReason ?? '').slice(0, 100),
        riskFlags: parseRiskFlags(item.riskFlags),
        receiptRequired: Boolean(item.receiptRequired ?? false),
        disclaimer: DISCLAIMER,
      }
    } catch {
      return fallbackResult(tx.txHash)
    }
  })
}

// ─── Utility helpers ──────────────────────────────────────────────────────────

function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = []
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size))
  return result
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, isNaN(n) ? min : n))
}

const VALID_TAX_CATEGORIES = new Set([
  '101','102','103',
  '201','202','203',
  '301','302','303','304','305','306','307','308','309','310','311',
  '401','402',
])

function validateTaxCategory(code: string): string {
  return VALID_TAX_CATEGORIES.has(code) ? code : '402'
}

const VALID_RISK_FLAGS = new Set([
  'receipt_required', 'review_needed', 'over_limit', 'withholding_required',
])

function parseRiskFlags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.map(String).filter((f) => VALID_RISK_FLAGS.has(f))
}
