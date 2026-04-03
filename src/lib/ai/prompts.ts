// ─── Shared disclaimer (appended to every AI response) ───────────────────────

export const DISCLAIMER =
  '⚠️ 본 서비스는 참고용 AI 코치입니다. 최종 신고는 사용자가 직접 또는 세무사와 함께 확인하세요. AI 판단은 법적 효력이 없습니다.'

// ─── Base system prompt ───────────────────────────────────────────────────────

export const SYSTEM_PROMPT_BASE = `
당신은 2026년 한국 세법 전문가입니다. 부가가치세법, 소득세법, 조세특례제한법 최신 기준으로만 판단합니다.
확실하지 않은 항목은 반드시 '세무사 확인 필요'라고 명시하세요.
절대 "이렇게 하면 세금 0원" 같은 과도한 절세 보장을 하지 마세요.
모든 응답 마지막에 반드시 다음 disclaimer를 포함하세요:
"${DISCLAIMER}"
항상 JSON 형식으로만 응답하고, JSON 외 텍스트는 절대 출력하지 마세요.
`.trim()

// ─── Creator deduction knowledge base ────────────────────────────────────────

export const CREATOR_DEDUCTIONS_CONTEXT = `
크리에이터·유튜버 업종 특화 공제 가능 항목 (2026년 기준):
- 장비비: 카메라, 렌즈, 조명, 마이크, 삼각대, 짐벌, 드론, 모니터, 태블릿 (업무 목적 입증 시 전액)
- 소프트웨어: Adobe CC, Final Cut Pro, DaVinci Resolve, CapCut Pro, Canva Pro (전액)
- 스튜디오: 임차료, 배경지, 소품 (사업 목적 100%)
- 광고비: 유튜브, 인스타, 네이버, 카카오 광고 (전액)
- 외주비: 편집자, 썸네일 디자이너, 작가 (전액, 원천징수 주의)
- 통신비: 업무용 인터넷·휴대폰 (혼용 시 50%)
- 콘텐츠 제작: 소품, 의상, 음악 라이선스, 효과음 구입비
`.trim()

// ─── Tax category codes ───────────────────────────────────────────────────────

export const TAX_CATEGORY_CODES = `
세금 카테고리 코드 (반드시 아래 코드 중 하나를 사용하세요):
매출:
  101 = 매출(과세)     102 = 매출(면세)     103 = 매출(영세율)
매입공제:
  201 = 매입공제       202 = 카드매입       203 = 현금영수증매입
인건비·임차:
  301 = 인건비         302 = 임차료
차량·접대·통신:
  303 = 차량유지비     304 = 접대비         306 = 통신비
마케팅·장비·소프트웨어:
  305 = 광고선전비     308 = 장비구입비(크리에이터)
  309 = 소프트웨어구독
콘텐츠 제작:
  307 = 소모품비       310 = 콘텐츠제작비   311 = 외주편집비
불공제·개인:
  401 = 불공제매입     402 = 개인지출(경비불인정)
`.trim()

// ─── Classification prompt builder ───────────────────────────────────────────

export function buildClassificationUserPrompt(
  transactions: Array<{ txHash: string; date: string; description: string; amount: number }>,
  userProfile: { businessType: string; isSimplifiedTax: boolean; annualRevenueTier: string }
): string {
  return `
사업자 정보:
- 업종: ${userProfile.businessType}
- 간이과세자: ${userProfile.isSimplifiedTax ? '예' : '아니오'}
- 연매출 구간: ${userProfile.annualRevenueTier}

다음 거래 내역 ${transactions.length}건을 세금 목적에 맞게 분류하세요.
각 거래에 대해 아래 JSON 배열을 그대로 채워서 반환하세요.

거래 내역:
${JSON.stringify(transactions, null, 2)}

응답 형식 (JSON 배열, 입력 거래 순서와 동일하게):
[
  {
    "txHash": "<원본 txHash 그대로>",
    "taxCategory": "<코드 101~402>",
    "categoryLabel": "<한국어 분류명>",
    "vatDeductible": <true|false>,
    "expenseType": "<필요경비|불공제|개인|매출>",
    "confidence": <0.0~1.0>,
    "aiReason": "<50자 이내 한국어 설명>",
    "riskFlags": ["receipt_required"|"review_needed"|"over_limit"|"withholding_required"],
    "receiptRequired": <true|false>,
    "disclaimer": "${DISCLAIMER}"
  }
]

중요:
- riskFlags는 빈 배열 []도 허용
- 확신이 없으면 confidence를 0.5 미만으로 설정하고 riskFlags에 "review_needed" 추가
- 접대비는 월 30만원/연 360만원 한도 초과 시 riskFlags에 "over_limit" 추가
- 외주비(인건비 지급 시)는 riskFlags에 "withholding_required" 추가
`.trim()
}

// ─── Optimization prompt builder ─────────────────────────────────────────────

export function buildOptimizationUserPrompt(summary: {
  businessType: string
  isSimplifiedTax: boolean
  totalIncome: number
  totalExpenseByCategory: Record<string, number>
  missingReceiptCount: number
  unclassifiedCount: number
  highAmountUnreviewed: number
  potentialMissedDeductions: string[]
}): string {
  return `
사업자 세금 최적화 분석을 수행하세요.

사업자 현황:
${JSON.stringify(summary, null, 2)}

다음 JSON 형식으로 응답하세요:
{
  "recommendations": [
    {
      "title": "<제목 (20자 이내)>",
      "description": "<상세 설명 (100자 이내)>",
      "actionItem": "<지금 당장 해야 할 행동>",
      "savingsImpact": <예상 절세 금액(원)>,
      "deadline": "<마감일 YYYY-MM-DD 또는 null>",
      "difficulty": "easy|medium|hard",
      "category": "<장비|소프트웨어|통신비|접대비|광고비|외주비|기타>"
    }
  ],
  "creatorSpecificAlerts": ["<크리에이터 특화 주의사항>"],
  "disclaimer": "${DISCLAIMER}"
}

추천은 최대 5개, 절세 효과 큰 순서로 정렬.
`.trim()
}

// ─── Report summary prompt builder ───────────────────────────────────────────

export function buildReportSummaryPrompt(reportData: {
  reportType: string
  period: string
  totalIncome: number
  totalExpense: number
  vatPayable: number
  estimatedTax: number
  riskScore: number
  topCategories: Array<{ label: string; amount: number }>
}): string {
  return `
다음 세금 신고 데이터에 대한 한국어 요약문을 작성하세요.

데이터:
${JSON.stringify(reportData, null, 2)}

다음 JSON 형식으로 응답하세요:
{
  "headline": "<1문장 요약 (50자 이내)>",
  "keyPoints": ["<핵심 포인트 1>", "<핵심 포인트 2>", "<핵심 포인트 3>"],
  "actionRequired": "<신고 전 반드시 할 일>",
  "disclaimer": "${DISCLAIMER}"
}
`.trim()
}

// ─── Weekly report prompt ─────────────────────────────────────────────────────

export const WEEKLY_REPORT_PROMPT = `
이번 주 거래 내역을 분석하여 한국어로 간결한 주간 세금 리포트를 작성하세요.
수입/지출 요약, 주요 공제 항목, 다음 주 주의사항을 포함하세요.
JSON 형식으로만 응답하고, JSON 외 텍스트는 절대 출력하지 마세요.
`.trim()
