import type { Transaction } from '@/types/transaction'

export interface DeductionRule {
  id: string
  name: string
  description: string
  keywords: string[]
  maxAmount?: number
  rateLimit?: number
}

export const CREATOR_DEDUCTION_RULES: DeductionRule[] = [
  {
    id: 'equipment',
    name: '장비 구입비',
    description: '카메라, 마이크, 조명 등 촬영 장비',
    keywords: ['카메라', '렌즈', '마이크', '조명', '삼각대', '모니터', 'CPU', 'GPU'],
  },
  {
    id: 'software',
    name: '소프트웨어 구독료',
    description: '편집 소프트웨어, 클라우드 서비스',
    keywords: ['어도비', 'Adobe', '파이널컷', 'Premiere', 'AWS', 'Google Cloud', 'GitHub'],
  },
  {
    id: 'communication',
    name: '통신비',
    description: '인터넷, 휴대폰 요금 (업무 비율만큼)',
    keywords: ['KT', 'SKT', 'LG U+', '유플러스', '케이티', '인터넷'],
    rateLimit: 0.5,
  },
  {
    id: 'education',
    name: '교육비',
    description: '온라인 강의, 도서 구입',
    keywords: ['클래스101', '인프런', '유데미', 'Udemy', '교보문고', '예스24', '알라딘'],
  },
  {
    id: 'travel',
    name: '출장비',
    description: '취재 및 촬영 관련 교통비',
    keywords: ['KTX', '항공', '호텔', '숙박', '교통'],
  },
]

export function matchDeductionRule(description: string): DeductionRule | null {
  const lowerDesc = description.toLowerCase()
  return (
    CREATOR_DEDUCTION_RULES.find((rule) =>
      rule.keywords.some((kw) => lowerDesc.includes(kw.toLowerCase()))
    ) ?? null
  )
}

export function calculateDeductibleAmount(transaction: Transaction): number {
  const rule = matchDeductionRule(transaction.description)
  if (!rule) return 0
  const rate = rule.rateLimit ?? 1
  return Math.abs(transaction.amount) * rate
}
