'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { calculateTax } from '@/lib/tax/calculator'
import { formatKoreanCurrency } from '@/lib/utils/korean-currency'

export function TaxSimulator() {
  const [income, setIncome] = useState('')
  const [expenses, setExpenses] = useState('')
  const [result, setResult] = useState<number | null>(null)

  const handleSimulate = () => {
    const incomeNum = Number(income.replace(/,/g, ''))
    const expensesNum = Number(expenses.replace(/,/g, ''))
    const tax = calculateTax(incomeNum, expensesNum)
    setResult(tax)
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">입력값</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="income">연간 수입 (원)</Label>
            <Input
              id="income"
              type="text"
              placeholder="50,000,000"
              value={income}
              onChange={(e) => setIncome(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="expenses">필요경비 (원)</Label>
            <Input
              id="expenses"
              type="text"
              placeholder="10,000,000"
              value={expenses}
              onChange={(e) => setExpenses(e.target.value)}
            />
          </div>
          <Button onClick={handleSimulate} className="w-full">
            시뮬레이션
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">예상 세금</CardTitle>
        </CardHeader>
        <CardContent>
          {result !== null ? (
            <div className="space-y-2">
              <div className="text-3xl font-bold text-slate-900">{formatKoreanCurrency(result)}</div>
              <p className="text-sm text-slate-500">예상 종합소득세</p>
            </div>
          ) : (
            <p className="text-sm text-slate-400">입력값을 입력하고 시뮬레이션을 실행하세요</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
