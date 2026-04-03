'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { calculateTax, calculateEffectiveRate } from '@/lib/tax/calculator'
import type { TaxSummary } from '@/types/tax'

type TxRow = { amount: number; category: string }

export function useTaxSummary(year = new Date().getFullYear()) {
  const [summary, setSummary] = useState<TaxSummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createClient() as any

    async function computeSummary() {
      setIsLoading(true)
      try {
        const { data: user } = await supabase.auth.getUser()
        if (!user.user) return

        const { data: transactions } = await supabase
          .from('transactions')
          .select('amount, category')
          .gte('date', `${year}-01-01`)
          .lte('date', `${year}-12-31`)

        const rows = (transactions ?? []) as TxRow[]

        const totalIncome = rows
          .filter((t) => t.category === 'income')
          .reduce((sum, t) => sum + t.amount, 0)

        const totalDeductible = rows
          .filter((t) => t.category === 'expense_deductible')
          .reduce((sum, t) => sum + Math.abs(t.amount), 0)

        const taxableIncome = Math.max(0, totalIncome - totalDeductible)
        const estimatedTax = calculateTax(totalIncome, totalDeductible)

        setSummary({
          userId: user.user.id,
          year,
          totalIncome,
          totalDeductible,
          taxableIncome,
          estimatedTax,
          effectiveRate: calculateEffectiveRate(totalIncome, estimatedTax),
          vatEstimate: Math.round(taxableIncome * 0.1),
          riskScore: computeRiskScore(totalIncome, totalDeductible),
          generatedAt: new Date().toISOString(),
        })
      } finally {
        setIsLoading(false)
      }
    }

    computeSummary()
  }, [year])

  return { summary, isLoading }
}

function computeRiskScore(income: number, deductible: number): number {
  const ratio = income > 0 ? deductible / income : 0
  if (ratio > 0.8) return 85
  if (ratio > 0.6) return 60
  if (ratio > 0.4) return 35
  return 15
}
