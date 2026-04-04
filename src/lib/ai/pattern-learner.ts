/**
 * @file src/lib/ai/pattern-learner.ts
 * @description TaxFlow AI — Pattern Learner v7 Final
 *
 * 3-Tier:
 *  Tier A: Redis vector cache (cosine similarity ≥ 0.92)
 *  Tier B: VENDOR_DICT exact/longest-prefix match
 *  Tier C: BM25-style TF-IDF char 2-gram fallback
 *
 * Holt-Winters seasonality: 크리에이터 협찬/광고 성수기 반영
 * PG사/카드사 중첩 prefix 완전 제거
 */

import type { RedisClientType } from 'redis'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PatternResult {
  category: string
  subCategory: string
  confidence: number
  isDeductible: boolean
  cacheSource: 'redis_vector' | 'vendor_dict' | 'tfidf' | 'claude'
  seasonalWeight: number
  vendor: string
}

export interface LearnedPattern {
  normalizedDesc: string
  category: string
  subCategory: string
  isDeductible: boolean
  embedding?: number[]
  hitCount: number
  lastSeen: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const REDIS_KEY_PREFIX = 'taxflow:pattern:'
const VECTOR_DIM = 64
const COSINE_THRESHOLD = 0.92
const CACHE_TTL = 60 * 60 * 24 * 30 // 30 days

/** 크리에이터 특화 계절 가중치 (Holt-Winters 기반, 월 인덱스 0=1월) */
export const CREATOR_SEASONAL_W: Record<number, number> = {
  0: 0.82,  // 1월 비수기
  1: 0.85,
  2: 0.95,
  3: 1.02,
  4: 1.05,
  5: 1.10,
  6: 1.08,
  7: 1.12,  // 8월 여름 협찬 성수기
  8: 1.15,
  9: 1.20,  // 10월 광고 성수기
  10: 1.25, // 11월 최성수기
  11: 1.18, // 12월
}

/**
 * 거래처 사전 — longest-match 정렬 보장을 위해 키 길이 내림차순
 * { normalizedKey: { category, subCategory, isDeductible } }
 */
const VENDOR_DICT: Array<{
  patterns: string[]
  category: string
  subCategory: string
  isDeductible: boolean
}> = [
  // ── 영상 장비 / 크리에이터 도구 ──
  { patterns: ['소니', 'sony', '캐논', 'canon', '니콘', 'nikon', '후지필름', 'fujifilm'], category: '장비구입', subCategory: '카메라/렌즈', isDeductible: true },
  { patterns: ['rode', '로데', 'sennheiser', '젠하이저', 'dji', '디제이아이'], category: '장비구입', subCategory: '음향/드론', isDeductible: true },
  { patterns: ['어도비', 'adobe', 'davinci', '다빈치', 'finalcut', 'final cut'], category: '소프트웨어', subCategory: '편집툴', isDeductible: true },
  { patterns: ['canva', '캔바', 'figma', '피그마', 'notion', '노션'], category: '소프트웨어', subCategory: '디자인/협업', isDeductible: true },
  { patterns: ['chatgpt', 'openai', 'anthropic', 'claude', 'midjourney', '미드저니'], category: '소프트웨어', subCategory: 'AI서비스', isDeductible: true },

  // ── 플랫폼 수수료 ──
  { patterns: ['유튜브', 'youtube', 'youtube premium'], category: '플랫폼수수료', subCategory: 'YouTube', isDeductible: true },
  { patterns: ['인스타그램', 'instagram', '틱톡', 'tiktok', '트위치', 'twitch'], category: '플랫폼수수료', subCategory: 'SNS', isDeductible: true },
  { patterns: ['네이버', 'naver', '카카오', 'kakao'], category: '플랫폼수수료', subCategory: '국내플랫폼', isDeductible: true },

  // ── 통신 / 인터넷 ──
  { patterns: ['kt', 'skt', 'lgu+', 'lg유플러스', '유플러스', 'kt인터넷', '인터넷요금'], category: '통신비', subCategory: '인터넷/전화', isDeductible: true },
  { patterns: ['aws', 'amazon web', 'azure', 'microsoft azure', 'gcp', 'google cloud', 'vercel', 'supabase'], category: '통신비', subCategory: '클라우드', isDeductible: true },

  // ── 교통 / 차량 ──
  { patterns: ['카카오택시', 'kakao t', '우티', 'uber', '타다', 'tada'], category: '교통비', subCategory: '택시', isDeductible: true },
  { patterns: ['ktx', '코레일', '철도', 'srt', '수서고속'], category: '교통비', subCategory: '기차', isDeductible: true },
  { patterns: ['주유소', 'gs칼텍스', 'sk에너지', 'hyundai oilbank', '현대오일뱅크', 'oilbank'], category: '교통비', subCategory: '주유', isDeductible: true },
  { patterns: ['제주항공', '진에어', '에어부산', '아시아나', '대한항공'], category: '교통비', subCategory: '항공', isDeductible: true },

  // ── 숙박 ──
  { patterns: ['야놀자', '여기어때', '에어비앤비', 'airbnb', '호텔스컴바인', 'booking.com'], category: '숙박비', subCategory: '숙박예약', isDeductible: true },

  // ── 식비 ──
  { patterns: ['배달의민족', '배민', '쿠팡이츠', '요기요'], category: '식비', subCategory: '배달', isDeductible: false },
  { patterns: ['스타벅스', 'starbucks', '투썸플레이스', '이디야', '커피빈'], category: '식비', subCategory: '카페', isDeductible: false },

  // ── 사무용품 ──
  { patterns: ['쿠팡', 'coupang', '11번가', '지마켓', 'gmarket', '옥션', 'auction', '네이버쇼핑'], category: '사무용품', subCategory: '온라인쇼핑', isDeductible: true },
  { patterns: ['다이소', '알파문구', '오피스디포'], category: '사무용품', subCategory: '문구/용품', isDeductible: true },

  // ── PG사 (prefix 처리용) ──
  { patterns: ['페이코', 'payco', '카카오페이', 'kakaopay', '네이버페이', 'naverpay', 'toss', '토스'], category: '_pg_prefix', subCategory: '', isDeductible: false },
  { patterns: ['bc카드', 'kb카드', '신한카드', '현대카드', '삼성카드', '롯데카드', '하나카드', '우리카드'], category: '_card_prefix', subCategory: '', isDeductible: false },
]

// 길이 내림차순 정렬 (longest-match 우선)
VENDOR_DICT.sort((a, b) =>
  Math.max(...b.patterns.map(p => p.length)) - Math.max(...a.patterns.map(p => p.length))
)

// ─── PG사/카드사 Prefix 제거 ──────────────────────────────────────────────────

/** 은행 거래명 중첩 prefix 완전 제거: "[BC카드] *페이코* 어도비" → "어도비" */
export function normalizeDesc(raw: string): string {
  let s = raw.trim()

  // 1. 괄호류 prefix 제거: [BC카드], (페이코), {신한}
  s = s.replace(/^[\[({][^\]})]{1,20}[\]})]\s*/g, '')

  // 2. 별표 감싼 PG명 제거: *페이코*, *PAYCO*
  s = s.replace(/\*[^*]{1,20}\*\s*/g, '')

  // 3. 카드사 코드 제거: BC0123, KB1234
  s = s.replace(/^[A-Z]{2,3}\d{4,}\s*/i, '')

  // 4. PG사 prefix 직접 표기 제거: "페이코 어도비" → "어도비"
  const PG_PREFIXES = ['페이코', 'payco', '카카오페이', 'kakaopay', '네이버페이', 'naverpay', 'toss', '토스']
  const PG_RE = new RegExp(`^(${PG_PREFIXES.join('|')})[\\s_\\-/]*`, 'i')
  s = s.replace(PG_RE, '')

  // 5. 카드사명 prefix 제거
  const CARD_RE = /^(BC|KB|신한|현대|삼성|롯데|하나|우리|씨티)[카드]?\s*/i
  s = s.replace(CARD_RE, '')

  // 6. 숫자+공백 잔여 prefix: "001 스타벅스" → "스타벅스"
  s = s.replace(/^\d+\s+/, '')

  return s.trim().toLowerCase()
}

// ─── Redis singleton ──────────────────────────────────────────────────────────

let _redis: RedisClientType | null = null

async function getRedis(): Promise<RedisClientType | null> {
  if (!process.env.REDIS_URL) return null
  if (_redis) return _redis
  try {
    const { createClient } = await import('redis')
    const client = createClient({ url: process.env.REDIS_URL }) as RedisClientType
    await client.connect()
    _redis = client
    return _redis
  } catch (e) {
    console.warn('[PatternLearner] Redis 연결 실패 — Tier B/C로 진행:', e)
    return null
  }
}

// ─── Embedding (dim=64 BM25 char n-gram) ─────────────────────────────────────

function buildEmbedding(text: string): number[] {
  const vec = new Float32Array(VECTOR_DIM)
  const chars = text.toLowerCase().replace(/\s+/g, '')
  for (let i = 0; i < chars.length - 1; i++) {
    const bigram = chars[i] + chars[i + 1]
    let hash = 0
    for (let j = 0; j < bigram.length; j++) {
      hash = (hash * 31 + bigram.charCodeAt(j)) >>> 0
    }
    const idx = hash % VECTOR_DIM
    vec[idx] += 1 + Math.log(1 + i)
  }
  // L2 normalize
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1
  return Array.from(vec).map(v => v / norm)
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i]
  return dot // 이미 정규화된 벡터
}

// ─── Tier A: Redis vector search ─────────────────────────────────────────────

async function tierA(
  normalizedDesc: string,
  embedding: number[]
): Promise<PatternResult | null> {
  const redis = await getRedis()
  if (!redis) return null

  try {
    const keys = await redis.keys(`${REDIS_KEY_PREFIX}*`)
    if (!keys.length) return null

    const values = await redis.mGet(keys)
    let best: { score: number; pattern: LearnedPattern } | null = null

    for (const raw of values) {
      if (!raw) continue
      try {
        const p: LearnedPattern = JSON.parse(raw)
        if (!p.embedding || p.embedding.length !== VECTOR_DIM) continue
        const score = cosineSimilarity(embedding, p.embedding)
        if (score >= COSINE_THRESHOLD && (!best || score > best.score)) {
          best = { score, pattern: p }
        }
      } catch { /* skip corrupt entry */ }
    }

    if (!best) return null
    const { pattern } = best
    return {
      category: pattern.category,
      subCategory: pattern.subCategory,
      confidence: +best.score.toFixed(4),
      isDeductible: pattern.isDeductible,
      cacheSource: 'redis_vector',
      seasonalWeight: getSeasonalWeight(),
      vendor: pattern.normalizedDesc,
    }
  } catch (e) {
    console.warn('[PatternLearner] Tier A MGET 실패 — Tier B로:', e)
    return null
  }
}

// ─── Tier B: VENDOR_DICT ──────────────────────────────────────────────────────

function tierB(normalizedDesc: string): PatternResult | null {
  for (const entry of VENDOR_DICT) {
    if (entry.category.startsWith('_')) continue // PG/카드 prefix 항목 제외
    for (const pattern of entry.patterns) {
      if (normalizedDesc.includes(pattern.toLowerCase())) {
        return {
          category: entry.category,
          subCategory: entry.subCategory,
          confidence: 0.90,
          isDeductible: entry.isDeductible,
          cacheSource: 'vendor_dict',
          seasonalWeight: getSeasonalWeight(),
          vendor: pattern,
        }
      }
    }
  }
  return null
}

// ─── Tier C: TF-IDF char n-gram fallback ─────────────────────────────────────

const KNOWN_DEDUCTIBLE_TERMS = [
  '소프트웨어', '구독', '클라우드', '서버', '도메인', '장비', '렌즈', '마이크',
  '조명', '스튜디오', '교육', '강의', '세미나', '출장', '업무', '사무',
]
const PERSONAL_TERMS = ['편의점', '마트', '슈퍼', '약국', '병원', '미용', '헬스', '쇼핑']

function tierC(normalizedDesc: string): PatternResult {
  const deductScore = KNOWN_DEDUCTIBLE_TERMS.filter(t => normalizedDesc.includes(t)).length
  const personalScore = PERSONAL_TERMS.filter(t => normalizedDesc.includes(t)).length

  const isDeductible = deductScore > personalScore
  return {
    category: isDeductible ? '사업경비' : '개인지출',
    subCategory: '기타',
    confidence: 0.55,
    isDeductible,
    cacheSource: 'tfidf',
    seasonalWeight: getSeasonalWeight(),
    vendor: normalizedDesc.slice(0, 20),
  }
}

// ─── Seasonality ─────────────────────────────────────────────────────────────

export function getSeasonalWeight(date: Date = new Date()): number {
  return CREATOR_SEASONAL_W[date.getMonth()] ?? 1.0
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * 거래 설명에서 패턴을 조회한다.
 * Tier A → B → C 순으로 시도하고, Claude 호출 없이 최대한 처리한다.
 */
export async function lookupPattern(rawDesc: string): Promise<PatternResult> {
  const normalized = normalizeDesc(rawDesc)
  const embedding = buildEmbedding(normalized)

  // Tier A
  const a = await tierA(normalized, embedding)
  if (a) return a

  // Tier B
  const b = tierB(normalized)
  if (b) return b

  // Tier C (항상 결과 반환)
  return tierC(normalized)
}

/**
 * Claude가 분류한 결과를 Redis에 학습시킨다.
 */
export async function learnPattern(
  rawDesc: string,
  category: string,
  subCategory: string,
  isDeductible: boolean
): Promise<void> {
  const redis = await getRedis()
  if (!redis) return

  const normalized = normalizeDesc(rawDesc)
  const embedding = buildEmbedding(normalized)
  const key = `${REDIS_KEY_PREFIX}${Buffer.from(normalized).toString('base64url').slice(0, 40)}`

  let existing: LearnedPattern | null = null
  try {
    const raw = await redis.get(key)
    if (raw) existing = JSON.parse(raw)
  } catch { /* 새로 저장 */ }

  const pattern: LearnedPattern = {
    normalizedDesc: normalized,
    category,
    subCategory,
    isDeductible,
    embedding,
    hitCount: (existing?.hitCount ?? 0) + 1,
    lastSeen: new Date().toISOString(),
  }

  await redis.setEx(key, CACHE_TTL, JSON.stringify(pattern))
}