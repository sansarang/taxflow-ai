'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'

const STORAGE_KEY = 'taxflow_disclaimer_dismissed_at'
const REDISPLAY_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

export function DisclaimerBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) {
        setVisible(true)
        return
      }
      const dismissedAt = Number(raw)
      if (Date.now() - dismissedAt > REDISPLAY_MS) {
        setVisible(true)
      }
    } catch {
      setVisible(true)
    }
  }, [])

  function dismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, String(Date.now()))
    } catch {}
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="mx-4 mt-4 flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 lg:mx-6">
      <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
      <p className="flex-1 text-xs leading-relaxed text-amber-800">
        <strong>⚠️ TaxFlow AI는 참고용 AI 코치입니다.</strong> 최종 세금 신고는 사용자가 직접
        홈택스에서 하거나 세무사와 확인하세요. AI 분류 결과는 오류를 포함할 수 있으며 법적 효력이
        없습니다.
      </p>
      <button
        type="button"
        onClick={dismiss}
        className="ml-1 flex-shrink-0 rounded p-0.5 text-amber-500 hover:bg-amber-100 hover:text-amber-700 transition-colors"
        aria-label="배너 닫기"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
