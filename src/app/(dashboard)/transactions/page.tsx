'use client'

import {
  useEffect, useState, useCallback, useMemo,
} from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type RowSelectionState,
} from '@tanstack/react-table'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Button }   from '@/components/ui/button'
import { Input }    from '@/components/ui/input'
import { Badge }    from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { ClassificationBadge } from '@/components/transactions/classification-badge'
import {
  EditCategoryDialog,
  type TxEditRow,
} from '@/components/transactions/edit-category-dialog'
import {
  ChevronUp, ChevronDown, ChevronsUpDown,
  AlertTriangle, Receipt, RotateCcw, Download, Trash2,
  Filter, Search, ChevronLeft, ChevronRight,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface TxRow {
  id:                string
  transaction_date:  string
  description:       string
  amount:            number
  bank_name:         string | null
  tax_category:      string | null
  category_label:    string | null
  vat_deductible:    boolean | null
  confidence:        number | null
  ai_reason:         string | null
  risk_flag:         string[] | null
  receipt_required:  boolean
  manually_reviewed: boolean
  user_category:     string | null
  user_note:         string | null
}

type CategoryFilter = 'all' | 'income' | 'deductible' | 'expense' | 'non_deductible' | 'unclassified'

interface Filters {
  dateFrom:     string
  dateTo:       string
  bank:         string
  category:     CategoryFilter
  vatDeductible: boolean | null
  search:       string
}

const CATEGORY_CODE_GROUPS: Record<string, string[]> = {
  income:         ['101', '102', '103'],
  deductible:     ['201', '202', '203'],
  expense:        ['301', '302', '303', '304', '305', '306', '307', '308', '309', '310', '311'],
  non_deductible: ['401', '402'],
}

// ─── Stats row ────────────────────────────────────────────────────────────────

function StatsRow({ rows }: { rows: TxRow[] }) {
  const income     = rows.filter((r) => r.amount > 0).reduce((s, r) => s + r.amount, 0)
  const expense    = rows.filter((r) => r.amount < 0).reduce((s, r) => s + Math.abs(r.amount), 0)
  const vatCredit  = rows
    .filter((r) => r.vat_deductible && r.amount < 0)
    .reduce((s, r) => s + Math.abs(r.amount) * 0.1, 0)
  const deductible = rows
    .filter((r) => {
      const cat = r.tax_category
      return cat && cat >= '201' && cat <= '311'
    })
    .reduce((s, r) => s + Math.abs(r.amount), 0)

  const items = [
    { label: '총 수입',          value: income,     color: 'text-blue-600'  },
    { label: '총 지출',          value: expense,    color: 'text-slate-700' },
    { label: '부가세 공제 가능', value: vatCredit,  color: 'text-green-600' },
    { label: '인정 경비',        value: deductible, color: 'text-purple-700'},
  ]

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="rounded-lg border border-slate-200 bg-white px-4 py-3">
          <p className="text-[11px] text-slate-500">{item.label}</p>
          <p className={`mt-0.5 text-base font-bold tabular-nums ${item.color}`}>
            ₩{Math.round(item.value).toLocaleString('ko-KR')}
          </p>
        </div>
      ))}
    </div>
  )
}

// ─── Confidence bar ───────────────────────────────────────────────────────────

function ConfidenceBar({ score }: { score: number | null }) {
  if (score === null) return <span className="text-xs text-slate-300">—</span>
  const pct = Math.round(score * 100)
  const color = pct >= 85 ? 'bg-green-500' : pct >= 60 ? 'bg-amber-400' : 'bg-red-400'
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-slate-500 tabular-nums">{pct}%</span>
    </div>
  )
}

// ─── Risk flags ───────────────────────────────────────────────────────────────

function RiskFlags({ flags, receipt }: { flags: string[] | null; receipt: boolean }) {
  const all: string[] = []
  if (receipt)                            all.push('영수증')
  if (flags?.includes('review_needed'))   all.push('검토필요')
  if (flags?.includes('high_amount'))     all.push('고액')
  if (all.length === 0) return <span className="text-xs text-slate-300">—</span>
  return (
    <div className="flex flex-wrap gap-1">
      {all.map((f) => (
        <Badge key={f} variant="outline" className="text-[9px] px-1 py-0 border-amber-300 bg-amber-50 text-amber-700">
          {f}
        </Badge>
      ))}
    </div>
  )
}

// ─── Sort icon ────────────────────────────────────────────────────────────────

function SortIcon({ sort }: { sort: 'asc' | 'desc' | false }) {
  if (sort === 'asc')  return <ChevronUp   className="h-3 w-3 ml-1 inline" />
  if (sort === 'desc') return <ChevronDown className="h-3 w-3 ml-1 inline" />
  return <ChevronsUpDown className="h-3 w-3 ml-1 inline opacity-30" />
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TransactionsPage() {
  const [rows,       setRows]       = useState<TxRow[]>([])
  const [banks,      setBanks]      = useState<string[]>([])
  const [loading,    setLoading]    = useState(true)
  const [sorting,    setSorting]    = useState<SortingState>([{ id: 'transaction_date', desc: true }])
  const [rowSel,     setRowSel]     = useState<RowSelectionState>({})
  const [editRow,    setEditRow]    = useState<TxEditRow | null>(null)
  const [editOpen,   setEditOpen]   = useState(false)
  const [reclassifying, setReclassifying] = useState(false)

  const [filters, setFilters] = useState<Filters>({
    dateFrom: '', dateTo: '', bank: 'all', category: 'all',
    vatDeductible: null, search: '',
  })

  // ── Fetch ────────────────────────────────────────────────────────────────

  const fetchRows = useCallback(async () => {
    setLoading(true)
    const supabase = createClient() as any
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data, error } = await supabase
      .from('transactions')
      .select(
        'id,transaction_date,description,amount,bank_name,tax_category,category_label,' +
        'vat_deductible,confidence,ai_reason,risk_flag,receipt_required,' +
        'manually_reviewed,user_category,user_note'
      )
      .eq('user_id', user.id)
      .order('transaction_date', { ascending: false })
      .limit(2000)

    if (error) {
      toast.error('거래 내역을 불러오지 못했습니다')
    } else {
      const txs = (data ?? []) as TxRow[]
      setRows(txs)
      setBanks([...new Set(txs.map((r) => r.bank_name).filter(Boolean))] as string[])
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchRows() }, [fetchRows])

  // ── Client-side filtering ─────────────────────────────────────────────────

  const filtered = useMemo<TxRow[]>(() => {
    return rows.filter((r) => {
      if (filters.search) {
        const q = filters.search.toLowerCase()
        if (!r.description.toLowerCase().includes(q)) return false
      }
      if (filters.dateFrom && r.transaction_date < filters.dateFrom) return false
      if (filters.dateTo   && r.transaction_date > filters.dateTo)   return false
      if (filters.bank !== 'all' && r.bank_name !== filters.bank)    return false
      if (filters.vatDeductible !== null && r.vat_deductible !== filters.vatDeductible) return false

      if (filters.category !== 'all') {
        if (filters.category === 'unclassified') {
          if (r.tax_category) return false
        } else {
          const codes = CATEGORY_CODE_GROUPS[filters.category] ?? []
          if (!codes.includes(r.tax_category ?? '')) return false
        }
      }
      return true
    })
  }, [rows, filters])

  // ── Columns ───────────────────────────────────────────────────────────────

  const columns = useMemo<ColumnDef<TxRow>[]>(() => [
    {
      id: 'select',
      header: ({ table }) => (
        <input
          type="checkbox"
          className="h-4 w-4 accent-blue-600 cursor-pointer"
          checked={table.getIsAllPageRowsSelected()}
          onChange={table.getToggleAllPageRowsSelectedHandler()}
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          className="h-4 w-4 accent-blue-600 cursor-pointer"
          checked={row.getIsSelected()}
          onChange={row.getToggleSelectedHandler()}
        />
      ),
      size: 36,
    },
    {
      accessorKey: 'transaction_date',
      header: ({ column }) => (
        <button
          className="flex items-center text-xs font-semibold"
          onClick={() => column.toggleSorting()}
        >
          날짜 <SortIcon sort={column.getIsSorted()} />
        </button>
      ),
      cell: ({ getValue }) => (
        <span className="text-xs text-slate-500 tabular-nums whitespace-nowrap">
          {String(getValue())}
        </span>
      ),
    },
    {
      accessorKey: 'description',
      header: () => <span className="text-xs font-semibold">거래내역</span>,
      cell: ({ row }) => (
        <div className="max-w-[200px]">
          <p className="truncate text-sm text-slate-800">{row.original.description}</p>
          {row.original.user_note && (
            <p className="truncate text-[10px] text-slate-400 mt-0.5">{row.original.user_note}</p>
          )}
          {row.original.manually_reviewed && (
            <Badge variant="outline" className="mt-0.5 text-[9px] px-1 py-0 border-green-300 bg-green-50 text-green-700">
              직접 수정
            </Badge>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'amount',
      header: ({ column }) => (
        <button
          className="flex items-center text-xs font-semibold"
          onClick={() => column.toggleSorting()}
        >
          금액 <SortIcon sort={column.getIsSorted()} />
        </button>
      ),
      cell: ({ getValue }) => {
        const v = getValue() as number
        return (
          <span className={`text-sm font-semibold tabular-nums whitespace-nowrap ${
            v >= 0 ? 'text-blue-600' : 'text-red-600'
          }`}>
            {v >= 0 ? '+' : ''}{v.toLocaleString('ko-KR')}원
          </span>
        )
      },
    },
    {
      id: 'classification',
      header: () => <span className="text-xs font-semibold">AI 분류</span>,
      cell: ({ row }) => (
        <ClassificationBadge
          category={row.original.tax_category}
          label={row.original.category_label}
          aiReason={row.original.ai_reason}
        />
      ),
    },
    {
      accessorKey: 'confidence',
      header: () => <span className="text-xs font-semibold">신뢰도</span>,
      cell: ({ getValue }) => <ConfidenceBar score={getValue() as number | null} />,
    },
    {
      id: 'risk',
      header: () => <span className="text-xs font-semibold">위험도</span>,
      cell: ({ row }) => (
        <RiskFlags flags={row.original.risk_flag} receipt={row.original.receipt_required} />
      ),
    },
    {
      id: 'edit',
      header: () => null,
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-slate-500 hover:text-slate-800"
          onClick={() => {
            setEditRow({
              id:             row.original.id,
              description:    row.original.description,
              amount:         row.original.amount,
              tax_category:   row.original.tax_category,
              category_label: row.original.category_label,
              user_note:      row.original.user_note,
              ai_reason:      row.original.ai_reason,
            })
            setEditOpen(true)
          }}
        >
          수정
        </Button>
      ),
    },
  ], [])

  // ── Table instance ────────────────────────────────────────────────────────

  const table = useReactTable({
    data:              filtered,
    columns,
    state:             { sorting, rowSelection: rowSel },
    onSortingChange:   setSorting,
    onRowSelectionChange: setRowSel,
    getCoreRowModel:   getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState:      { pagination: { pageSize: 50 } },
    enableRowSelection: true,
  })

  const selectedIds = Object.keys(rowSel)
    .filter((k) => rowSel[k])
    .map((idx) => filtered[Number(idx)]?.id)
    .filter(Boolean)

  // ── Bulk actions ──────────────────────────────────────────────────────────

  async function reclassifySelected() {
    if (selectedIds.length === 0) return
    setReclassifying(true)
    try {
      const supabase = createClient() as any
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Get the batch_id from the first selected transaction
      const { data: batch } = await supabase
        .from('transactions')
        .select('batch_id')
        .in('id', selectedIds)
        .limit(1)
        .single()

      if (batch?.batch_id) {
        const res = await fetch('/api/classify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ batchId: batch.batch_id }),
        })
        if (res.ok) {
          toast.success('재분류가 완료되었습니다')
          fetchRows()
        } else {
          const body = await res.json()
          toast.error(body.error ?? 'AI 재분류 중 오류가 발생했습니다')
        }
      } else {
        toast.error('배치 정보를 찾을 수 없습니다')
      }
    } catch {
      toast.error('AI 재분류 중 오류가 발생했습니다')
    } finally {
      setReclassifying(false)
    }
  }

  function exportCSV() {
    const sel = rows.filter((r) => selectedIds.includes(r.id))
    const target = sel.length > 0 ? sel : filtered
    const header = '날짜,거래내역,금액,분류,신뢰도,영수증필요\n'
    const body = target
      .map((r) =>
        [
          r.transaction_date,
          `"${r.description.replace(/"/g, '""')}"`,
          r.amount,
          r.category_label ?? r.tax_category ?? '미분류',
          r.confidence != null ? `${Math.round(r.confidence * 100)}%` : '',
          r.receipt_required ? 'Y' : 'N',
        ].join(',')
      )
      .join('\n')
    const blob = new Blob([header + body], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = '거래내역.csv'
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`${target.length}건 CSV로 내보냈습니다`)
  }

  async function deleteSelected() {
    if (selectedIds.length === 0) return
    if (!confirm(`선택한 ${selectedIds.length}건을 삭제하시겠습니까?`)) return

    const supabase = createClient() as any
    const { error } = await supabase.from('transactions').delete().in('id', selectedIds)
    if (error) {
      toast.error('삭제 중 오류가 발생했습니다')
    } else {
      setRows((prev) => prev.filter((r) => !selectedIds.includes(r.id)))
      setRowSel({})
      toast.success(`${selectedIds.length}건 삭제되었습니다`)
    }
  }

  // ── Edit saved callback ────────────────────────────────────────────────────

  function handleSaved(id: string, newCategory: string, newNote: string) {
    setRows((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              tax_category:      newCategory,
              user_category:     newCategory,
              user_note:         newNote || null,
              manually_reviewed: true,
            }
          : r
      )
    )
  }

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">거래 내역</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {loading ? '불러오는 중...' : `총 ${rows.length.toLocaleString('ko-KR')}건`}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={fetchRows} disabled={loading}>
          <RotateCcw className={`mr-1.5 h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          새로고침
        </Button>
      </div>

      {/* Stats */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
        </div>
      ) : (
        <StatsRow rows={filtered} />
      )}

      {/* ── Filter bar ─────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 rounded-xl border border-slate-200 bg-white/95 backdrop-blur p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />

          {/* Date range */}
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
            className="h-8 rounded-md border border-slate-200 px-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
          <span className="text-xs text-slate-400">~</span>
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
            className="h-8 rounded-md border border-slate-200 px-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />

          {/* Bank */}
          <Select
            value={filters.bank}
            onValueChange={(v) => setFilters((f) => ({ ...f, bank: v }))}
          >
            <SelectTrigger className="h-8 w-32 text-xs">
              <SelectValue placeholder="은행 전체" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">은행 전체</SelectItem>
              {banks.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
            </SelectContent>
          </Select>

          {/* Category */}
          <Select
            value={filters.category}
            onValueChange={(v) => setFilters((f) => ({ ...f, category: v as CategoryFilter }))}
          >
            <SelectTrigger className="h-8 w-28 text-xs">
              <SelectValue placeholder="분류" />
            </SelectTrigger>
            <SelectContent>
              {[
                { value: 'all',           label: '전체' },
                { value: 'income',        label: '매출' },
                { value: 'deductible',    label: '매입' },
                { value: 'expense',       label: '경비' },
                { value: 'non_deductible',label: '불공제' },
                { value: 'unclassified',  label: '미분류' },
              ].map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* VAT deductible toggle */}
          <button
            type="button"
            onClick={() =>
              setFilters((f) => ({
                ...f,
                vatDeductible: f.vatDeductible === null ? true : f.vatDeductible ? false : null,
              }))
            }
            className={`h-8 rounded-md border px-2.5 text-xs font-medium transition-colors ${
              filters.vatDeductible === true
                ? 'border-green-300 bg-green-50 text-green-700'
                : filters.vatDeductible === false
                ? 'border-red-300 bg-red-50 text-red-600'
                : 'border-slate-200 text-slate-500 hover:bg-slate-50'
            }`}
          >
            부가세공제{' '}
            {filters.vatDeductible === true ? '✓' : filters.vatDeductible === false ? '✗' : '—'}
          </button>

          {/* Search */}
          <div className="relative flex-1 min-w-36">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
              placeholder="거래내역 검색"
              className="h-8 pl-8 text-xs"
            />
          </div>

          {/* Clear filters */}
          {(filters.search || filters.dateFrom || filters.dateTo ||
            filters.bank !== 'all' || filters.category !== 'all' || filters.vatDeductible !== null) && (
            <button
              type="button"
              onClick={() => setFilters({
                dateFrom: '', dateTo: '', bank: 'all', category: 'all',
                vatDeductible: null, search: '',
              })}
              className="h-8 rounded-md px-2 text-xs text-slate-400 hover:text-slate-700"
            >
              초기화
            </button>
          )}
        </div>
      </div>

      {/* ── Bulk actions bar ───────────────────────────────────────────── */}
      {selectedIds.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-200 px-4 py-2.5">
          <span className="text-sm font-medium text-blue-800">
            {selectedIds.length}건 선택됨
          </span>
          <div className="ml-auto flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-8 border-blue-300 text-blue-700 hover:bg-blue-100 text-xs"
              onClick={reclassifySelected}
              disabled={reclassifying}
            >
              {reclassifying ? (
                <span className="flex items-center gap-1.5">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-blue-300 border-t-blue-700" />
                  재분류 중
                </span>
              ) : (
                <>
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> 선택 항목 재분류
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs border-slate-300"
              onClick={exportCSV}
            >
              <Download className="mr-1.5 h-3.5 w-3.5" /> CSV 내보내기
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs border-red-200 text-red-600 hover:bg-red-50"
              onClick={deleteSelected}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" /> 선택 삭제
            </Button>
          </div>
        </div>
      )}

      {/* ── Table ──────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        {loading ? (
          <div className="space-y-0">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 border-b border-slate-100 px-4 py-3">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 flex-1" />
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-2 w-20" />
              </div>
            ))}
          </div>
        ) : table.getRowModel().rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-slate-400">
            <Receipt className="h-8 w-8" />
            <p className="text-sm">거래 내역이 없습니다.</p>
            <p className="text-xs">CSV 업로드 후 AI 분류를 실행하세요.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((hg) => (
                  <TableRow key={hg.id} className="border-slate-100 bg-slate-50">
                    {hg.headers.map((header) => (
                      <TableHead
                        key={header.id}
                        className="h-9 text-xs font-semibold text-slate-500 whitespace-nowrap"
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.map((row) => {
                  const rx = row.original
                  const isAmber = rx.receipt_required
                  const isRed   = rx.risk_flag?.includes('review_needed')
                  return (
                    <TableRow
                      key={row.id}
                      data-state={row.getIsSelected() ? 'selected' : undefined}
                      className={`border-slate-100 transition-colors ${
                        isRed   ? 'bg-red-50/50   hover:bg-red-50'   :
                        isAmber ? 'bg-amber-50/50 hover:bg-amber-50' :
                                  'hover:bg-slate-50'
                      } ${row.getIsSelected() ? 'bg-blue-50/50' : ''}`}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} className="py-2.5 text-sm">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Pagination */}
        {!loading && table.getPageCount() > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
            <span className="text-xs text-slate-500">
              {table.getState().pagination.pageIndex * 50 + 1}–
              {Math.min((table.getState().pagination.pageIndex + 1) * 50, filtered.length)}
              &nbsp;/ {filtered.length.toLocaleString('ko-KR')}건
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <span className="px-2 text-xs text-slate-600">
                {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Risk legend */}
      <div className="flex items-center gap-4 text-[11px] text-slate-400">
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-6 rounded-sm bg-amber-100 border border-amber-200" />
          영수증 누락
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-6 rounded-sm bg-red-100 border border-red-200" />
          검토 필요
        </div>
      </div>

      {/* Edit dialog */}
      <EditCategoryDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        row={editRow}
        onSaved={handleSaved}
      />
    </div>
  )
}
