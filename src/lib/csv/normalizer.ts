import { hashString } from '@/lib/utils/hash'
import type { BankCode } from './bank-detector'
import type { Transaction } from '@/types/transaction'

export function normalizeTransactions(
  rows: Record<string, string>[],
  bank: BankCode
): Transaction[] {
  return rows.map((row) => {
    const normalized = normalizeRow(row, bank)
    return {
      ...normalized,
      id: hashString(`${normalized.date}-${normalized.description}-${normalized.amount}`),
      category: 'unknown',
      source: bank,
      createdAt: new Date().toISOString(),
    }
  })
}

function normalizeRow(
  row: Record<string, string>,
  bank: BankCode
): Omit<Transaction, 'id' | 'category' | 'source' | 'createdAt'> {
  switch (bank) {
    case 'kb':
      return {
        date: row['거래일시'] ?? '',
        description: row['거래내용'] ?? '',
        amount: parseAmount(row['입금금액']) - parseAmount(row['출금금액']),
      }
    case 'shinhan':
      return {
        date: row['거래일자'] ?? '',
        description: row['적요'] ?? '',
        amount: parseAmount(row['입금']) - parseAmount(row['출금']),
      }
    default:
      return {
        date: Object.values(row)[0] ?? '',
        description: Object.values(row)[1] ?? '',
        amount: parseAmount(Object.values(row)[2] ?? '0'),
      }
  }
}

function parseAmount(value: string): number {
  return Number(value?.replace(/[^0-9.-]/g, '') ?? 0) || 0
}
