'use client'

import { Progress } from '@/components/ui/progress'

interface UploadProgressProps {
  progress: number
  stage: 'parsing' | 'classifying' | 'saving' | 'done'
}

const STAGE_LABELS: Record<UploadProgressProps['stage'], string> = {
  parsing: 'CSV 파싱 중...',
  classifying: 'AI 분류 중...',
  saving: '저장 중...',
  done: '완료!',
}

export function UploadProgress({ progress, stage }: UploadProgressProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-600">{STAGE_LABELS[stage]}</span>
        <span className="font-medium text-slate-900">{progress}%</span>
      </div>
      <Progress value={progress} className="h-2" />
    </div>
  )
}
