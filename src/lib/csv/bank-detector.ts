// ─── Bank identifiers ─────────────────────────────────────────────────────────

export type BankCode =
  | 'kb'       // KB국민은행
  | 'shinhan'  // 신한은행
  | 'woori'    // 우리은행
  | 'hana'     // 하나은행
  | 'ibk'      // IBK기업은행
  | 'nh'       // NH농협은행
  | 'kakao'    // 카카오뱅크
  | 'toss'     // 토스뱅크

export const BANK_DISPLAY_NAMES: Record<BankCode, string> = {
  kb:      'KB국민',
  shinhan: '신한',
  woori:   '우리',
  hana:    '하나',
  ibk:     'IBK기업',
  nh:      'NH농협',
  kakao:   '카카오뱅크',
  toss:    '토스뱅크',
}

// Every listed column must be present in the header row for the bank to match.
// More specific signatures are listed first to prevent false positives
// (e.g. NH and 하나 both have '거래구분' + '거래금액').
const BANK_SIGNATURES: Array<{ bank: BankCode; required: string[] }> = [
  {
    bank: 'kb',
    required: ['거래일자', '입금(원)', '출금(원)'],
  },
  {
    bank: 'shinhan',
    required: ['날짜', '찾으신금액', '맡기신금액'],
  },
  {
    bank: 'woori',
    required: ['거래일', '입금금액', '출금금액'],
  },
  {
    bank: 'ibk',
    // More specific: '내용' distinguishes IBK from NH which uses '거래내용'
    required: ['거래일자', '출금액', '입금액', '내용'],
  },
  {
    bank: 'nh',
    required: ['거래일자', '거래구분', '거래금액', '취급점'],
  },
  {
    bank: 'hana',
    // Checked after NH to avoid '거래구분'+'거래금액' ambiguity
    required: ['거래일자', '거래구분', '거래금액'],
  },
  {
    bank: 'kakao',
    required: ['거래일시', '거래유형', '거래금액'],
  },
  {
    bank: 'toss',
    required: ['날짜', '구분', '금액'],
  },
]

/**
 * Detect which Korean bank a CSV belongs to based on its header row.
 *
 * @param headers - Array of column names from the CSV header row.
 *                  Values are trimmed before comparison.
 * @returns The matching BankCode, or null if no bank matched.
 */
export function detectBank(headers: string[]): BankCode | null {
  const trimmed = headers.map((h) => h.trim())

  for (const { bank, required } of BANK_SIGNATURES) {
    const allPresent = required.every((col) =>
      trimmed.some((h) => h === col || h.includes(col))
    )
    if (allPresent) return bank
  }

  return null
}

/**
 * Return the Korean display name for a bank code, or the raw code if unknown.
 */
export function getBankDisplayName(bank: BankCode | string): string {
  return BANK_DISPLAY_NAMES[bank as BankCode] ?? bank
}
