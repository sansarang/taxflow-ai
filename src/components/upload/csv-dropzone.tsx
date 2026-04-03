'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useDropzone } from 'react-dropzone'
import { toast } from 'sonner'
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'

const SUPPORTED_BANKS = ['KB국민', '신한', '카카오뱅크', '우리', '하나', 'IBK기업', 'NH농협', '토스뱅크']

type Stage = 'idle' | 'reading' | 'uploading' | 'done' | 'error'

interface UploadState {
  stage: Stage
  progress: number
  fileName: string
  bankName: string
  totalRows: number
  batchId: string
  errorMessage: string
}

const INITIAL_STATE: UploadState = {
  stage: 'idle', progress: 0, fileName: '', bankName: '', totalRows: 0, batchId: '', errorMessage: '',
}

const STAGE_LABELS: Record<Stage, string> = {
  idle: '', reading: '파일 읽는 중...', uploading: '거래 내역 분석 중...', done: '업로드 완료!', error: '오류 발생',
}

export function CsvDropzone() {
  const router = useRouter()
  const [state, setState] = useState<UploadState>(INITIAL_STATE)
  const reset = () => setState(INITIAL_STATE)

  const uploadFile = useCallback(async (file: File) => {
    setState({ ...INITIAL_STATE, stage: 'reading', progress: 15, fileName: file.name })
    const formData = new FormData()
    formData.append('file', file)
    setState((s) => ({ ...s, stage: 'uploading', progress: 40 }))

    try {
      const res = await fetch('/api/parse-csv', { method: 'POST', body: formData })
      setState((s) => ({ ...s, progress: 80 }))
      const data = await res.json()

      if (!res.ok) {
        const message = data.error ?? '알 수 없는 오류가 발생했습니다'
        setState((s) => ({ ...s, stage: 'error', progress: 100, errorMessage: message }))
        toast.error(message, { description: data.details?.join('\n') ?? data.hint })
        return
      }

      setState((s) => ({ ...s, stage: 'done', progress: 100, bankName: data.bankName, totalRows: data.savedRows, batchId: data.batchId }))

      if (data.parseErrors?.length) {
        toast.warning(`${data.parseErrors.length}개 행을 건너뛰었습니다`, { description: '일부 행의 형식이 올바르지 않아 제외되었습니다.' })
      } else {
        toast.success(`${data.savedRows}건 업로드 완료`, { description: `${data.bankName} · ${data.periodStart} ~ ${data.periodEnd}` })
      }

      setTimeout(() => { router.push(`/transactions?batch=${data.batchId}`) }, 1200)
    } catch (err) {
      console.error('[csv-dropzone] upload error:', err)
      const message = '네트워크 오류가 발생했습니다. 다시 시도해 주세요.'
      setState((s) => ({ ...s, stage: 'error', progress: 100, errorMessage: message }))
      toast.error(message)
    }
  }, [router])

  const onDrop = useCallback(
    (accepted: File[], rejected: import('react-dropzone').FileRejection[]) => {
      if (rejected.length > 0) {
        const reason = rejected[0].errors[0]?.message ?? '파일을 확인해 주세요'
        toast.error('업로드할 수 없는 파일입니다', { description: reason })
        return
      }
      if (accepted.length > 0) uploadFile(accepted[0])
    },
    [uploadFile]
  )

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.csv', '.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'text/plain': ['.csv'],
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024,
    disabled: state.stage === 'reading' || state.stage === 'uploading',
  })

  const isLoading = state.stage === 'reading' || state.stage === 'uploading'

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={cn(
          'relative flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-10 transition-all duration-200',
          isDragActive && !isDragReject && 'border-blue-400 bg-blue-50 scale-[1.01]',
          isDragReject && 'border-red-400 bg-red-50',
          !isDragActive && state.stage === 'idle' && 'border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50',
          state.stage === 'done' && 'border-green-300 bg-green-50',
          state.stage === 'error' && 'border-red-300 bg-red-50',
          isLoading && 'cursor-not-allowed border-blue-200 bg-blue-50',
        )}
      >
        <input {...getInputProps()} />

        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
          {isLoading && <Loader2 className="h-7 w-7 animate-spin text-blue-500" />}
          {state.stage === 'done' && <CheckCircle2 className="h-7 w-7 text-green-500" />}
          {state.stage === 'error' && <AlertCircle className="h-7 w-7 text-red-500" />}
          {state.stage === 'idle' && (
            isDragActive
              ? <FileText className="h-7 w-7 text-blue-500" />
              : <Upload className="h-7 w-7 text-slate-400" />
          )}
        </div>

        {state.stage === 'idle' && (
          <>
            <p className="text-center text-sm font-medium text-slate-700">
              {isDragActive ? '여기에 놓으세요' : '거래내역 파일을 여기에 드래그하거나 클릭하여 업로드'}
            </p>
            <p className="mt-1.5 text-center text-xs text-slate-400">
              CSV · Excel(XLSX/XLS) 지원 · 최대 10MB · EUC-KR / UTF-8 자동 감지
            </p>
          </>
        )}

        {isLoading && <p className="text-sm font-medium text-blue-700">{STAGE_LABELS[state.stage]}</p>}

        {state.stage === 'done' && (
          <div className="text-center">
            <p className="text-sm font-semibold text-green-700">업로드 완료!</p>
            <p className="mt-0.5 text-xs text-green-600">
              {state.bankName} · {state.totalRows.toLocaleString()}건 · 거래 내역으로 이동 중...
            </p>
          </div>
        )}

        {state.stage === 'error' && (
          <div className="flex flex-col items-center gap-2 text-center">
            <p className="text-sm font-medium text-red-700">{state.errorMessage}</p>
            <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); reset() }}>
              <X className="mr-1.5 h-3.5 w-3.5" />
              다시 시도
            </Button>
          </div>
        )}
      </div>

      {state.stage !== 'idle' && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-slate-500">
            <span>{state.fileName}</span>
            <span>{state.progress}%</span>
          </div>
          <Progress
            value={state.progress}
            className={cn(
              'h-1.5 transition-all',
              state.stage === 'done' && '[&>div]:bg-green-500',
              state.stage === 'error' && '[&>div]:bg-red-500',
            )}
          />
        </div>
      )}

      <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
        <p className="mb-2 text-xs font-medium text-slate-500">지원 은행 · CSV 및 Excel 모두 지원</p>
        <div className="flex flex-wrap gap-1.5">
          {SUPPORTED_BANKS.map((bank) => (
            <Badge key={bank} className="bg-white text-xs font-normal text-slate-600 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50">
              {bank}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  )
}