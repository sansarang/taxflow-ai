'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button }   from '@/components/ui/button'
import { Label }    from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { TAX_CATEGORY_MAP } from './classification-badge'
import { Badge } from '@/components/ui/badge'

// ─── Grouped options ──────────────────────────────────────────────────────────

const GROUPS = [
  { label: '📈 매출',         codes: ['101', '102', '103'] },
  { label: '🧾 매입 공제',    codes: ['201', '202', '203'] },
  { label: '💼 경비',         codes: ['301', '302', '303', '304', '305', '306', '307', '308', '309', '310', '311'] },
  { label: '🚫 불공제/개인',  codes: ['401', '402'] },
]

// ─── Row type ─────────────────────────────────────────────────────────────────

export interface TxEditRow {
  id:            string
  description:   string
  amount:        number
  tax_category:  string | null
  category_label: string | null
  user_note:     string | null
  ai_reason:     string | null
}

interface EditCategoryDialogProps {
  open:          boolean
  onOpenChange:  (open: boolean) => void
  row:           TxEditRow | null
  onSaved:       (id: string, newCategory: string, newNote: string) => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export function EditCategoryDialog({
  open,
  onOpenChange,
  row,
  onSaved,
}: EditCategoryDialogProps) {
  const [category, setCategory] = useState<string>(row?.tax_category ?? '')
  const [note,     setNote]     = useState<string>(row?.user_note ?? '')
  const [saving,   setSaving]   = useState(false)

  // Sync when row changes
  const handleOpenChange = (o: boolean) => {
    if (o && row) {
      setCategory(row.tax_category ?? '')
      setNote(row.user_note ?? '')
    }
    onOpenChange(o)
  }

  async function save() {
    if (!row) return
    setSaving(true)
    try {
      const supabase = createClient() as any
      const { error } = await supabase
        .from('transactions')
        .update({
          user_category:     category || null,
          tax_category:      category || null,
          category_label:    category ? (TAX_CATEGORY_MAP[category]?.label ?? null) : null,
          user_note:         note.trim() || null,
          manually_reviewed: true,
        })
        .eq('id', row.id)

      if (error) throw error

      toast.success('분류가 수정되었습니다')
      onSaved(row.id, category, note.trim())
      onOpenChange(false)
    } catch (err) {
      console.error(err)
      toast.error('저장 중 오류가 발생했습니다')
    } finally {
      setSaving(false)
    }
  }

  if (!row) return null

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">거래 분류 수정</DialogTitle>
        </DialogHeader>

        {/* Transaction info */}
        <div className="rounded-lg bg-slate-50 p-3 text-sm">
          <p className="font-medium text-slate-800 truncate">{row.description}</p>
          <p className={`mt-0.5 font-semibold ${row.amount >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
            {row.amount >= 0 ? '+' : ''}{row.amount.toLocaleString('ko-KR')}원
          </p>
          {row.ai_reason && (
            <p className="mt-1.5 text-xs text-slate-500">
              <span className="font-medium">AI 판단:</span> {row.ai_reason}
            </p>
          )}
        </div>

        {/* Category selector */}
        <div className="space-y-1.5">
          <Label className="text-sm">세금 분류 코드</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="분류 선택" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {GROUPS.map((group) => (
                <div key={group.label}>
                  <div className="px-2 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    {group.label}
                  </div>
                  {group.codes.map((code) => (
                    <SelectItem key={code} value={code} className="text-sm">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] px-1 py-0 font-mono">{code}</Badge>
                        {TAX_CATEGORY_MAP[code]?.label ?? code}
                      </div>
                    </SelectItem>
                  ))}
                </div>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Note field */}
        <div className="space-y-1.5">
          <Label className="text-sm">메모 <span className="text-slate-400 text-xs">(선택)</span></Label>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="예: 업무용 노트북 구입, 영수증 보관 완료"
            rows={3}
            className="text-sm resize-none"
          />
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>
            취소
          </Button>
          <Button size="sm" onClick={save} disabled={saving || !category}>
            {saving ? (
              <span className="flex items-center gap-1.5">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                저장 중
              </span>
            ) : '저장'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
