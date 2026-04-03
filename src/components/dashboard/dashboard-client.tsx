/**
 * @file src/components/dashboard/dashboard-client.tsx
 * @description TaxFlow AI — 대시보드 Client Component (완전판)
 *
 * 새 기능 1: "3~4시간 vs 3분" 체감 메시지
 * 새 기능 2: 가입 직후 환영 모달 + 1클릭 알림 설정
 * 불편함 3: 예상 세금 위젯 + D-day
 * 불편함 4: 증빙 자료 탭
 * 패턴 분석 → 개인화 업그레이드 메시지
 * Business: 세무사 상담 버튼
 * 모바일 완벽 반응형
 */
'use client'
import { useState, useRef } from 'react'
import Link from 'next/link'
import { signOutUser, createBrowserSupabase } from '@/lib/supabase/auth-helpers'

const FREE_LIMIT   = 5
const PRO_CHECKOUT = '/api/checkout?plan=pro&ref=dashboard'
const BIZ_CHECKOUT = '/api/checkout?plan=business&ref=dashboard'
const UPGRADE_URL  = '/pricing?ref=dashboard'
const TAX_ADVISOR  = process.env.NEXT_PUBLIC_TAX_ADVISOR_FORM_URL ?? 'https://forms.gle/XXXXXXXXXX'

function personalizedMsg(usage: number, history: any[], missedEst: number): string | null {
  const recent = history.reduce((s, u) => s + ((u.count as number) ?? 0), 0)
  if (usage >= FREE_LIMIT) return `이번 달 무료 ${FREE_LIMIT}회를 모두 사용하셨습니다. Pro로 전환하면 놓친 공제 약 ${missedEst.toLocaleString()}원을 바로 확인할 수 있어요.`
  if (usage >= FREE_LIMIT - 1) return `무료 한도가 1회 남았습니다. Pro로 전환하면 무제한 + 실시간 카카오 알림을 받으실 수 있습니다. (첫 달 19,500원)`
  if (recent >= 8) return `최근 활발하게 사용하고 계시네요! Pro 업그레이드하면 실시간 알림으로 공제를 즉시 안내받을 가능성이 있습니다. (첫 달 19,500원)`
  return null
}

interface Props {
  user: { id: string; email: string }
  profile: { full_name?: string|null; business_type?: string|null; plan?: string|null; is_simplified_vat?: boolean|null; notification_setup_done?: boolean|null }
  recentTransactions: any[]; recentAlerts: any[]; taxSummary: any[]
  monthlyUsage: number; receipts: any[]; usageHistory: any[]; isFirstVisit: boolean
}

export default function DashboardClient({ user, profile, recentTransactions, recentAlerts, taxSummary, monthlyUsage, receipts, usageHistory, isFirstVisit }: Props) {
  const [signingOut, setSigningOut] = useState(false)
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [showWelcome, setShowWelcome] = useState(isFirstVisit)
  const [notiLoading, setNotiLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview'|'receipts'>('overview')
  const [uploading, setUploading] = useState(false)
  const receiptRef = useRef<HTMLInputElement>(null)

  const plan = (profile?.plan as string) ?? 'free'
  const isFree = plan === 'free', isPro = plan === 'pro', isBiz = plan === 'business'
  const remaining = Math.max(0, FREE_LIMIT - monthlyUsage)
  const usagePct  = Math.min(100, (monthlyUsage / FREE_LIMIT) * 100)
  const atLimit   = isFree && remaining === 0
  const nearLimit = isFree && remaining <= 1
  const displayName = profile?.full_name ?? user.email.split('@')[0]

  const income      = taxSummary.filter(t => t.tax_category?.startsWith('1')).reduce((s, t) => s + Math.abs(t.amount ?? 0), 0)
  const deductible  = taxSummary.filter(t => t.is_deductible).reduce((s, t) => s + Math.abs(t.amount ?? 0), 0)
  const estVat      = Math.round(Math.max(0, (income - deductible) * 0.1))
  const estTax      = Math.round(Math.max(0, (income - deductible) * 0.15))
  const missedCount = taxSummary.filter(t => t.risk_flags?.includes('review_needed')).length
  const missedEst   = Math.round(taxSummary.filter(t => t.risk_flags?.includes('review_needed')).reduce((s, t) => s + Math.abs(t.amount ?? 0), 0) * 0.15)
  const pMsg = isFree ? personalizedMsg(monthlyUsage, usageHistory, missedEst) : null

  const today = new Date(), yr = today.getFullYear()
  const deadlines = [
    { label:'부가세 1기 예정신고', date:new Date(`${yr}-04-25`), desc:'1~3월' },
    { label:'종합소득세 확정신고', date:new Date(`${yr}-05-31`), desc:`${yr-1}년 귀속` },
    { label:'부가세 1기 확정신고', date:new Date(`${yr}-07-25`), desc:'1~6월' },
    { label:'부가세 2기 예정신고', date:new Date(`${yr}-10-25`), desc:'7~9월' },
  ]
  const dDay = (d: Date) => Math.ceil((d.getTime() - today.getTime()) / 86_400_000)
  const nextDL = deadlines.filter(d => dDay(d.date) >= 0).sort((a, b) => dDay(a.date) - dDay(b.date))[0]

  async function markNotificationDone(type: 'kakao'|'email') {
    setNotiLoading(true)
    await createBrowserSupabase().from('profiles')
      .update({ notification_setup_done: true, notification_type: type, updated_at: new Date().toISOString() })
      .eq('id', user.id).catch(() => {})
    setNotiLoading(false); setShowWelcome(false)
  }

  async function handleReceiptUpload(file: File) {
    setUploading(true)
    const fd = new FormData(); fd.append('file', file); fd.append('userId', user.id)
    await fetch('/api/receipts/upload', { method: 'POST', body: fd }).catch(() => {})
    setUploading(false)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3.5 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2 flex-shrink-0">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm">T</div>
            <span className="font-bold text-gray-900 text-sm hidden sm:block">TaxFlow AI</span>
          </Link>
          <div className="flex items-center gap-2">
            {isBiz && <a href={TAX_ADVISOR} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-purple-600 hover:bg-purple-500 px-2.5 py-1.5 text-xs font-semibold text-white transition-colors hidden sm:block">👑 세무사 상담</a>}
            {isFree && <Link href={UPGRADE_URL} className="rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 transition-colors">Pro 업그레이드</Link>}
            <span className={`text-xs px-2 py-1 rounded-full hidden sm:block ${isBiz?'bg-purple-100 text-purple-700 font-semibold':isPro?'bg-blue-100 text-blue-700 font-semibold':'bg-gray-100 text-gray-500'}`}>
              {isBiz?'Business':isPro?'Pro':'Free'}
            </span>
            <span className="text-sm text-gray-700 max-w-[90px] truncate hidden sm:block">{displayName}</span>
            <button onClick={() => { setSigningOut(true); signOutUser() }} disabled={signingOut} className="text-sm text-gray-400 hover:text-red-500 disabled:opacity-50 transition-colors">
              {signingOut?'...':'로그아웃'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-3 sm:space-y-4">
        {/* Disclaimer */}
        <div className="flex items-start gap-2 rounded-xl border border-yellow-300 bg-yellow-50 px-3 py-2.5">
          <span className="text-yellow-600 flex-shrink-0 mt-0.5 text-xs">⚠️</span>
          <p className="text-xs sm:text-sm text-yellow-800"><strong>TaxFlow AI는 참고용 AI 코치입니다.</strong> 최종 신고는 홈택스 직접 또는 세무사와 확인하세요.</p>
        </div>

        {/* 새 기능 1: 시간 절약 체감 */}
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs sm:text-sm text-blue-800 font-medium">
            ⏱️ 이 서비스를 안 쓰면 매달 세금 정리에 <strong>3~4시간</strong>이 걸립니다. TaxFlow AI로 <strong>3분</strong>으로 줄이세요.
          </p>
          {isFree && <button onClick={() => setShowUpgrade(true)} className="flex-shrink-0 text-xs text-blue-600 hover:underline font-semibold">Pro로 더 빠르게 →</button>}
        </div>

        {/* Business 세무사 배너 */}
        {isBiz && (
          <div className="rounded-xl border border-purple-400/50 bg-gradient-to-r from-purple-950/60 to-purple-900/40 p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="font-bold text-white text-sm">👑 세무사 상담 신청 (Business 전용)</p>
                <p className="text-purple-200 text-xs mt-0.5">복잡한 세금 문제는 전문가와 상담. 영업일 1~2일 내 연락. (참고용)</p>
              </div>
              <a href={TAX_ADVISOR} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-purple-600 hover:bg-purple-500 px-4 py-2 text-xs sm:text-sm font-bold text-white transition-colors flex-shrink-0">상담 신청 →</a>
            </div>
          </div>
        )}

        {/* Free 사용량 바 */}
        {isFree && (
          <div className={`rounded-xl border p-3.5 ${atLimit?'border-red-300 bg-red-50':nearLimit?'border-orange-300 bg-orange-50':'border-blue-200 bg-blue-50'}`}>
            <div className="flex items-center justify-between mb-2 gap-2">
              <p className={`text-xs sm:text-sm font-semibold ${atLimit?'text-red-700':nearLimit?'text-orange-700':'text-blue-700'}`}>
                {atLimit?`⛔ 이번 달 무료 ${FREE_LIMIT}회를 모두 사용했습니다`:nearLimit?`⚡ 이번 달 ${remaining}회 남았습니다`:`이번 달 사용량: ${monthlyUsage} / ${FREE_LIMIT}회`}
              </p>
              <button onClick={() => setShowUpgrade(true)} className="text-xs font-semibold text-blue-600 hover:underline flex-shrink-0">Pro 전환 →</button>
            </div>
            <div className="h-1.5 rounded-full bg-gray-200 overflow-hidden">
              <div className={`h-full rounded-full transition-all ${atLimit?'bg-red-500':nearLimit?'bg-orange-500':'bg-blue-500'}`} style={{ width:`${usagePct}%` }} />
            </div>
          </div>
        )}

        {/* 개인화 메시지 */}
        {pMsg && (
          <div className="rounded-xl border border-blue-300 bg-blue-50 px-4 py-3 flex items-start justify-between gap-3">
            <p className="text-xs sm:text-sm text-blue-800">{pMsg}</p>
            <button onClick={() => setShowUpgrade(true)} className="flex-shrink-0 rounded-lg bg-blue-600 hover:bg-blue-500 px-3 py-1.5 text-xs font-bold text-white transition-colors">업그레이드</button>
          </div>
        )}

        {/* Pro Teaser */}
        {isFree && missedEst > 0 && (
          <div className="rounded-xl border border-blue-400 bg-gradient-to-r from-blue-950/60 to-blue-900/40 p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <p className="font-bold text-white text-sm sm:text-base mb-1">⚡ 이번 달 놓친 공제 가능성 {missedCount}건 — 약 <span className="text-yellow-300">{missedEst.toLocaleString()}원</span> (참고용)</p>
                <p className="text-blue-200 text-xs sm:text-sm">Pro로 전환하면 실시간 카카오 알림으로 즉시 안내받을 가능성이 있습니다. (참고용)</p>
              </div>
              <button onClick={() => setShowUpgrade(true)} className="rounded-lg bg-blue-500 hover:bg-blue-400 px-3 py-2 text-xs sm:text-sm font-bold text-white transition-colors flex-shrink-0 whitespace-nowrap">19,500원으로 시작</button>
            </div>
          </div>
        )}

        {/* 인사말 + 탭 */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-lg sm:text-2xl font-bold text-gray-900">{displayName}님의 세금 현황</h1>
            <p className="text-xs text-gray-500 mt-0.5">AI 분류 결과는 참고용입니다</p>
          </div>
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs sm:text-sm">
            <button onClick={() => setActiveTab('overview')} className={`px-3 sm:px-4 py-2 font-medium transition-colors ${activeTab==='overview'?'bg-blue-600 text-white':'bg-white text-gray-600 hover:bg-gray-50'}`}>개요</button>
            <button onClick={() => setActiveTab('receipts')} className={`px-3 sm:px-4 py-2 font-medium transition-colors flex items-center gap-1 ${activeTab==='receipts'?'bg-blue-600 text-white':'bg-white text-gray-600 hover:bg-gray-50'}`}>
              📷 증빙 {receipts.length > 0 && <span className={`text-xs rounded-full px-1 ${activeTab==='receipts'?'bg-blue-400 text-white':'bg-blue-100 text-blue-700'}`}>{receipts.length}</span>}
            </button>
          </div>
        </div>

        {activeTab === 'overview' && (
          <>
            {/* 예상 세금 위젯 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="col-span-2 rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
                <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                  <p className="text-xs sm:text-sm text-gray-500 font-medium">올해 예상 세금</p>
                  {nextDL && <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${dDay(nextDL.date)<=7?'bg-red-100 text-red-700':dDay(nextDL.date)<=30?'bg-yellow-100 text-yellow-700':'bg-gray-100 text-gray-600'}`}>{nextDL.label} D-{dDay(nextDL.date)}</span>}
                </div>
                <p className="text-2xl sm:text-3xl font-bold text-gray-900">₩{(estVat+estTax).toLocaleString()}원</p>
                <p className="text-xs text-gray-400 mt-1">소득세 {estTax.toLocaleString()}원 + 부가세 {estVat.toLocaleString()}원 (참고용)</p>
                {(isPro||isBiz) ? <Link href="/dashboard/tax-report" className="mt-2 inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">📁 신고 파일 미리보기 →</Link>
                  : <button onClick={() => setShowUpgrade(true)} className="mt-2 text-xs text-gray-400 hover:text-blue-600">🔒 신고 파일 미리보기 (Pro)</button>}
              </div>
              <SCard label="공제 가능 금액" badge="절세"  amount={deductible} sub="경비 처리 추산액" hl />
              <SCard label="예상 부가세"    badge="부가세" amount={estVat}     sub="매출-매입 추산" />
            </div>

            {/* 신고 일정 + 알림 */}
            <div className="grid sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
                <h2 className="font-bold text-gray-900 mb-4 text-sm">📅 세금 신고 일정</h2>
                <div className="space-y-3">
                  {deadlines.map((dl, i) => {
                    const d = dDay(dl.date); if (d < -30) return null
                    return (
                      <div key={i} className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-gray-800 truncate">{dl.label}</p>
                          <p className="text-xs text-gray-400">{dl.date.toLocaleDateString('ko-KR')} · {dl.desc}</p>
                        </div>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${d<=0?'bg-red-100 text-red-700':d<=7?'bg-orange-100 text-orange-700':d<=30?'bg-yellow-100 text-yellow-700':'bg-gray-100 text-gray-600'}`}>
                          {d<=0?'마감':`D-${d}`}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-gray-900 text-sm">🔔 알림</h2>
                  {isFree && <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">Pro: 카카오 실시간</span>}
                </div>
                {recentAlerts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-6 text-gray-400">
                    <span className="text-3xl mb-2">🔕</span>
                    <p className="text-sm">CSV 업로드 후 AI 분석을 시작하세요</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {recentAlerts.map(a => (
                      <div key={a.id} className={`rounded-lg p-2.5 ${a.priority==='high'?'bg-red-50 border border-red-200':a.priority==='medium'?'bg-yellow-50 border border-yellow-200':'bg-gray-50 border border-gray-200'}`}>
                        <p className="font-medium text-gray-900 text-xs">{a.title}</p>
                        <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">{a.message}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Pro 기능 미리보기 (Free) */}
            {isFree && (
              <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <h2 className="font-bold text-gray-900 text-sm">🔒 Pro / Business 전용 기능</h2>
                  <button onClick={() => setShowUpgrade(true)} className="rounded-lg bg-blue-600 hover:bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors">19,500원 시작 →</button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                  {[{icon:'📱',t:'실시간 카카오',d:'공제 즉시 푸시'},{icon:'📊',t:'주간 리포트',d:'매주 이메일'},{icon:'📁',t:'홈택스 파일',d:'CSV/XML 생성'},{icon:'📷',t:'영수증 OCR',d:'사진→자동 분류'}].map(f => (
                    <div key={f.t} className="relative rounded-xl border border-gray-100 bg-gray-50 p-3 sm:p-4 opacity-80">
                      <div className="absolute top-2 right-2 text-gray-300 text-xs">🔒</div>
                      <div className="text-xl sm:text-2xl mb-1 sm:mb-2">{f.icon}</div>
                      <p className="text-xs font-semibold text-gray-700">{f.t}</p>
                      <p className="text-xs text-gray-400 mt-0.5 hidden sm:block">{f.d}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 최근 거래 */}
            <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <h2 className="font-bold text-gray-900 text-sm">📋 최근 거래 내역</h2>
                {(isPro||isBiz) && (
                  <label className="cursor-pointer rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">
                    📷 영수증 추가
                    <input type="file" className="hidden" accept="image/*,.pdf" onChange={e => { const f = e.target.files?.[0]; if (f) handleReceiptUpload(f) }} />
                  </label>
                )}
              </div>
              {recentTransactions.length === 0 ? (
                <p className="text-center py-8 text-sm text-gray-400">CSV를 업로드하면 거래 내역이 표시됩니다.</p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {recentTransactions.map(tx => (
                    <div key={tx.id} className="flex items-center justify-between py-2.5 sm:py-3 gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs sm:text-sm font-medium text-gray-900 truncate">{tx.description}</p>
                        <p className="text-xs text-gray-400">{tx.date}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className={`text-xs sm:text-sm font-semibold ${(tx.amount??0)>0?'text-blue-600':'text-gray-900'}`}>
                          {(tx.amount??0)>0?'+':''}{(tx.amount??0).toLocaleString()}원
                        </p>
                        <div className="flex items-center gap-1 justify-end mt-0.5">
                          {tx.is_deductible && <span className="text-xs text-green-600 bg-green-50 px-1 py-0.5 rounded">공제</span>}
                          {tx.receipt_url && <a href={tx.receipt_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline">📎</a>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* 증빙 자료 탭 */}
        {activeTab === 'receipts' && (
          <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
            <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
              <div>
                <h2 className="font-bold text-gray-900 text-sm sm:text-base">📷 증빙 자료 모아보기</h2>
                <p className="text-xs text-gray-500 mt-0.5">영수증 사진 → OCR 자동 분석 → 거래별 자동 연결</p>
              </div>
              {(isPro||isBiz) ? (
                <label className={`cursor-pointer rounded-lg bg-blue-600 hover:bg-blue-500 px-4 py-2 text-xs sm:text-sm font-semibold text-white transition-colors ${uploading?'opacity-70':''}`}>
                  {uploading?'업로드 중...':'📷 영수증 추가'}
                  <input ref={receiptRef} type="file" className="hidden" accept="image/*,.pdf"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleReceiptUpload(f) }} disabled={uploading} />
                </label>
              ) : (
                <button onClick={() => setShowUpgrade(true)} className="rounded-lg bg-blue-600 hover:bg-blue-500 px-4 py-2 text-xs sm:text-sm font-semibold text-white transition-colors">🔒 Pro 전용</button>
              )}
            </div>
            {receipts.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <div className="text-5xl mb-3">📷</div>
                <p className="font-medium text-sm mb-1">아직 증빙 자료가 없습니다</p>
                <p className="text-xs">영수증 사진을 업로드하면 OCR로 자동 분석됩니다.</p>
                {isFree && <button onClick={() => setShowUpgrade(true)} className="mt-4 text-xs text-blue-500 hover:underline">Pro에서 영수증 OCR + 자동 연결 사용하기</button>}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {receipts.map(r => (
                  <div key={r.id} className="rounded-xl border border-gray-200 overflow-hidden">
                    <div className="aspect-square bg-gray-100">
                      {r.image_url
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={r.image_url} alt={r.description??'영수증'} className="w-full h-full object-cover" />
                        : <div className="flex items-center justify-center h-full text-3xl text-gray-400">📄</div>}
                    </div>
                    <div className="p-2">
                      <p className="text-xs font-medium text-gray-800 truncate">{r.description||'영수증'}</p>
                      {r.amount && <p className="text-xs text-gray-500">{r.amount.toLocaleString()}원</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* 새 기능 2: 환영 모달 + 1클릭 알림 설정 */}
      {showWelcome && (
        <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 px-4 pb-4 sm:pb-0">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md p-6 sm:p-8">
            <div className="text-center mb-6">
              <div className="text-5xl mb-3">🎉</div>
              <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">축하합니다!<br />이제 매달 자동으로 관리됩니다</h3>
              <p className="text-gray-400 text-sm leading-relaxed">아래에서 알림 방법을 선택하면 공제 누락 시 즉시 알림을 받을 수 있습니다.</p>
            </div>
            <div className="space-y-3 mb-5">
              <button onClick={() => markNotificationDone('kakao')} disabled={notiLoading}
                className="w-full rounded-xl bg-yellow-400 hover:bg-yellow-300 py-3.5 font-bold text-gray-900 transition-colors flex items-center justify-center gap-2 text-sm">
                <span>💬</span>{notiLoading?'설정 중...':'카카오톡 알림 바로 설정하기'}
              </button>
              <button onClick={() => markNotificationDone('email')} disabled={notiLoading}
                className="w-full rounded-xl bg-blue-600 hover:bg-blue-500 py-3 font-semibold text-white transition-colors flex items-center justify-center gap-2 text-sm">
                <span>📧</span>이메일 알림으로 설정하기
              </button>
            </div>
            <button onClick={() => setShowWelcome(false)} className="block w-full text-xs text-gray-500 hover:text-gray-400 text-center py-2">나중에 설정하기</button>
          </div>
        </div>
      )}

      {/* Pro 업그레이드 모달 */}
      {showUpgrade && (
        <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 px-4 pb-4 sm:pb-0"
          onClick={e => { if (e.target === e.currentTarget) setShowUpgrade(false) }}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6 sm:p-8">
            <div className="text-center mb-5">
              <div className="text-4xl mb-3">⚠️</div>
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">공제 기회를 놓치고 계십니다</h3>
              <p className="text-gray-500 text-sm leading-relaxed">Pro 사용자들은 실시간으로 놓친 공제를 카카오톡으로 받고 있습니다. 지금 업그레이드하면 <strong>첫 달 19,500원</strong>에 이용 가능합니다.</p>
            </div>
            <ul className="space-y-2 mb-5">
              {['무제한 AI 거래 분류','실시간 카카오/이메일 절세 알림','홈택스 신고 파일 자동 생성','영수증 OCR + 증빙 자료 저장','주간 절세 리포트'].map(f => (
                <li key={f} className="flex items-center gap-2 text-sm text-gray-700"><span className="text-blue-500">⚡</span>{f}</li>
              ))}
            </ul>
            <Link href={PRO_CHECKOUT} className="block w-full rounded-xl bg-blue-600 hover:bg-blue-500 py-3.5 text-center font-bold text-white transition-colors mb-3">
              19,500원으로 Pro 시작하기 (첫 달)
            </Link>
            <Link href={BIZ_CHECKOUT} className="block w-full rounded-xl border border-purple-400 text-purple-600 hover:bg-purple-50 py-2.5 text-center text-sm font-semibold transition-colors mb-3">
              👑 Business (세무사 상담 포함) — 44,500원
            </Link>
            <button onClick={() => setShowUpgrade(false)} className="block w-full text-xs text-gray-400 hover:text-gray-600 text-center py-2">나중에 하기</button>
          </div>
        </div>
      )}
    </div>
  )
}

function SCard({ label, badge, amount, sub, hl=false }: { label:string; badge:string; amount:number; sub:string; hl?:boolean }) {
  return (
    <div className={`rounded-xl border bg-white p-3 sm:p-5 ${hl?'border-green-300':'border-gray-200'}`}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-gray-500">{label}</p>
        <span className={`text-xs px-1.5 py-0.5 rounded ${hl?'bg-green-100 text-green-700':'bg-gray-100 text-gray-600'}`}>{badge}</span>
      </div>
      <p className={`text-lg sm:text-2xl font-bold ${hl?'text-green-700':'text-gray-900'}`}>₩{amount.toLocaleString()}원</p>
      <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
    </div>
  )
}
