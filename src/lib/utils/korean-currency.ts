/** Format as full KRW with commas: 1234567 → "1,234,567원" */
export function formatKRW(amount: number): string {
  const abs  = Math.abs(amount)
  const sign = amount < 0 ? '-' : ''
  return `${sign}${abs.toLocaleString('ko-KR')}원`
}

/** Short format: 12345678 → "1,234.6만원" | 1234 → "1,234원" */
export function formatKRWShort(amount: number): string {
  const abs  = Math.abs(amount)
  const sign = amount < 0 ? '-' : ''

  if (abs >= 100_000_000) {
    return `${sign}${(abs / 100_000_000).toFixed(1)}억원`
  }
  if (abs >= 10_000) {
    return `${sign}${(abs / 10_000).toFixed(1)}만원`
  }
  return `${sign}${abs.toLocaleString('ko-KR')}원`
}

/** Unit-based: 123_456_789 → "약 1.2억원" | 12_345_678 → "약 1,234.6만원" */
export function formatKRWToUnit(amount: number): string {
  const abs  = Math.abs(amount)
  const sign = amount < 0 ? '-' : ''
  const prefix = '약 '

  if (abs >= 100_000_000) {
    const eok = abs / 100_000_000
    return `${prefix}${sign}${eok.toFixed(1)}억원`
  }
  if (abs >= 10_000) {
    const man = abs / 10_000
    return `${prefix}${sign}${man.toFixed(1)}만원`
  }
  return `${sign}${abs.toLocaleString('ko-KR')}원`
}

// ─── Legacy exports kept for backward compatibility ────────────────────────

export function formatKoreanCurrency(amount: number): string {
  const abs  = Math.abs(amount)
  const sign = amount < 0 ? '-' : ''

  if (abs >= 100_000_000) {
    const eok = Math.floor(abs / 100_000_000)
    const man = Math.floor((abs % 100_000_000) / 10_000)
    if (man === 0) return `${sign}${eok}억원`
    return `${sign}${eok}억 ${man.toLocaleString('ko-KR')}만원`
  }

  if (abs >= 10_000) {
    const man  = Math.floor(abs / 10_000)
    const rest = abs % 10_000
    if (rest === 0) return `${sign}${man}만원`
    return `${sign}${man}만 ${rest.toLocaleString('ko-KR')}원`
  }

  return `${sign}${abs.toLocaleString('ko-KR')}원`
}

export function parseKoreanCurrency(str: string): number {
  return Number(str.replace(/[^0-9.-]/g, '')) || 0
}
