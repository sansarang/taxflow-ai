/**
 * PDF Report Generator
 * ─────────────────────────────────────────────────────────────────────────────
 * Generates a monthly optimization report PDF using jsPDF + jspdf-autotable.
 *
 * ⚠️  Korean font note:
 *   jsPDF's built-in fonts do not include Korean glyphs.
 *   For production rendering of Korean text, embed NanumGothic or Noto Sans KR:
 *
 *     import { NanumGothicBase64 } from '@/lib/fonts/nanum-gothic-base64'
 *     doc.addFileToVFS('NanumGothic.ttf', NanumGothicBase64)
 *     doc.addFont('NanumGothic.ttf', 'NanumGothic', 'normal')
 *     doc.setFont('NanumGothic')
 *
 *   Until then, Korean strings are included in the data and will render
 *   correctly once the font is embedded.
 *
 * Pages:
 *   1. Summary — KPI table, risk score gauge, period
 *   2. Top optimizations — recommendations table
 *   3. Top expense categories — category table
 *   4. Disclaimer — full legal disclaimer page
 */

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatKoreanCurrency } from '@/lib/utils/korean-currency'
import type { TaxReportData } from '@/lib/ai/reporter'
import type { DeductionOptimizerResult } from '@/lib/ai/optimizer'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PDFReportOptions {
  reportData: TaxReportData
  optimizerResult?: DeductionOptimizerResult
  userName: string
  businessName?: string
}

// ─── Colours & layout constants ───────────────────────────────────────────────

const BRAND = {
  navy: [15, 23, 42] as [number, number, number],
  blue: [37, 99, 235] as [number, number, number],
  slate: [100, 116, 139] as [number, number, number],
  light: [248, 250, 252] as [number, number, number],
  green: [22, 163, 74] as [number, number, number],
  red: [220, 38, 38] as [number, number, number],
  amber: [217, 119, 6] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
}

const PAGE_W = 210   // A4 mm
const PAGE_H = 297
const MARGIN = 14

// ─── Helpers ──────────────────────────────────────────────────────────────────

function riskColor(score: number): [number, number, number] {
  if (score >= 70) return BRAND.red
  if (score >= 40) return BRAND.amber
  return BRAND.green
}

function riskLabel(score: number): string {
  if (score >= 70) return '높음 (HIGH)'
  if (score >= 40) return '보통 (MEDIUM)'
  return '낮음 (LOW)'
}

/** Draw the branded header bar on the current page. */
function drawHeader(doc: jsPDF, title: string): void {
  // Dark background strip
  doc.setFillColor(...BRAND.navy)
  doc.rect(0, 0, PAGE_W, 20, 'F')

  // Logo text
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(...BRAND.white)
  doc.text('TaxFlow AI', MARGIN, 13)

  // Blue accent square
  doc.setFillColor(...BRAND.blue)
  doc.rect(PAGE_W - MARGIN - 3, 5, 3, 10, 'F')

  // Page title
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(148, 163, 184)
  doc.text(title, PAGE_W - MARGIN, 13, { align: 'right' })

  doc.setTextColor(0, 0, 0) // reset
}

/** Draw a small footer on the current page. */
function drawFooter(doc: jsPDF, pageNum: number, totalPages: number): void {
  const y = PAGE_H - 8
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...BRAND.slate)
  doc.text(
    'TaxFlow AI - AI generated reference report. Verify before filing.',
    MARGIN,
    y
  )
  doc.text(`${pageNum} / ${totalPages}`, PAGE_W - MARGIN, y, { align: 'right' })
  doc.setTextColor(0, 0, 0)
}

/** Draw a risk score "badge" box. */
function drawRiskBadge(doc: jsPDF, score: number, x: number, y: number): void {
  const color = riskColor(score)
  const label = riskLabel(score)
  const boxW = 60
  const boxH = 22

  doc.setFillColor(...color)
  doc.roundedRect(x, y, boxW, boxH, 3, 3, 'F')

  doc.setTextColor(...BRAND.white)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.text(String(score), x + boxW / 2, y + 13, { align: 'center' })

  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.text(label, x + boxW / 2, y + 20, { align: 'center' })

  doc.setTextColor(0, 0, 0)
}

// ─── Page builders ────────────────────────────────────────────────────────────

function buildSummaryPage(doc: jsPDF, opts: PDFReportOptions): void {
  const { reportData, userName, businessName } = opts
  drawHeader(doc, '세금 리포트 요약')

  let y = 28

  // Report meta info
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...BRAND.navy)
  doc.text(`${reportData.period} - Monthly Optimization Report`, MARGIN, y)
  y += 7

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...BRAND.slate)
  doc.text(`${userName}${businessName ? ` / ${businessName}` : ''}`, MARGIN, y)
  doc.text(`Generated: ${new Date().toLocaleDateString('ko-KR')}`, PAGE_W - MARGIN, y, {
    align: 'right',
  })
  y += 8

  // Divider
  doc.setDrawColor(...BRAND.slate)
  doc.setLineWidth(0.3)
  doc.line(MARGIN, y, PAGE_W - MARGIN, y)
  y += 6

  // ── KPI summary table ─────────────────────────────────────────────────────
  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head: [['항목 (Item)', '금액 (Amount)']],
    body: [
      ['총 수입 (Gross Income)',          formatKoreanCurrency(reportData.totalIncome)],
      ['총 지출 (Total Expenses)',         formatKoreanCurrency(reportData.totalExpense)],
      ['부가세 납부 (VAT Payable)',        formatKoreanCurrency(reportData.vatPayable)],
      ['예상 소득세 (Est. Income Tax)',    formatKoreanCurrency(reportData.estimatedTax)],
      ['실효세율 (Effective Rate)',        `${(reportData.effectiveRate * 100).toFixed(1)}%`],
    ],
    headStyles: {
      fillColor: BRAND.navy,
      textColor: BRAND.white,
      fontStyle: 'bold',
      fontSize: 10,
    },
    bodyStyles: { fontSize: 10, cellPadding: 4 },
    alternateRowStyles: { fillColor: BRAND.light },
    columnStyles: { 1: { halign: 'right' } },
  })

  const afterTable =
    (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10

  // ── Risk score badge ──────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...BRAND.navy)
  doc.text('리스크 점수 (Risk Score)', MARGIN, afterTable)

  drawRiskBadge(doc, reportData.riskScore, MARGIN, afterTable + 4)

  // Risk interpretation
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...BRAND.slate)
  const riskExplanation = [
    '0-39:  낮음 - 세무 리스크 낮음. 현상 유지 권장.',
    '40-69: 보통 - 일부 영수증 첨부 및 분류 검토 필요.',
    '70+:   높음 - 즉각적인 세무사 검토 강력 권장.',
  ]
  let riskY = afterTable + 5
  for (const line of riskExplanation) {
    doc.text(line, MARGIN + 68, riskY)
    riskY += 6
  }

  // ── AI Summary ────────────────────────────────────────────────────────────
  const summaryY = afterTable + 36
  doc.setDrawColor(...BRAND.blue)
  doc.setFillColor(239, 246, 255)
  doc.setLineWidth(0.5)
  doc.rect(MARGIN, summaryY, PAGE_W - MARGIN * 2, 28, 'FD')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...BRAND.blue)
  doc.text('AI 분석 요약', MARGIN + 3, summaryY + 6)

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...BRAND.navy)
  doc.setFontSize(9)
  const headline = doc.splitTextToSize(reportData.summary.headline, PAGE_W - MARGIN * 2 - 6)
  doc.text(headline, MARGIN + 3, summaryY + 13)

  if (reportData.summary.actionRequired) {
    doc.setTextColor(...BRAND.red)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text(
      `조치 필요: ${reportData.summary.actionRequired}`,
      MARGIN + 3,
      summaryY + 25
    )
  }
  doc.setTextColor(0, 0, 0)
}

function buildOptimizationsPage(
  doc: jsPDF,
  opts: PDFReportOptions
): void {
  const { reportData, optimizerResult } = opts
  doc.addPage()
  drawHeader(doc, '절세 최적화 권고')

  let y = 28

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(...BRAND.navy)
  doc.text('TOP 5 절세 최적화 권고사항', MARGIN, y)
  y += 8

  const recommendations = optimizerResult?.recommendations ?? []
  const topRecs = recommendations.slice(0, 5)

  if (topRecs.length === 0) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(...BRAND.slate)
    doc.text('분석된 최적화 권고사항이 없습니다.', MARGIN, y)
  } else {
    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      head: [['#', '절세 권고사항']],
      body: (topRecs as string[]).map((r: string, i: number) => [i + 1, r]),
      headStyles: {
        fillColor: BRAND.blue,
        textColor: BRAND.white,
        fontStyle: 'bold',
        fontSize: 9,
      },
      bodyStyles: { fontSize: 9, cellPadding: 3 },
      alternateRowStyles: { fillColor: BRAND.light },
      columnStyles: {
        0: { cellWidth: 8, halign: 'center' },
        1: { cellWidth: 160 },
      },
    })
  }

  // ── Creator-specific alerts ────────────────────────────────────────────────
  const creatorAlerts = (optimizerResult?.anomalyAlerts ?? []).map((a: any) => a.message ?? '')
  if (creatorAlerts.length > 0) {
    const afterRecs =
      (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY ?? y + 40
    const alertsY = afterRecs + 10

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(...BRAND.navy)
    doc.text('이상 거래 알림', MARGIN, alertsY)

    autoTable(doc, {
      startY: alertsY + 5,
      margin: { left: MARGIN, right: MARGIN },
      head: [['알림 내용']],
      body: creatorAlerts.slice(0, 5).map((a: string) => [a]),
      headStyles: {
        fillColor: BRAND.amber,
        textColor: BRAND.white,
        fontStyle: 'bold',
        fontSize: 9,
      },
      bodyStyles: { fontSize: 9, cellPadding: 3 },
    })
  }

  // ── Key points from AI summary ──────────────────────────────────────────
  const keyPoints = reportData.summary.keyPoints
  if (keyPoints.length > 0) {
    const lastTable =
      (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY ?? y + 60
    const kpY = lastTable + 10

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...BRAND.navy)
    doc.text('AI 핵심 포인트', MARGIN, kpY)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...BRAND.navy)
    keyPoints.slice(0, 5).forEach((pt, i) => {
      doc.text(`${i + 1}. ${pt}`, MARGIN + 4, kpY + 7 + i * 6)
    })
  }
}

function buildCategoriesPage(doc: jsPDF, opts: PDFReportOptions): void {
  doc.addPage()
  drawHeader(doc, '지출 분석')

  let y = 28

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(...BRAND.navy)
  doc.text('지출 카테고리 분석', MARGIN, y)
  y += 8

  const { topCategories } = opts.reportData
  const total = topCategories.reduce((s, c) => s + c.amount, 0)

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head: [['카테고리', '금액', '비율', '그래프']],
    body: topCategories.map((c) => {
      const pct = total > 0 ? (c.amount / total) * 100 : 0
      const bar = '█'.repeat(Math.round(pct / 5))
      return [c.label, formatKoreanCurrency(c.amount), `${pct.toFixed(1)}%`, bar]
    }),
    headStyles: {
      fillColor: BRAND.navy,
      textColor: BRAND.white,
      fontStyle: 'bold',
      fontSize: 10,
    },
    bodyStyles: { fontSize: 10, cellPadding: 4 },
    alternateRowStyles: { fillColor: BRAND.light },
    columnStyles: {
      1: { halign: 'right' },
      2: { halign: 'right', cellWidth: 20 },
      3: { textColor: BRAND.blue },
    },
  })

  // Deductions map
  const deductions = opts.reportData.deductions
  if (Object.keys(deductions).length > 0) {
    const afterCats =
      (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(...BRAND.navy)
    doc.text('필요경비 공제 내역', MARGIN, afterCats)

    const dedRows = Object.entries(deductions).map(([code, amount]) => [
      code,
      formatKoreanCurrency(amount),
    ])

    autoTable(doc, {
      startY: afterCats + 5,
      margin: { left: MARGIN, right: MARGIN },
      head: [['세금코드', '금액']],
      body: dedRows,
      headStyles: {
        fillColor: BRAND.green,
        textColor: BRAND.white,
        fontStyle: 'bold',
        fontSize: 9,
      },
      bodyStyles: { fontSize: 9 },
      columnStyles: { 1: { halign: 'right' } },
    })
  }
}

function buildDisclaimerPage(doc: jsPDF): void {
  doc.addPage()
  drawHeader(doc, '법적 고지사항')

  const y = 30

  // Red warning box
  doc.setFillColor(254, 242, 242)
  doc.setDrawColor(...BRAND.red)
  doc.setLineWidth(1)
  doc.roundedRect(MARGIN, y, PAGE_W - MARGIN * 2, 40, 4, 4, 'FD')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(...BRAND.red)
  doc.text('⚠  법적 고지사항 (LEGAL DISCLAIMER)', MARGIN + 6, y + 10)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(185, 28, 28)
  const disclaimerText =
    '본 서비스는 참고용 AI 코치입니다. 최종 신고는 사용자가 직접 또는 세무사와 함께 확인하세요.\n' +
    'AI 판단은 법적 효력이 없습니다. This AI-generated report is for informational purposes only.'
  const lines = doc.splitTextToSize(disclaimerText, PAGE_W - MARGIN * 2 - 12)
  doc.text(lines, MARGIN + 6, y + 19)

  doc.setTextColor(0, 0, 0)

  // Extended disclaimer
  const bodyY = y + 50
  const sections = [
    {
      title: '1. 정보의 정확성',
      body: 'TaxFlow AI가 제공하는 세금 계산 및 분류 결과는 AI 알고리즘에 의해 생성된 추정치입니다. 실제 세무 신고에 사용하기 전에 공인 세무사 또는 국세청 홈택스를 통해 반드시 검증하시기 바랍니다.',
    },
    {
      title: '2. 세법 변경',
      body: '한국 세법은 매년 개정될 수 있습니다. 본 서비스는 2026년 기준 세법을 반영하고 있으나, 최신 세법 개정 사항을 반드시 확인하시기 바랍니다.',
    },
    {
      title: '3. 책임 제한',
      body: 'TaxFlow AI는 본 보고서를 기반으로 한 세무 신고로 인해 발생하는 어떠한 불이익, 가산세, 법적 책임에 대해 책임을 지지 않습니다.',
    },
    {
      title: '4. 전문가 상담 권장',
      body: '연간 수입이 1억원 이상이거나, 사업 구조가 복잡하거나, 세무조사 대상이 된 경우에는 반드시 공인 세무사와 상담하시기 바랍니다.',
    },
  ]

  let sectionY = bodyY
  for (const section of sections) {
    if (sectionY > PAGE_H - 30) break

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...BRAND.navy)
    doc.text(section.title, MARGIN, sectionY)
    sectionY += 5

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...BRAND.slate)
    const bodyLines = doc.splitTextToSize(section.body, PAGE_W - MARGIN * 2)
    doc.text(bodyLines, MARGIN, sectionY)
    sectionY += bodyLines.length * 5 + 6
  }

  // Signature line
  const sigY = PAGE_H - 25
  doc.setDrawColor(...BRAND.slate)
  doc.setLineWidth(0.3)
  doc.line(MARGIN, sigY, PAGE_W / 2 - 10, sigY)
  doc.setFontSize(8)
  doc.setTextColor(...BRAND.slate)
  doc.text('사용자 확인 서명', MARGIN, sigY + 5)
  doc.line(PAGE_W / 2 + 10, sigY, PAGE_W - MARGIN, sigY)
  doc.text('세무사 검토 서명', PAGE_W / 2 + 10, sigY + 5)
  doc.setTextColor(0, 0, 0)
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Generate a full monthly optimization report PDF.
 *
 * Pages: Summary → Optimizations → Categories → Disclaimer
 *
 * @returns jsPDF instance — call `.output('arraybuffer')` to get bytes for upload
 */
export function generateOptimizationPDF(opts: PDFReportOptions): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const TOTAL_PAGES = 4

  buildSummaryPage(doc, opts)
  drawFooter(doc, 1, TOTAL_PAGES)

  buildOptimizationsPage(doc, opts)
  drawFooter(doc, 2, TOTAL_PAGES)

  buildCategoriesPage(doc, opts)
  drawFooter(doc, 3, TOTAL_PAGES)

  buildDisclaimerPage(doc)
  drawFooter(doc, 4, TOTAL_PAGES)

  return doc
}

// ─── Backward-compat export ───────────────────────────────────────────────────

import type { TaxSummary } from '@/types/tax'
import type { Transaction } from '@/types/transaction'

/** @deprecated Use generateOptimizationPDF() instead. */
export function generatePdfReport(
  transactions: Transaction[],
  taxSummary: TaxSummary,
  userName: string
): jsPDF {
  const doc = new jsPDF()

  doc.setFontSize(20)
  doc.text('TaxFlow AI - Tax Analysis Report', MARGIN, 22)

  doc.setFontSize(11)
  doc.setTextColor(100, 100, 100)
  doc.text(`Generated: ${new Date().toLocaleDateString('ko-KR')}`, MARGIN, 30)
  doc.text(`User: ${userName}`, MARGIN, 37)

  doc.setFontSize(14)
  doc.setTextColor(0, 0, 0)
  doc.text('Tax Summary', MARGIN, 50)

  autoTable(doc, {
    startY: 55,
    head: [['Item', 'Amount']],
    body: [
      ['Total Income',    formatKoreanCurrency(taxSummary.totalIncome)],
      ['Total Deductible', formatKoreanCurrency(taxSummary.totalDeductible)],
      ['Taxable Income',  formatKoreanCurrency(taxSummary.taxableIncome)],
      ['Estimated Tax',   formatKoreanCurrency(taxSummary.estimatedTax)],
    ],
  })

  const finalY =
    (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10
  doc.text('Transactions', MARGIN, finalY)

  autoTable(doc, {
    startY: finalY + 5,
    head: [['Date', 'Description', 'Category', 'Amount']],
    body: transactions.slice(0, 50).map((tx) => [
      tx.date,
      tx.description.slice(0, 30),
      tx.category,
      formatKoreanCurrency(tx.amount),
    ]),
  })

  return doc
}
