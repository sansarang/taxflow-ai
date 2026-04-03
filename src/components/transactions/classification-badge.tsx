'use client'

import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

// ─── Tax category code registry ───────────────────────────────────────────────

export const TAX_CATEGORY_MAP: Record<string, { label: string; group: TaxGroup }> = {
  '101': { label: '매출(과세)',        group: 'income'          },
  '102': { label: '매출(면세)',        group: 'income'          },
  '103': { label: '매출(영세율)',      group: 'income'          },
  '201': { label: '매입공제',          group: 'deductible'      },
  '202': { label: '카드매입',          group: 'deductible'      },
  '203': { label: '현금영수증매입',    group: 'deductible'      },
  '301': { label: '인건비',            group: 'expense'         },
  '302': { label: '임차료',            group: 'expense'         },
  '303': { label: '차량유지비',        group: 'expense'         },
  '304': { label: '접대비',            group: 'expense'         },
  '305': { label: '광고선전비',        group: 'expense'         },
  '306': { label: '통신비',            group: 'expense'         },
  '307': { label: '소모품비',          group: 'expense'         },
  '308': { label: '장비구입비',        group: 'expense'         },
  '309': { label: '소프트웨어구독',    group: 'expense'         },
  '310': { label: '콘텐츠제작비',      group: 'expense'         },
  '311': { label: '외주편집비',        group: 'expense'         },
  '401': { label: '불공제매입',        group: 'non_deductible'  },
  '402': { label: '개인지출',          group: 'non_deductible'  },
}

export type TaxGroup = 'income' | 'deductible' | 'expense' | 'non_deductible' | 'unknown'

const GROUP_STYLES: Record<TaxGroup, string> = {
  income:          'border-green-200  bg-green-50   text-green-800',
  deductible:      'border-blue-200   bg-blue-50    text-blue-800',
  expense:         'border-purple-200 bg-purple-50  text-purple-800',
  non_deductible:  'border-red-200    bg-red-50     text-red-700',
  unknown:         'border-slate-200  bg-slate-50   text-slate-500',
}

export function getCategoryGroup(code: string | null | undefined): TaxGroup {
  if (!code) return 'unknown'
  return TAX_CATEGORY_MAP[code]?.group ?? 'unknown'
}

export function getCategoryLabel(code: string | null | undefined): string {
  if (!code) return '미분류'
  return TAX_CATEGORY_MAP[code]?.label ?? `코드 ${code}`
}

// ─── Component ────────────────────────────────────────────────────────────────

interface ClassificationBadgeProps {
  /** DB tax_category code, e.g. '101', '308', or null */
  category:  string | null | undefined
  /** Optional Korean label override */
  label?:    string | null
  /** AI reason shown in tooltip */
  aiReason?: string | null
  /** Show tooltip only when aiReason is provided */
  showTooltip?: boolean
}

export function ClassificationBadge({
  category,
  label,
  aiReason,
  showTooltip = true,
}: ClassificationBadgeProps) {
  const group       = getCategoryGroup(category)
  const displayLabel = label ?? getCategoryLabel(category)
  const styles      = GROUP_STYLES[group]

  const badge = (
    <Badge
      variant="outline"
      className={cn('whitespace-nowrap text-[10px] font-medium px-1.5 py-0', styles)}
    >
      {displayLabel}
    </Badge>
  )

  if (!showTooltip || !aiReason) return badge

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent
          side="top"
          className="max-w-56 text-xs leading-relaxed"
        >
          <p className="font-semibold mb-0.5">AI 판단 근거</p>
          <p>{aiReason}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
