import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'AI 세금 최적화 — TaxFlow AI',
}

export default function OptimizePage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">AI 세금 최적화</h1>
      <p className="text-slate-500">Claude AI가 절세 전략을 분석하고 추천합니다</p>
      {/* Optimization content will be implemented */}
    </div>
  )
}
