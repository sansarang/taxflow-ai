import { z } from 'zod'

export const transactionCategorySchema = z.enum([
  'income',
  'expense_deductible',
  'expense_non_deductible',
  'personal',
  'unknown',
])

export const transactionSchema = z.object({
  id: z.string(),
  date: z.string(),
  description: z.string().min(1),
  amount: z.number(),
  category: transactionCategorySchema,
  source: z.string().optional(),
  userId: z.string().optional(),
  createdAt: z.string().optional(),
})

export const updateCategorySchema = z.object({
  transactionId: z.string(),
  category: transactionCategorySchema,
})

export type TransactionInput = z.infer<typeof transactionSchema>
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>
