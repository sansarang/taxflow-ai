'use client'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ClassificationBadge } from './classification-badge'
import { formatKoreanCurrency } from '@/lib/utils/korean-currency'
import type { Transaction } from '@/types/transaction'

interface TransactionTableProps {
  transactions?: Transaction[]
}

export function TransactionTable({ transactions = [] }: TransactionTableProps) {
  if (transactions.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-2xl border border-slate-200 bg-white">
        <p className="text-sm text-slate-400">거래 내역이 없습니다. CSV를 업로드하세요.</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>날짜</TableHead>
            <TableHead>내용</TableHead>
            <TableHead>분류</TableHead>
            <TableHead className="text-right">금액</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((tx) => (
            <TableRow key={tx.id}>
              <TableCell className="text-slate-500">{tx.date}</TableCell>
              <TableCell>{tx.description}</TableCell>
              <TableCell>
                <ClassificationBadge category={tx.category} />
              </TableCell>
              <TableCell className="text-right font-medium">
                {formatKoreanCurrency(tx.amount)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
