'use client'

import { useEffect, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { AlertTriangle, Info } from 'lucide-react'

// ─── Tax brackets (2026) ──────────────────────────────────────────────────────

const BRACKETS = [
  { min: 0,           max: 14_000_000,   rate: 0.06, ded: 0           },
  { min: 14_000_000,  max: 50_000_000,   rate: 0.15, ded: 1_260_000   },
  { min: 50_000_000,  max: 88_000_000,   rate: 0.24, ded: 5_760_000   },
  { min: 88_000_000,  max: 150_000_000,  rate: 0.35, ded: 15_440_000  },
  { min: 150_000_000, max: 300_000_000,  rate: 0.38, ded: 19_940_000  },
  { min: 300_000_000, max: 500_000_000,  rate: 0.40, ded: 25_940_000  },
  { min: 500_000_000, max: Infinity,     rate: 0.42, ded: 35_940_000  },
]

// ─── Utilities ────────────────────────────────────────────────────────────────

function calcIncomeTax(net: number): number {
  if (net <= 0) return 0
  const bracket = [...BRACKETS].reverse().find((b) => net > b.min) ?? BRACKETS[0]
  const base = Math.max(0, net * bracket.rate - bracket.ded)
  // 20% SME reduction for creators (소득 3억 이하)
  const reduction = net <= 300_000_000 ? base * 0.20 : 0
  const incomeTax = base - reduction
  const localTax  = incomeTax * 0.10
  return Math.round(incomeTax + localTax)
}

function fmt(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1_0000_0000) return `${(abs / 1_0000_0000).toFixed(1)}억원`
  if (abs >= 10_000) {
    const man = Math.floor(abs / 10_000)
    const rest = abs % 10_000
    return rest === 0 ? `${man}만원` : `${man}만 ${rest.toLocaleString('ko-KR')}원`
  }
  return `${abs.toLocaleString('ko-KR')}원`
}

function parseNumber(val: string): number {
  return Math.max(0, Number(val.replace(/[^0-9]/g, '')) || 0)
}

// ─── Donut chart (CSS conic-gradient, no library) ─────────────────────────────

interface DonutProps {
  vatPct:      number   // 0–100
  incomePct:   number
  netPct:      number
}

function DonutChart({ vatPct, incomePct, netPct }: DonutProps) {
  const v = Math.min(100, Math.max(0, vatPct))
  const i = Math.min(100 - v, Math.max(0, incomePct))
  const n = 100 - v - i

  const gradient = `conic-gradient(
    #ef4444 0% ${v}%,
    #f97316 ${v}% ${v + i}%,
    #22c55e ${v + i}% ${v + i + n}%,
    #e2e8f0 ${v + i + n}% 100%
  )`

  return (
    <div className="relative flex items-center justify-center">
      <div
        className="h-36 w-36 rounded-full"
        style={{ background: gradient }}
      />
      {/* Hole */}
      <div className="absolute h-20 w-20 rounded-full bg-white flex items-center justify-center">
        <span className="text-[10px] text-slate-500 text-center leading-tight font-medium">
          세금<br />분석
        </span>
      </div>
    </div>
  )
}

// ─── Burnout bar ──────────────────────────────────────────────────────────────

function BurnoutBar({ hours }: { hours: number }) {
  const pct   = Math.min(100, (hours / 80) * 100)
  const level = hours > 60 ? 'danger' : hours >= 45 ? 'warning' : 'safe'
  const colors: Record<string, { bar: string; text: string; label: string }> = {
    danger:  { bar: 'bg-red-500',   text: 'text-red-600',   label: '위험' },
    warning: { bar: 'bg-amber-400', text: 'text-amber-600', label: '주의' },
    safe:    { bar: 'bg-green-500', text: 'text-green-600', label: '안전' },
  }
  const c = colors[level]

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-600">번아웃 위험도</span>
        <span className={`font-semibold ${c.text}`}>{c.label} ({hours}시간/주)</span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-all duration-500 ${c.bar}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

// ─── Form type ────────────────────────────────────────────────────────────────

interface SimForm {
  monthlyIncome:  string
  weeklyHours:    string
  monthlyExpense: string
  jobType:        string
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const JOB_TYPES = [
  { value: 'creator',   label: '유튜버/크리에이터' },
  { value: 'designer',  label: '프리랜서 디자이너'  },
  { value: 'writer',    label: '작가/번역가'         },
  { value: 'developer', label: '프리랜서 개발자'     },
]

export default function SimulatorPage() {
  const { register, control, setValue, watch } = useForm<SimForm>({
    defaultValues: {
      monthlyIncome:  '',
      weeklyHours:    '40',
      monthlyExpense: '',
      jobType:        'creator',
    },
  })

  const values    = watch()
  const hours     = Number(values.weeklyHours) || 0
  const income    = parseNumber(values.monthlyIncome)
  const expense   = parseNumber(values.monthlyExpense)
  const jobType   = values.jobType

  // ── Calculations ──────────────────────────────────────────────────────────

  const annualIncome   = income * 12
  const annualExpense  = expense * 12

  // VAT (monthly)
  const vatPayable     = Math.max(0, income * 0.1 - expense * 0.1)
  const annualVAT      = vatPayable * 12

  // Income tax (annual net)
  const netAnnual      = Math.max(0, annualIncome - annualExpense - 1_500_000)
  const annualIncomeTax = calcIncomeTax(netAnnual)
  const monthlyIncomeTax = Math.round(annualIncomeTax / 12)

  const netMonthly     = income - expense - vatPayable - monthlyIncomeTax
  const hourlyNet      = hours > 0 ? Math.round(netMonthly / (hours * 4.3)) : 0

  const totalMonthlyTax = vatPayable + monthlyIncomeTax
  const taxPct         = income > 0 ? (totalMonthlyTax / income) * 100 : 0
  const expensePct     = income > 0 ? (expense / income) * 100 : 0
  const netPct         = Math.max(0, 100 - taxPct - expensePct)

  return (
    <div className="space-y-5">
      {/* Heading */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">세금 부담 시뮬레이터</h1>
        <p className="mt-0.5 text-sm text-slate-500">수입과 경비를 입력하면 실시간으로 세금을 계산합니다</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* ── Left: Inputs ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-slate-800">입력 정보</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Job type */}
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-600">업종 선택</Label>
              <Select
                value={values.jobType}
                onValueChange={(v) => setValue('jobType', v)}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="업종을 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  {JOB_TYPES.map((j) => (
                    <SelectItem key={j.value} value={j.value}>{j.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Monthly income */}
            <div className="space-y-1.5">
              <Label htmlFor="monthlyIncome" className="text-xs text-slate-600">
                이번 달 예상 수입 (원)
              </Label>
              <div className="relative">
                <Input
                  id="monthlyIncome"
                  {...register('monthlyIncome')}
                  placeholder="예: 5,000,000"
                  className="h-9 text-sm pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">원</span>
              </div>
              {income > 0 && (
                <p className="text-[11px] text-slate-400">연간 환산: {fmt(annualIncome)}</p>
              )}
            </div>

            {/* Monthly expense */}
            <div className="space-y-1.5">
              <Label htmlFor="monthlyExpense" className="text-xs text-slate-600">
                예상 경비 (원)
              </Label>
              <div className="relative">
                <Input
                  id="monthlyExpense"
                  {...register('monthlyExpense')}
                  placeholder="예: 1,500,000"
                  className="h-9 text-sm pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">원</span>
              </div>
            </div>

            {/* Weekly hours (range slider) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-slate-600">업무 시간/주</Label>
                <span className="text-xs font-semibold text-slate-700">{hours}시간</span>
              </div>
              <input
                type="range"
                min={1} max={80} step={1}
                {...register('weeklyHours')}
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-blue-600"
              />
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>1h</span><span>20h</span><span>40h</span><span>60h</span><span>80h</span>
              </div>
            </div>

            <BurnoutBar hours={hours} />
          </CardContent>
        </Card>

        {/* ── Right: Results ── */}
        <div className="space-y-4">
          {/* Donut + summary */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-slate-800">월 세금 분석</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
                <DonutChart
                  vatPct={Math.round(taxPct / 2)}
                  incomePct={Math.round(taxPct / 2)}
                  netPct={Math.round(netPct)}
                />
                {/* Legend */}
                <div className="flex-1 space-y-2.5 w-full">
                  <LegendRow color="bg-red-500"   label="예상 부가세"       value={vatPayable}       />
                  <LegendRow color="bg-orange-400" label="예상 종합소득세"  value={monthlyIncomeTax} note="월 분할" />
                  <LegendRow color="bg-green-500"  label="실 수령액 (추산)" value={netMonthly}       highlight />
                  <LegendRow color="bg-slate-200"  label="경비"             value={expense}          />
                </div>
              </div>

              {/* Hourly rate */}
              {hours > 0 && income > 0 && (
                <div className="mt-4 rounded-lg bg-blue-50 px-4 py-3">
                  <p className="text-xs text-blue-700 font-medium">
                    시간당 순수입 (추산)
                  </p>
                  <p className="text-2xl font-bold text-blue-800">
                    {hourlyNet.toLocaleString('ko-KR')}원
                  </p>
                  <p className="text-[11px] text-blue-600">
                    주 {hours}시간 × 4.3주 기준
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Annual summary message */}
          {income > 0 && (
            <Card className="border-slate-200 bg-slate-50">
              <CardContent className="p-4">
                <div className="flex items-start gap-2">
                  <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-500" />
                  <p className="text-xs text-slate-600 leading-relaxed">
                    이 수입을 유지하면{' '}
                    <strong>연간 세금 약 {fmt(annualVAT + annualIncomeTax)}</strong>을 납부할
                    예정입니다 (부가세 {fmt(annualVAT)} + 소득세 {fmt(annualIncomeTax)}).
                    {jobType === 'creator' && (
                      <> 크리에이터 업종 중소기업특별세액감면 20% 적용 기준입니다.</>
                    )}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Disclaimer */}
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-500" />
            <p className="text-[11px] text-amber-700 leading-relaxed">
              본 시뮬레이터 결과는 <strong>참고용 추산치</strong>입니다. 실제 납부 세액은
              공제·감면 항목, 신고 방식에 따라 달라집니다. 정확한 신고는 세무사와
              상담하거나 홈택스를 이용하세요.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Legend row helper ────────────────────────────────────────────────────────

function LegendRow({
  color, label, value, note, highlight,
}: {
  color:      string
  label:      string
  value:      number
  note?:      string
  highlight?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <span className={`inline-block h-2.5 w-2.5 flex-shrink-0 rounded-sm ${color}`} />
        <span className={`text-xs truncate ${highlight ? 'font-semibold text-slate-800' : 'text-slate-600'}`}>
          {label}
          {note && <span className="ml-1 text-[10px] text-slate-400">({note})</span>}
        </span>
      </div>
      <span className={`flex-shrink-0 text-xs font-semibold tabular-nums ${
        highlight ? 'text-green-700' : 'text-slate-700'
      }`}>
        {value >= 0 ? '' : '-'}{Math.abs(value).toLocaleString('ko-KR')}원
      </span>
    </div>
  )
}
