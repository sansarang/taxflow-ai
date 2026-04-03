'use client'

interface BurnoutChartProps {
  data: Array<{ month: string; income: number; tax: number }>
}

export function BurnoutChart({ data }: BurnoutChartProps) {
  if (!data.length) {
    return (
      <div className="flex h-48 items-center justify-center rounded-xl border border-slate-200 bg-white">
        <p className="text-sm text-slate-400">데이터가 없습니다</p>
      </div>
    )
  }

  // Chart visualization will be implemented
  return (
    <div className="h-48 rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-medium text-slate-700">월별 수입/세금 추이</p>
    </div>
  )
}
