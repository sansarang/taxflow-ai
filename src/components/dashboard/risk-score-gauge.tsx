'use client'

import { useEffect, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

interface RiskScoreGaugeProps {
  score?: number     // 0–100
  loading?: boolean
}

const GAUGE_R  = 72
const CX       = 100
const CY       = 96
const ARC_HALF = Math.PI * GAUGE_R // ≈ 226.2 — circumference of a semi-circle

function scoreColor(score: number): string {
  if (score <= 30) return '#16a34a'   // green
  if (score <= 60) return '#f97316'   // orange
  return '#dc2626'                    // red
}

function scoreLabel(score: number): string {
  if (score <= 30) return '안전'
  if (score <= 60) return '주의'
  return '위험'
}

function scoreLabelColor(score: number): string {
  if (score <= 30) return 'text-green-600'
  if (score <= 60) return 'text-orange-500'
  return 'text-red-600'
}

/**
 * Build an SVG arc path for a semi-circle gauge.
 * Goes from the left end to the right end of the gauge (180 °).
 * The "progress" end angle is interpolated from score/100.
 */
function arcPath(score: number): { track: string; value: string; offset: number } {
  // Semi-circle: starts at left (180°), ends at right (0°)
  // In SVG: left = (CX - R, CY), right = (CX + R, CY)
  const track = `M ${CX - GAUGE_R},${CY} A ${GAUGE_R},${GAUGE_R} 0 0,1 ${CX + GAUGE_R},${CY}`

  // dash = full half-circumference; offset moves the drawn portion
  const offset = ARC_HALF * (1 - score / 100)

  return { track, value: track, offset }
}

export function RiskScoreGauge({ score = 0, loading = false }: RiskScoreGaugeProps) {
  const pathRef = useRef<SVGPathElement>(null)

  // Animate on mount / score change
  useEffect(() => {
    if (!pathRef.current || loading) return
    const el = pathRef.current
    const { offset } = arcPath(score)
    // Start from fully hidden, animate to target offset
    el.style.transition = 'none'
    el.style.strokeDashoffset = String(ARC_HALF)
    // Force reflow then animate
    void el.getBoundingClientRect()
    el.style.transition = 'stroke-dashoffset 1s cubic-bezier(0.4,0,0.2,1)'
    el.style.strokeDashoffset = String(offset)
  }, [score, loading])

  if (loading) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 p-6">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-24 w-40 rounded-full" />
          <Skeleton className="h-6 w-16" />
        </CardContent>
      </Card>
    )
  }

  const color = scoreColor(score)
  const label = scoreLabel(score)
  const { track, offset } = arcPath(score)

  return (
    <Card>
      <CardContent className="flex flex-col items-center p-5">
        <p className="mb-1 text-xs font-medium text-slate-500">공제 누락 위험도</p>

        {/* SVG Gauge */}
        <svg viewBox="0 0 200 106" className="w-40 overflow-visible">
          {/* Track (gray) */}
          <path
            d={track}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth="14"
            strokeLinecap="round"
          />
          {/* Value arc */}
          <path
            ref={pathRef}
            d={track}
            fill="none"
            stroke={color}
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={ARC_HALF}
            strokeDashoffset={offset}
          />
          {/* Score number */}
          <text
            x={CX}
            y={CY - 4}
            textAnchor="middle"
            fontSize="28"
            fontWeight="700"
            fill={color}
            fontFamily="inherit"
          >
            {score}
          </text>
          {/* Label */}
          <text
            x={CX}
            y={CY + 18}
            textAnchor="middle"
            fontSize="11"
            fill="#64748b"
            fontFamily="inherit"
          >
            / 100
          </text>
          {/* Scale labels */}
          <text x={CX - GAUGE_R - 4} y={CY + 18} fontSize="9" fill="#94a3b8" textAnchor="middle" fontFamily="inherit">0</text>
          <text x={CX + GAUGE_R + 4} y={CY + 18} fontSize="9" fill="#94a3b8" textAnchor="middle" fontFamily="inherit">100</text>
        </svg>

        {/* Status label */}
        <div className={`-mt-1 text-lg font-bold ${scoreLabelColor(score)}`}>{label}</div>

        {/* Sub-legend */}
        <div className="mt-2 flex gap-3 text-xs">
          <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-green-500" />0–30</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-orange-400" />31–60</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-red-500" />61+</span>
        </div>
      </CardContent>
    </Card>
  )
}
