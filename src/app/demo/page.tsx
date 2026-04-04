'use client'
import { useState } from 'react'
import Link from 'next/link'

const SAMPLE_RESULT = [
  { desc: '어도비 크리에이티브 클라우드', amount: -65000, category: '소프트웨어', deductible: true, confidence: 0.97 },
  { desc: '스타벅스 강남점', amount: -8500, category: '식비', deductible: false, confidence: 0.91 },
  { desc: '유튜브 프리미엄', amount: -14900, category: '플랫폼수수료', deductible: true, confidence: 0.95 },
  { desc: 'AWS 클라우드 서버', amount: -45000, category: '통신비', deductible: true, confidence: 0.98 },
  { desc: '카카오택시 업무출장', amount: -12000, category: '교통비', deductible: true, confidence: 0.82 },
  { desc: '쿠팡 조명장비', amount: -89000, category: '장비구입', deductible: true, confidence: 0.93 },
  { desc: '배달의민족', amount: -23000, category: '식비', deductible: false, confidence: 0.96 },
  { desc: 'Notion 구독', amount: -10000, category: '소프트웨어', deductible: true, confidence: 0.97 },
]

export default function DemoPage() {
  const [step, setStep] = useState<'intro' | 'result'>('intro')
  const [loading, setLoading] = useState(false)

  const deductibleTotal = SAMPLE_RESULT.filter(r => r.deductible).reduce((s, r) => s + Math.abs(r.amount), 0)
  const missedSaving = Math.round(deductibleTotal * 0.15)

  function handleDemo() {
    setLoading(true)
    setTimeout(() => { setLoading(false); setStep('result') }, 1800)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-4 h-14 flex items-center justify-between">
        <Link href="/" className="text-lg font-bold text-blue-600">세금비서</Link>
        <Link href="/signup" className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg">무료 시작</Link>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-12">
        {step === 'intro' && (
          <div className="text-center">
            <h1 className="text-3xl font-black mb-4">회원가입 없이 체험하기</h1>
            <p className="text-gray-500 mb-10">샘플 거래내역으로 AI 분석을 바로 경험해보세요</p>
            <div className="bg-white rounded-2xl border-2 border-dashed border-blue-300 p-12 mb-8">
              <div className="text-5xl mb-4">📊</div>
              <p className="font-bold mb-2">샘플 CSV (8개 거래내역)</p>
              <p className="text-sm text-gray-500 mb-6">실제 은행 거래내역과 동일한 형식</p>
              <button
                onClick={handleDemo}
                disabled={loading}
                className="bg-blue-600 text-white font-bold px-8 py-3 rounded-xl hover:bg-blue-700 disabled:opacity-60"
              >
                {loading ? '🤖 AI 분석 중...' : '🎯 샘플로 AI 분석 시작'}
              </button>
            </div>
            <p className="text-xs text-gray-400">실제 서비스에서는 본인 CSV + 사진 OCR 지원</p>
          </div>
        )}

        {step === 'result' && (
          <div>
            <div className="bg-red-50 border border-red-200 rounded-2xl p-6 mb-8 text-center">
              <p className="text-red-600 font-bold text-lg mb-1">
                🚨 이번 달 놓칠 뻔한 공제
              </p>
              <p className="text-4xl font-black text-red-700">{deductibleTotal.toLocaleString()}원</p>
              <p className="text-sm text-red-500 mt-1">절세 효과 약 <strong>{missedSaving.toLocaleString()}원</strong> (세율 15% 기준)</p>
            </div>

            <div className="bg-white rounded-2xl border overflow-hidden mb-8">
              <div className="px-6 py-4 border-b bg-gray-50">
                <h2 className="font-bold">AI 거래 분류 결과</h2>
              </div>
              <div className="divide-y">
                {SAMPLE_RESULT.map((r, i) => (
                  <div key={i} className="px-6 py-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{r.desc}</p>
                      <p className="text-xs text-gray-500">{r.category} · 신뢰도 {Math.round(r.confidence * 100)}%</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-sm">{r.amount.toLocaleString()}원</p>
                      <span className={`text-xs font-bold ${r.deductible ? 'text-green-600' : 'text-gray-400'}`}>
                        {r.deductible ? '✓ 공제가능' : '공제불가'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-blue-600 text-white rounded-2xl p-8 text-center">
              <h2 className="text-2xl font-black mb-2">본인 거래내역으로 분석하려면?</h2>
              <p className="text-blue-100 mb-6">첫 달 19,500원으로 무제한 분석 시작</p>
              <Link href="/signup?plan=pro" className="bg-white text-blue-600 font-black px-8 py-3 rounded-xl inline-block hover:bg-blue-50">
                첫 달 50% 할인으로 시작하기 →
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
