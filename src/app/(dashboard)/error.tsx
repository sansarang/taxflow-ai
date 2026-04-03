'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { AlertTriangle, RotateCcw } from 'lucide-react'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Dashboard Error]', error)
  }, [error])

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-20 px-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100">
        <AlertTriangle className="h-7 w-7 text-red-600" />
      </div>
      <div>
        <h2 className="text-lg font-bold text-slate-900">페이지를 불러오지 못했습니다</h2>
        <p className="mt-1 text-sm text-slate-500">
          일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.
        </p>
        {error.digest && (
          <p className="mt-1 font-mono text-[10px] text-slate-400">오류 코드: {error.digest}</p>
        )}
      </div>
      <Button onClick={reset} size="sm" className="gap-2">
        <RotateCcw className="h-3.5 w-3.5" /> 다시 시도
      </Button>
      <p className="max-w-sm text-xs text-slate-400 leading-relaxed">
        ⚠️ TaxFlow AI는 참고용 AI 코치입니다. 세금 신고는 반드시 사용자가 직접 또는 세무사와
        확인하세요.
      </p>
    </div>
  )
}
