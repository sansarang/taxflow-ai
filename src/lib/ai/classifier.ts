/**
 * @file src/lib/ai/classifier.ts
 * @description TaxFlow AI — Transaction Classifier v7 Final
 *
 * ## 분류 파이프라인
 *  1. 각 거래에 대해 lookupPattern() 호출 (Tier A/B/C)
 *  2. 미해결 항목만 Claude tool_use 배치 호출
 *  3. tool_use index matching — position-based robust fallback
 *  4. 결과 sanitize + riskFlags 타입가드
 *  5. learnPattern() 으로 Redis 저장
 *
 * ## 법적 안전
 *  모든 외부 문자열은 "참고용", "가능성" 표현만 사용.
 */

import Anthropic from '@anthropic-ai/sdk'
import { lookupPattern, learnPattern, getSeasonalWeight } from './pattern-learner'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RawTransaction {
  id: string
  description: string
  amount: number
  date: string
  memo?: string
}

export interface ClassificationResult {
  transactionId: string
  category: string
  subCategory: string
  confidence: number
  isDeductible: boolean
  deductionRatio: number        // 0~1 (부분 공제 처리)
  riskFlags: string[]
  reasoning: string             // 항상 "[참고용]" 접두
  cacheSource: 'redis_vector' | 'vendor_dict' | 'tfidf' | 'claude'
  seasonalWeight: number
  vendor: string
}

interface ClaudeTool {
  name: 'classify_transaction'
  input: {
    transactionId: string
    category: string
    subCategory: string
    isDeductible: boolean
    deductionRatio: number
    confidence: number
    riskFlags: string[]
    reasoning: string
  }
}

// ─── Claude client singleton ──────────────────────────────────────────────────

let _anthropic: Anthropic | null = null

function getAnthropic(): Anthropic {
  if (!_anthropic) {
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  }
  return _anthropic
}

// ─── Tool definition ──────────────────────────────────────────────────────────

const CLASSIFY_TOOL: Anthropic.Tool = {
  name: 'classify_transaction',
  description: '한국 1인 크리에이터/프리랜서의 거래내역을 세금 목적으로 분류한다.',
  input_schema: {
    type: 'object' as const,
    properties: {
      transactionId: { type: 'string' },
      category: {
        type: 'string',
        enum: [
          '장비구입', '소프트웨어', '플랫폼수수료', '통신비', '교통비',
          '숙박비', '식비', '사무용품', '인건비', '마케팅비',
          '교육훈련비', '임차료', '보험료', '사업경비', '개인지출', '기타',
        ],
      },
      subCategory: { type: 'string' },
      isDeductible: { type: 'boolean' },
      deductionRatio: {
        type: 'number',
        description: '0~1. 업무용 비율. 식비/교통비 등 혼용은 0.5~0.8 권장(참고용)',
      },
      confidence: { type: 'number', description: '0~1' },
      riskFlags: {
        type: 'array',
        items: {
          type: 'string',
          enum: ['review_needed', 'high_amount', 'personal_mixed', 'missing_receipt', 'irregular_timing'],
        },
      },
      reasoning: {
        type: 'string',
        description: '반드시 "[참고용]"으로 시작. 공제 가능성 표현은 "~ 가능성 있음" 형태로만 작성.',
      },
    },
    required: ['transactionId', 'category', 'subCategory', 'isDeductible', 'deductionRatio', 'confidence', 'riskFlags', 'reasoning'],
  },
}

// ─── Sanitize ─────────────────────────────────────────────────────────────────

function sanitize(raw: ClaudeTool['input'], txId: string): ClassificationResult {
  const validCategories = [
    '장비구입', '소프트웨어', '플랫폼수수료', '통신비', '교통비',
    '숙박비', '식비', '사무용품', '인건비', '마케팅비',
    '교육훈련비', '임차료', '보험료', '사업경비', '개인지출', '기타',
  ]
  const validFlags = ['review_needed', 'high_amount', 'personal_mixed', 'missing_receipt', 'irregular_timing']

  const category = validCategories.includes(raw.category) ? raw.category : '기타'
  const confidence = typeof raw.confidence === 'number'
    ? Math.min(1, Math.max(0, raw.confidence))
    : 0.6
  const deductionRatio = typeof raw.deductionRatio === 'number'
    ? Math.min(1, Math.max(0, raw.deductionRatio))
    : (raw.isDeductible ? 1 : 0)
  const riskFlags = Array.isArray(raw.riskFlags)
    ? (raw.riskFlags as unknown[]).filter((f): f is string => validFlags.includes(f as string))
    : []
  const reasoning = typeof raw.reasoning === 'string' && raw.reasoning.startsWith('[참고용]')
    ? raw.reasoning
    : `[참고용] ${raw.reasoning ?? '자동 분류 결과입니다.'}`

  return {
    transactionId: txId,
    category,
    subCategory: raw.subCategory ?? '기타',
    confidence,
    isDeductible: Boolean(raw.isDeductible),
    deductionRatio,
    riskFlags,
    reasoning,
    cacheSource: 'claude',
    seasonalWeight: getSeasonalWeight(),
    vendor: '',
  }
}

// ─── Claude batch classify ────────────────────────────────────────────────────

async function claudeBatchClassify(
  transactions: RawTransaction[],
  businessType: string,
  isSimplifiedVat: boolean
): Promise<Map<string, ClassificationResult>> {
  const results = new Map<string, ClassificationResult>()
  if (!transactions.length) return results

  const t0 = performance.now()

  const systemPrompt = `
당신은 한국 세무 전문가 AI 어시스턴트입니다 (참고용).
업종: ${businessType} | 간이과세: ${isSimplifiedVat ? '예(4%)' : '아니오(10%)'}
모든 reasoning은 반드시 "[참고용]"으로 시작하고, 공제 여부는 "~ 가능성 있음" 표현만 사용하세요.
법적 확정 표현(반드시, 무조건, 확실히)은 절대 사용하지 마세요.
`.trim()

  const userContent = transactions
    .map((tx, i) =>
      `[${i}] ID:${tx.id} | ${tx.date} | ${tx.description} | ${tx.amount.toLocaleString()}원${tx.memo ? ` | 메모:${tx.memo}` : ''}`
    )
    .join('\n')

  let message: Anthropic.Message
  try {
    message = await getAnthropic().messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 4096,
      system: systemPrompt,
      tools: [CLASSIFY_TOOL],
      tool_choice: { type: 'any' },
      messages: [
        {
          role: 'user',
          content: `다음 거래내역을 각각 classify_transaction 툴로 분류해 주세요:\n${userContent}`,
        },
      ],
    })
  } catch (e) {
    console.error('[Classifier] Claude API 오류:', e)
    // 모든 항목에 기본값 반환
    for (const tx of transactions) {
      results.set(tx.id, {
        transactionId: tx.id,
        category: '기타',
        subCategory: '기타',
        confidence: 0.4,
        isDeductible: false,
        deductionRatio: 0,
        riskFlags: ['review_needed'],
        reasoning: '[참고용] API 오류로 자동 분류 실패. 직접 검토가 필요할 수 있습니다.',
        cacheSource: 'claude',
        seasonalWeight: getSeasonalWeight(),
        vendor: '',
      })
    }
    return results
  }

  // tool_use 블록 추출
  const toolUseBlocks = message.content.filter(
    (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === 'classify_transaction'
  )

  // position-based robust fallback:
  // Claude가 순서대로 tool_use를 반환하지 않을 수 있으므로
  // input.transactionId 우선, 없으면 position 매핑
  const usedPositions = new Set<number>()

  for (const block of toolUseBlocks) {
    const input = block.input as ClaudeTool['input']
    const txId = input.transactionId

    // transactionId로 직접 매핑
    if (txId && transactions.find(tx => tx.id === txId)) {
      results.set(txId, sanitize(input, txId))
      continue
    }

    // position-based fallback: 아직 사용되지 않은 인덱스 순서로 매핑
    for (let i = 0; i < transactions.length; i++) {
      if (!usedPositions.has(i) && !results.has(transactions[i].id)) {
        usedPositions.add(i)
        results.set(transactions[i].id, sanitize(input, transactions[i].id))
        break
      }
    }
  }

  // 미매핑 항목 기본값
  for (const tx of transactions) {
    if (!results.has(tx.id)) {
      results.set(tx.id, {
        transactionId: tx.id,
        category: '기타',
        subCategory: '기타',
        confidence: 0.45,
        isDeductible: false,
        deductionRatio: 0,
        riskFlags: ['review_needed'],
        reasoning: '[참고용] 자동 분류 결과가 없습니다. 직접 검토를 권장합니다.',
        cacheSource: 'claude',
        seasonalWeight: getSeasonalWeight(),
        vendor: '',
      })
    }
  }

  const elapsed = (performance.now() - t0).toFixed(0)
  console.info(`[Classifier] Claude batch ${transactions.length}건 완료 ${elapsed}ms`)

  return results
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * 거래내역 배열을 분류한다.
 * 캐시(Tier A/B/C) 히트 항목은 Claude를 호출하지 않는다.
 */
export async function classifyTransactions(
  transactions: RawTransaction[],
  businessType: string,
  isSimplifiedVat: boolean
): Promise<ClassificationResult[]> {
  const results: ClassificationResult[] = []
  const needsClaude: RawTransaction[] = []

  // Tier A/B/C 먼저 시도
  for (const tx of transactions) {
    const pattern = await lookupPattern(tx.description)
    if (pattern.cacheSource !== 'tfidf' || pattern.confidence >= 0.80) {
      results.push({
        transactionId: tx.id,
        category: pattern.category,
        subCategory: pattern.subCategory,
        confidence: pattern.confidence,
        isDeductible: pattern.isDeductible,
        deductionRatio: pattern.isDeductible ? 1 : 0,
        riskFlags: [],
        reasoning: '[참고용] 패턴 캐시에서 자동 분류되었습니다.',
        cacheSource: pattern.cacheSource,
        seasonalWeight: pattern.seasonalWeight,
        vendor: pattern.vendor,
      })
    } else {
      needsClaude.push(tx)
    }
  }

  // Claude 배치 호출
  if (needsClaude.length > 0) {
    const claudeResults = await claudeBatchClassify(needsClaude, businessType, isSimplifiedVat)

    for (const tx of needsClaude) {
      const res = claudeResults.get(tx.id)!
      results.push(res)
      // 높은 신뢰도 결과만 학습
      if (res.confidence >= 0.75) {
        learnPattern(tx.description, res.category, res.subCategory, res.isDeductible)
          .catch(e => console.warn('[Classifier] learnPattern 실패:', e))
      }
    }
  }

  // 원본 순서 유지
  const orderMap = new Map(transactions.map((tx, i) => [tx.id, i]))
  results.sort((a, b) => (orderMap.get(a.transactionId) ?? 0) - (orderMap.get(b.transactionId) ?? 0))

  return results
}