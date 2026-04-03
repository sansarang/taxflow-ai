export const TAX_BRACKETS_2024 = [
  { min: 0, max: 14_000_000, rate: 0.06, deduction: 0 },
  { min: 14_000_000, max: 50_000_000, rate: 0.15, deduction: 1_260_000 },
  { min: 50_000_000, max: 88_000_000, rate: 0.24, deduction: 5_760_000 },
  { min: 88_000_000, max: 150_000_000, rate: 0.35, deduction: 15_440_000 },
  { min: 150_000_000, max: 300_000_000, rate: 0.38, deduction: 19_940_000 },
  { min: 300_000_000, max: 500_000_000, rate: 0.40, deduction: 25_940_000 },
  { min: 500_000_000, max: 1_000_000_000, rate: 0.42, deduction: 35_940_000 },
  { min: 1_000_000_000, max: Infinity, rate: 0.45, deduction: 65_940_000 },
] as const

export const LOCAL_TAX_RATE = 0.1

export const STANDARD_EXPENSE_RATES: Record<string, number> = {
  creator: 0.6,
  freelancer: 0.45,
  consultant: 0.30,
}

export const TAX_CATEGORIES = [
  { value: 'income', label: '수입' },
  { value: 'expense_deductible', label: '필요경비 (공제 가능)' },
  { value: 'expense_non_deductible', label: '일반 지출 (공제 불가)' },
  { value: 'personal', label: '개인 지출' },
  { value: 'unknown', label: '미분류' },
] as const

export const VAT_RATE = 0.1

export const BASIC_DEDUCTION = 1_500_000
