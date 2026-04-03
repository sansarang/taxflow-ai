import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { LucideIcon } from 'lucide-react'

type ColorVariant = 'default' | 'green' | 'red' | 'amber' | 'blue'

interface TaxSummaryCardProps {
  title:       string
  value:       number | null   // KRW amount; null = loading
  subtitle?:   string
  icon?:       LucideIcon
  color?:      ColorVariant
  trend?:      number          // % change from last period (positive = up)
  badge?:      string          // optional badge text
  loading?:    boolean
}

const COLOR_MAP: Record<ColorVariant, {
  icon: string; value: string; bg: string; badge: string
}> = {
  default: { icon: 'text-slate-500',  value: 'text-slate-900', bg: 'bg-slate-100',  badge: 'bg-slate-100 text-slate-700' },
  green:   { icon: 'text-green-600',  value: 'text-green-700', bg: 'bg-green-50',   badge: 'bg-green-100 text-green-700' },
  red:     { icon: 'text-red-600',    value: 'text-red-700',   bg: 'bg-red-50',     badge: 'bg-red-100 text-red-700'    },
  amber:   { icon: 'text-amber-600',  value: 'text-amber-700', bg: 'bg-amber-50',   badge: 'bg-amber-100 text-amber-700'},
  blue:    { icon: 'text-blue-600',   value: 'text-blue-700',  bg: 'bg-blue-50',    badge: 'bg-blue-100 text-blue-700'  },
}

function formatKRW(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1_0000_0000) {
    return `${(abs / 1_0000_0000).toFixed(1)}억원`
  }
  if (abs >= 10_000) {
    const man = Math.floor(abs / 10_000)
    const rest = abs % 10_000
    return rest === 0 ? `${man}만원` : `${man}만 ${rest.toLocaleString('ko-KR')}원`
  }
  return `${abs.toLocaleString('ko-KR')}원`
}

export function TaxSummaryCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color = 'default',
  trend,
  badge,
  loading = false,
}: TaxSummaryCardProps) {
  const colors = COLOR_MAP[color]

  if (loading || value === null) {
    return (
      <Card>
        <CardContent className="p-5">
          <Skeleton className="mb-3 h-3 w-24" />
          <Skeleton className="mb-2 h-7 w-32" />
          <Skeleton className="h-3 w-20" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5">
        {/* Header row */}
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-medium text-slate-500">{title}</span>
          <div className="flex items-center gap-2">
            {badge && (
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${colors.badge}`}>
                {badge}
              </span>
            )}
            {Icon && (
              <div className={`flex h-7 w-7 items-center justify-center rounded-full ${colors.bg}`}>
                <Icon className={`h-3.5 w-3.5 ${colors.icon}`} />
              </div>
            )}
          </div>
        </div>

        {/* Value */}
        <div className={`text-2xl font-bold leading-none ${colors.value}`}>
          ₩{formatKRW(Math.abs(value))}
        </div>

        {/* Subtitle + trend */}
        <div className="mt-2 flex items-center gap-2">
          {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
          {trend !== undefined && (
            <span
              className={`text-xs font-medium ${
                trend > 0 ? 'text-red-500' : trend < 0 ? 'text-green-600' : 'text-slate-400'
              }`}
            >
              {trend > 0 ? '▲' : trend < 0 ? '▼' : '–'} {Math.abs(trend).toFixed(1)}%
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
