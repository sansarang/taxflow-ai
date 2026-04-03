'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Transaction, TransactionFilter } from '@/types/transaction'

type TransactionRow = {
  id: string
  date: string
  description: string
  amount: number
  category: string
  source: string | null
  created_at: string
}

export function useTransactions(filter?: TransactionFilter) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const supabase = createClient()

    async function fetchTransactions() {
      setIsLoading(true)
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let query = (supabase as any).from('transactions').select('*').order('date', { ascending: false })

        if (filter?.category) query = query.eq('category', filter.category)
        if (filter?.dateFrom) query = query.gte('date', filter.dateFrom)
        if (filter?.dateTo) query = query.lte('date', filter.dateTo)

        const { data, error } = await query

        if (error) throw error

        setTransactions(
          ((data ?? []) as TransactionRow[]).map((row) => ({
            id: row.id,
            date: row.date,
            description: row.description,
            amount: row.amount,
            category: row.category as Transaction['category'],
            source: row.source ?? undefined,
            createdAt: row.created_at,
          }))
        )
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'))
      } finally {
        setIsLoading(false)
      }
    }

    fetchTransactions()
  }, [filter?.category, filter?.dateFrom, filter?.dateTo])

  return { transactions, isLoading, error }
}
