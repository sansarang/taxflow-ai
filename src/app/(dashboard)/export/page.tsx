'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { AlertTriangle, FileSpreadsheet, FileCode, FileText, Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

// ─── Types ────────────────────────────────────────────────────────────────────

type ReportType = 'vat_q1' | 'vat_q2' | 'vat_q3' | 'vat_q4' | 'income_tax' | 'monthly'
type ExportFormat = 'csv' | 'xml' | 'pdf'

interface ExportResult {
  url: string
  format: ExportFormat
  period: string
  riskScore: number
  summary: {
    totalIncome: number
    totalExpense: number
    vatPayable: number
    estimatedTax: number
  }
}

// ─── Constants ────────────────────────────────────────────────────────────────

const REPORT_TYPES: { value: ReportType; label: string; description: string; badge: string }[] = [
  { value: 'vat_q1', label: '부가세 1기 예정신고', description: '1월~3월 거래내역', badge: 'VAT' },
  { value: 'vat_q2', label: '부가세 1기 확정신고', description: '1월~6월 거래내역', badge: 'VAT' },
  { value: 'vat_q3', label: '부가세 2기 예정신고', description: '7월~9월 거래내역', badge: 'VAT' },
  { value: 'vat_q4', label: '부가세 2기 확정신고', description: '7월~12월 거래내역', badge: 'VAT' },
  { value: 'income_tax', label: '종합소득세 확정신고', description: '1월~12월 연간 귀속 소득', badge: '소득세' },
  { value: 'monthly', label: '월별 리포트', description: '특정 월 거래내역 분석', badge: '월별' },
]

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2]
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)

function formatKRW(n: number): string {
  return Math.round(n).toLocaleString('ko-KR') + '원'
}

function riskBadgeVariant(score: number): 'destructive' | 'secondary' | 'default' {
  if (score >= 70) return 'destructive'
  if (score >= 40) return 'secondary'
  return 'default'
}

function riskLabel(score: number): string {
  if (score >= 70) return '높음'
  if (score >= 40) return '보통'
  return '낮음'
}

// ─── Format download card ─────────────────────────────────────────────────────

function FormatCard({
  format,
  icon: Icon,
  title,
  description,
  loading,
  resultUrl,
  onDownload,
}: {
  format: ExportFormat
  icon: React.ElementType
  title: string
  description: string
  loading: boolean
  resultUrl?: string
  onDownload: (format: ExportFormat) => void
}) {
  return (
    <Card className="relative overflow-hidden transition-shadow hover:shadow-md">
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          <div className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100">
            <Icon className="h-5 w-5 text-slate-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-slate-900">{title}</div>
            <div className="mt-0.5 text-sm text-slate-500">{description}</div>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <Button
            className="flex-1"
            variant={resultUrl ? 'default' : 'outline'}
            size="sm"
            disabled={loading}
            onClick={() => {
              if (resultUrl) {
                window.open(resultUrl, '_blank', 'noopener,noreferrer')
              } else {
                onDownload(format)
              }
            }}
          >
            {loading ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />생성 중…</>
            ) : resultUrl ? (
              <><Download className="mr-2 h-4 w-4" />다운로드</>
            ) : (
              `${format.toUpperCase()} 생성`
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Page component ───────────────────────────────────────────────────────────

export default function ExportPage() {
  const [reportType, setReportType] = useState<ReportType>('vat_q1')
  const [year, setYear] = useState<number>(CURRENT_YEAR)
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1)
  const [loading, setLoading] = useState<ExportFormat | null>(null)
  const [results, setResults] = useState<Partial<Record<ExportFormat, ExportResult>>>({})

  const selectedTypeInfo = REPORT_TYPES.find((t) => t.value === reportType)!
  const isMonthly = reportType === 'monthly'
  const latestResult = results['pdf'] ?? results['csv'] ?? results['xml']

  async function handleDownload(format: ExportFormat) {
    setLoading(format)
    try {
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportType,
          year,
          quarter: isMonthly ? month : undefined,
          format,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error ?? '내보내기에 실패했습니다')
        return
      }

      setResults((prev) => ({ ...prev, [format]: data }))
      toast.success(`${format.toUpperCase()} 파일이 생성되었습니다`)

      // Auto-open download
      window.open(data.url, '_blank', 'noopener,noreferrer')
    } catch (err) {
      toast.error('네트워크 오류가 발생했습니다')
      console.error(err)
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-0">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">홈택스 신고서 내보내기</h1>
        <p className="mt-1 text-sm text-slate-500">
          AI가 분류한 거래내역을 홈택스 업로드 형식으로 변환합니다.
        </p>
      </div>

      {/* ── Disclaimer banner ──────────────────────────────────────────────── */}
      <div className="rounded-lg border-2 border-red-300 bg-red-50 p-4">
        <div className="flex gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
          <div>
            <p className="font-semibold text-red-800">⚠️ 반드시 읽어보세요</p>
            <p className="mt-1 text-sm text-red-700 leading-relaxed">
              본 서비스는 <strong>참고용 AI 코치</strong>입니다. 생성된 파일은 AI가 자동 분류한
              결과이며, 오류가 있을 수 있습니다.{' '}
              <strong>실제 홈택스 신고 전 반드시 내용을 검토하고 세무사와 확인하세요.</strong>{' '}
              AI 판단은 법적 효력이 없으며, TaxFlow AI는 신고 오류로 인한 불이익에 책임을 지지
              않습니다.
            </p>
          </div>
        </div>
      </div>

      {/* ── Report configuration ───────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">신고서 설정</CardTitle>
          <CardDescription>신고 유형과 기간을 선택하세요</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Report type */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">신고 유형</label>
            <Select value={reportType} onValueChange={(v) => {
              setReportType(v as ReportType)
              setResults({})
            }}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REPORT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">{t.badge}</Badge>
                      <span>{t.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedTypeInfo && (
              <p className="text-xs text-slate-500">{selectedTypeInfo.description}</p>
            )}
          </div>

          {/* Year + optional month */}
          <div className={`grid gap-3 ${isMonthly ? 'grid-cols-2' : 'grid-cols-1 max-w-xs'}`}>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">귀속 연도</label>
              <Select
                value={String(year)}
                onValueChange={(v) => { setYear(Number(v)); setResults({}) }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {YEARS.map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}년</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {isMonthly && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">월</label>
                <Select
                  value={String(month)}
                  onValueChange={(v) => { setMonth(Number(v)); setResults({}) }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m) => (
                      <SelectItem key={m} value={String(m)}>{m}월</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Download format cards ──────────────────────────────────────────── */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-slate-700">내보내기 형식 선택</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <FormatCard
            format="csv"
            icon={FileSpreadsheet}
            title="CSV 파일"
            description="엑셀에서 편집 가능한 거래내역 파일"
            loading={loading === 'csv'}
            resultUrl={results.csv?.url}
            onDownload={handleDownload}
          />
          <FormatCard
            format="xml"
            icon={FileCode}
            title="XML 파일"
            description="홈택스 전자신고 업로드용 XML"
            loading={loading === 'xml'}
            resultUrl={results.xml?.url}
            onDownload={handleDownload}
          />
          <FormatCard
            format="pdf"
            icon={FileText}
            title="PDF 리포트"
            description="세무사 제출용 종합 분석 보고서"
            loading={loading === 'pdf'}
            resultUrl={results.pdf?.url}
            onDownload={handleDownload}
          />
        </div>
      </div>

      {/* ── Preview / result summary ───────────────────────────────────────── */}
      {latestResult && (
        <>
          <Separator />
          <Card className="border-blue-200 bg-blue-50/50">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm text-blue-800">
                  {latestResult.period} 분석 결과
                </CardTitle>
                <Badge variant={riskBadgeVariant(latestResult.riskScore)}>
                  리스크 {latestResult.riskScore}점 ({riskLabel(latestResult.riskScore)})
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {([
                  { label: '총 수입', value: latestResult.summary.totalIncome },
                  { label: '총 지출', value: latestResult.summary.totalExpense },
                  { label: '부가세 납부액', value: latestResult.summary.vatPayable },
                  { label: '예상 소득세', value: latestResult.summary.estimatedTax },
                ] as const).map(({ label, value }) => (
                  <div key={label} className="rounded-lg bg-white p-3 shadow-sm">
                    <div className="text-xs text-slate-500">{label}</div>
                    <div className="mt-1 text-sm font-semibold text-slate-900">
                      {formatKRW(value)}
                    </div>
                  </div>
                ))}
              </div>

              <p className="mt-3 text-xs text-slate-500 leading-relaxed">
                위 수치는 AI가 계산한 추정값입니다. 실제 신고액과 다를 수 있으며, 반드시 세무사
                검토 후 최종 신고하시기 바랍니다.
              </p>
            </CardContent>
          </Card>
        </>
      )}

      {/* ── Filing guide ──────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">홈택스 신고 방법</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-2 text-sm text-slate-600 list-decimal list-inside">
            <li>
              <a
                href="https://www.hometax.go.kr"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline hover:text-blue-800"
              >
                국세청 홈택스(hometax.go.kr)
              </a>{' '}
              접속 → 로그인
            </li>
            <li>신고/납부 → 부가가치세 또는 종합소득세 선택</li>
            <li>TaxFlow AI에서 내보낸 CSV/XML 파일을 업로드</li>
            <li>내용 검토 및 수정 후 최종 제출</li>
            <li>납부할 세금이 있는 경우 기한 내 납부</li>
          </ol>
          <p className="mt-3 rounded-md bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
            💡 <strong>팁:</strong> XML 파일은 홈택스에서 직접 업로드 가능하며, CSV 파일은
            검토 및 세무사 제출용으로 활용하세요.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
