export interface TaxSummary {
  userId: string
  year: number
  quarter?: number
  totalIncome: number
  totalDeductible: number
  taxableIncome: number
  estimatedTax: number
  effectiveRate: number
  vatEstimate: number
  riskScore: number
  generatedAt: string
}

export interface OptimizationRecommendation {
  id: string
  title: string
  description: string
  potentialSaving: number
  difficulty: 'easy' | 'medium' | 'hard'
  category: string
  actionRequired: string
  deadline?: string
  disclaimer: string
}

export interface TaxAlert {
  id: string
  userId: string
  type: 'deadline' | 'risk' | 'opportunity' | 'law_change'
  title: string
  message: string
  severity: 'info' | 'warning' | 'error'
  read: boolean
  createdAt: string
}

export interface TaxDeadline {
  name: string
  date: string
  daysLeft: number
  type: 'income_tax' | 'vat' | 'withholding'
}
