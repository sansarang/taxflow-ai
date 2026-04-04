import os

files = {}

# ─── src/app/page.tsx ─────────────────────────────────────────────────────────
files['src/app/page.tsx'] = '''
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '세금비서 — 한국 크리에이터·1인사업자 AI 세금 코치',
  description: '매달 3.3% 세금 걱정 끝. AI가 거래내역을 분석하고 놓친 공제를 찾아드립니다. 첫 달 50% 할인.',
  openGraph: {
    title: '세금비서',
    description: '한국 크리에이터·1인사업자를 위한 실시간 AI 세금 코치',
    siteName: '세금비서',
  },
}

const PAIN_POINTS = [
  { emoji: '😫', title: '거래내역 정리가 귀찮다', desc: 'CSV 한 번 올리면 AI가 자동 분류' },
  { emoji: '😭', title: '공제 놓쳐서 후회한다', desc: '놓친 공제 항목 자동 감지 & 알림' },
  { emoji: '😰', title: '신고 기간이 너무 불안하다', desc: '분기별 예정신고 자동 알림' },
  { emoji: '🤯', title: '증빙 자료 찾기 번거롭다', desc: '사진 OCR로 영수증 즉시 등록' },
  { emoji: '🤔', title: '이번 달 세금이 얼마인지 모른다', desc: '실시간 세금 예측 대시보드' },
]

const PRICING = [
  {
    name: 'Free',
    price: '0원',
    sub: '월 5회 무료',
    color: 'border-gray-200',
    btn: 'bg-gray-100 text-gray-800',
    features: ['월 5회 거래 분류', '기본 세금 계산', '이메일 알림'],
    cta: '무료로 시작',
    href: '/signup',
    badge: null,
  },
  {
    name: 'Pro',
    price: '39,000원',
    firstMonth: '첫 달 19,500원',
    sub: '/월',
    color: 'border-blue-500 ring-2 ring-blue-500',
    btn: 'bg-blue-600 text-white hover:bg-blue-700',
    features: ['무제한 거래 분류', 'AI 공제 최적화', '사진 OCR', '분기 예정신고 알림', '주간 리포트'],
    cta: '첫 달 50% 할인',
    href: '/signup?plan=pro',
    badge: '가장 인기',
  },
  {
    name: 'Business',
    price: '89,000원',
    firstMonth: '첫 달 44,500원',
    sub: '/월',
    color: 'border-purple-500',
    btn: 'bg-purple-600 text-white hover:bg-purple-700',
    features: ['Pro 전체 포함', '세무사 연동', 'PDF 신고서 생성', '우선 고객지원', '팀원 초대(3명)'],
    cta: '첫 달 50% 할인',
    href: '/signup?plan=business',
    badge: null,
  },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Header */}
      <header className="fixed top-0 w-full bg-white/90 backdrop-blur border-b border-gray-100 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <span className="text-xl font-bold text-blue-600">세금비서</span>
          <nav className="hidden md:flex items-center gap-6 text-sm text-gray-600">
            <a href="#pain" className="hover:text-blue-600">불편함 해결</a>
            <a href="#pricing" className="hover:text-blue-600">요금제</a>
            <Link href="/demo" className="hover:text-blue-600">무료 체험</Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-gray-600 hover:text-blue-600">로그인</Link>
            <Link href="/demo" className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700">
              회원가입 없이 체험하기
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-32 pb-20 px-4 text-center bg-gradient-to-b from-blue-50 to-white">
        <div className="max-w-4xl mx-auto">
          <div className="inline-block bg-red-100 text-red-700 text-sm font-semibold px-4 py-1.5 rounded-full mb-6">
            🔥 이번 달 놓친 공제 평균 <span className="text-red-800 font-bold">34만 원</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-black leading-tight mb-6">
            3.3% 세금,<br />
            <span className="text-blue-600">AI 비서</span>한테 맡기세요
          </h1>
          <p className="text-xl text-gray-600 mb-4">
            거래내역 올리면 → 자동 분류 → 놓친 공제 발견 → 세금 예측까지<br />
            한국 크리에이터·1인사업자 전용 실시간 세금 AI 코치
          </p>
          <p className="text-sm text-gray-500 mb-10">삼쩜삼은 신고만 해줍니다. 세금비서는 <strong>매달 절세</strong>를 도와줍니다.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/demo"
              className="bg-blue-600 text-white text-lg font-bold px-10 py-4 rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-200"
            >
              🎯 회원가입 없이 체험하기
            </Link>
            <Link
              href="/signup?plan=pro"
              className="bg-white border-2 border-blue-600 text-blue-600 text-lg font-bold px-10 py-4 rounded-xl hover:bg-blue-50"
            >
              첫 달 19,500원으로 시작
            </Link>
          </div>
          <p className="text-xs text-gray-400 mt-4">신용카드 없이 체험 가능 · 언제든 해지 가능</p>
        </div>
      </section>

      {/* FOMO 배너 */}
      <section className="bg-red-600 text-white py-4 px-4 text-center">
        <p className="text-sm font-semibold">
          ⚡ 지금 가입하면 첫 달 50% 할인 + 공제 누락 분석 리포트 무료 제공
          <Link href="/signup?plan=pro" className="ml-3 underline font-bold">지금 바로 →</Link>
        </p>
      </section>

      {/* Pain Points */}
      <section id="pain" className="py-20 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-black text-center mb-4">이런 불편함, 저만 느끼는 건가요?</h2>
          <p className="text-center text-gray-500 mb-12">세금비서가 5가지 불편함을 한번에 해결합니다</p>
          <div className="grid md:grid-cols-5 gap-6">
            {PAIN_POINTS.map((p) => (
              <div key={p.title} className="text-center p-6 rounded-2xl bg-gray-50 hover:bg-blue-50 transition">
                <div className="text-4xl mb-3">{p.emoji}</div>
                <h3 className="font-bold text-sm mb-2">{p.title}</h3>
                <p className="text-xs text-blue-600 font-semibold">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 삼쩜삼 vs 세금비서 */}
      <section className="py-20 px-4 bg-gray-50">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-black text-center mb-12">삼쩜삼 vs 세금비서</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2">
                  <th className="py-3 text-left">기능</th>
                  <th className="py-3 text-center text-gray-400">삼쩜삼</th>
                  <th className="py-3 text-center text-blue-600 font-black">세금비서</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['연간 신고 대행', '✅', '✅'],
                  ['매달 실시간 절세 코치', '❌', '✅'],
                  ['거래내역 자동 분류', '❌', '✅'],
                  ['놓친 공제 자동 감지', '❌', '✅'],
                  ['사진 OCR 영수증 등록', '❌', '✅'],
                  ['이번 달 세금 예측', '❌', '✅'],
                  ['가격', '건당 수수료', '월 39,000원~'],
                ].map(([feat, a, b]) => (
                  <tr key={feat} className="border-b hover:bg-white">
                    <td className="py-3 font-medium">{feat}</td>
                    <td className="py-3 text-center text-gray-400">{a}</td>
                    <td className="py-3 text-center text-blue-600 font-bold">{b}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-4 bg-white">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-black text-center mb-4">요금제</h2>
          <p className="text-center text-gray-500 mb-12">첫 달 50% 할인 · 언제든 해지</p>
          <div className="grid md:grid-cols-3 gap-8">
            {PRICING.map((p) => (
              <div key={p.name} className={`relative rounded-2xl border-2 p-8 ${p.color}`}>
                {p.badge && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-bold px-4 py-1.5 rounded-full">
                    {p.badge}
                  </div>
                )}
                <h3 className="text-xl font-black mb-1">{p.name}</h3>
                <div className="text-3xl font-black mb-1">{p.price}<span className="text-base font-normal text-gray-500">{p.sub}</span></div>
                {p.firstMonth && (
                  <div className="text-red-600 font-bold text-sm mb-4">🔥 {p.firstMonth}</div>
                )}
                <ul className="space-y-2 mb-8">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm">
                      <span className="text-blue-500">✓</span> {f}
                    </li>
                  ))}
                </ul>
                <Link href={p.href} className={`block text-center py-3 rounded-xl font-bold transition ${p.btn}`}>
                  {p.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 bg-blue-600 text-white text-center">
        <h2 className="text-3xl font-black mb-4">지금 바로 시작하세요</h2>
        <p className="text-blue-100 mb-8">회원가입 없이도 체험 가능 · 첫 달 50% 할인</p>
        <Link href="/demo" className="bg-white text-blue-600 font-black text-lg px-10 py-4 rounded-xl hover:bg-blue-50 inline-block">
          🎯 무료로 체험하기
        </Link>
      </section>

      {/* Footer */}
      <footer className="py-10 px-4 bg-gray-900 text-gray-400 text-sm text-center">
        <p className="font-bold text-white mb-2">세금비서</p>
        <p>한국 크리에이터·1인사업자를 위한 AI 세금 코치</p>
        <p className="mt-2 text-xs">⚠️ 본 서비스는 참고용 AI 코치입니다. 실제 신고는 공인 세무사와 상담하세요.</p>
        <p className="mt-4 text-xs">© 2026 세금비서. All rights reserved.</p>
      </footer>
    </div>
  )
}
'''

# ─── src/app/demo/page.tsx ────────────────────────────────────────────────────
files['src/app/demo/page.tsx'] = '''
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
'''

# ─── src/app/layout.tsx 브랜딩 패치 ──────────────────────────────────────────
layout_path = 'src/app/layout.tsx'
if os.path.exists(layout_path):
    content = open(layout_path).read()
    content = content.replace('TaxFlow AI', '세금비서')
    content = content.replace('taxflow', '세금비서')
    open(layout_path, 'w').write(content)
    print(f'patched {layout_path}')

for path, content in files.items():
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content.lstrip())
    print(f'OK {path}')

print('All done')