/**
 * Hometax XML Export
 * ─────────────────────────────────────────────────────────────────────────────
 * Generates XML matching the 홈택스 전자신고 표준 형식.
 *
 * Two entry points:
 *   generateVATXML     – Full VAT declaration document (부가세신고서)
 *   generateHometaxXml – Legacy transaction list XML (kept for reporter.ts)
 */

import type { VATCalculation, ReportPeriod } from '@/lib/tax/calculator'
import type { UserProfile } from '@/types/supabase'
import type { Transaction } from '@/types/transaction'

// ─── XML helpers ──────────────────────────────────────────────────────────────

function escXml(s: string | null | undefined): string {
  if (!s) return ''
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function tag(name: string, value: string | number | null | undefined, indent = 4): string {
  const pad = ' '.repeat(indent)
  return `${pad}<${name}>${escXml(String(value ?? ''))}</${name}>`
}

// ─── Public: VAT Declaration XML ──────────────────────────────────────────────

/**
 * Generate a VAT declaration XML document matching the 홈택스 부가세신고서 포맷.
 *
 * Disclaimer is always embedded inside <참고사항> so reviewers cannot miss it.
 */
export function generateVATXML(
  vatData: VATCalculation,
  userProfile: Pick<UserProfile, 'business_number' | 'business_name' | 'business_type' | 'full_name'>,
  period: ReportPeriod
): string {
  const now = new Date().toISOString()
  const quarterLabel = period.quarter
    ? `${period.year}년 ${period.quarter}기`
    : `${period.year}년`

  return `<?xml version="1.0" encoding="UTF-8"?>
<부가세신고서 xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 생성일시="${now}">
  <신고인정보>
${tag('사업자등록번호', userProfile.business_number)}
${tag('상호', userProfile.business_name)}
${tag('성명', userProfile.full_name)}
${tag('업종', userProfile.business_type)}
${tag('과세유형', vatData.isSimplified ? '간이과세자' : '일반과세자')}
  </신고인정보>
  <신고기간>
${tag('과세기간', quarterLabel)}
${tag('시작일', period.startDate)}
${tag('종료일', period.endDate)}
  </신고기간>
  <과세표준및세액>
    <매출세액>
${tag('과세매출액', vatData.taxableSales)}
${tag('매출세액', vatData.outputVAT)}
${tag('면세수입금액', vatData.taxFreeIncome)}
${tag('영세율매출액', vatData.zeroRatedSales)}
    </매출세액>
    <매입세액>
${tag('매입세액공제', vatData.deductibleInputVAT)}
${tag('불공제매입액', vatData.nonDeductibleInputVAT)}
    </매입세액>
    <납부세액>
${tag('납부할세액', vatData.vatPayable)}
${tag('부가세율', `${(vatData.vatRate * 100).toFixed(0)}%`)}
    </납부세액>
  </과세표준및세액>
  <참고사항>본 XML은 AI 생성 참고용입니다. 실제 신고 전 반드시 검토하세요. ⚠️ 본 서비스는 참고용 AI 코치입니다. 최종 신고는 사용자가 직접 또는 세무사와 함께 확인하세요. AI 판단은 법적 효력이 없습니다.</참고사항>
</부가세신고서>`
}

// ─── Legacy: transaction list XML (used by reporter.ts) ──────────────────────

/**
 * @deprecated Use generateVATXML for proper VAT declarations.
 *             This function is kept for backward compatibility with reporter.ts.
 */
export function generateHometaxXml(transactions: Transaction[], userId: string): string {
  const now = new Date().toISOString()

  const items = transactions
    .map((tx) => {
      const safe = escXml(tx.description)
      return `    <거래내역>
      <거래일자>${escXml(tx.date)}</거래일자>
      <적요>${safe}</적요>
      <금액>${tx.amount}</금액>
      <구분>${escXml(tx.category)}</구분>
    </거래내역>`
    })
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<홈택스거래내역신고 xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <신고자ID>${escXml(userId)}</신고자ID>
  <생성일시>${now}</생성일시>
  <거래내역목록>
${items}
  </거래내역목록>
  <참고사항>본 XML은 AI 생성 참고용입니다. 실제 신고 전 반드시 검토하세요.</참고사항>
</홈택스거래내역신고>`
}
