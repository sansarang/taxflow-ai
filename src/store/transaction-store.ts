import { create } from 'zustand'
import type { Transaction, TransactionFilter } from '@/types/transaction'

interface TransactionStore {
  transactions: Transaction[]
  filter: TransactionFilter
  selectedIds: Set<string>
  setTransactions: (transactions: Transaction[]) => void
  addTransactions: (transactions: Transaction[]) => void
  updateTransaction: (id: string, updates: Partial<Transaction>) => void
  removeTransaction: (id: string) => void
  setFilter: (filter: Partial<TransactionFilter>) => void
  toggleSelected: (id: string) => void
  clearSelected: () => void
  selectAll: () => void
}

export const useTransactionStore = create<TransactionStore>((set, get) => ({
  transactions: [],
  filter: {},
  selectedIds: new Set(),

  setTransactions: (transactions) => set({ transactions }),

  addTransactions: (newTransactions) =>
    set((state) => ({
      transactions: [
        ...newTransactions,
        ...state.transactions.filter((t) => !newTransactions.some((n) => n.id === t.id)),
      ],
    })),

  updateTransaction: (id, updates) =>
    set((state) => ({
      transactions: state.transactions.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    })),

  removeTransaction: (id) =>
    set((state) => ({
      transactions: state.transactions.filter((t) => t.id !== id),
    })),

  setFilter: (filter) =>
    set((state) => ({ filter: { ...state.filter, ...filter } })),

  toggleSelected: (id) =>
    set((state) => {
      const selectedIds = new Set(state.selectedIds)
      if (selectedIds.has(id)) {
        selectedIds.delete(id)
      } else {
        selectedIds.add(id)
      }
      return { selectedIds }
    }),

  clearSelected: () => set({ selectedIds: new Set() }),

  selectAll: () =>
    set((state) => ({ selectedIds: new Set(state.transactions.map((t) => t.id)) })),
}))
