export type TransactionCategory =
  | 'income'
  | 'expense_deductible'
  | 'expense_non_deductible'
  | 'personal'
  | 'unknown'

export interface Transaction {
  id: string
  date: string
  description: string
  amount: number
  category: TransactionCategory
  source?: string
  userId?: string
  confidence?: number
  classificationReason?: string
  createdAt?: string
  updatedAt?: string
}

export interface TransactionFilter {
  category?: TransactionCategory
  dateFrom?: string
  dateTo?: string
  minAmount?: number
  maxAmount?: number
  search?: string
}

export interface TransactionStats {
  totalIncome: number
  totalExpenses: number
  totalDeductible: number
  totalNonDeductible: number
  transactionCount: number
}
