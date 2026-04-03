/**
 * @file src/app/onboarding/page.tsx
 * @description TaxFlow AI — 3단계 온보딩
 * 완료 시 notification_setup_done=false 저장 + /dashboard?welcome=1 redirect
 */
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createBrowserSupabase } from '@/lib/supabase/auth-helpers'

type BizType = 'youtuber'|'streamer'|'freelance_designer'|'freelance_developer'|'freelance_writer'|'photographer'|'other_creator'
type RevRange = 'under_30m'|'30m_80m'|'80m_150m'|'over_150m'

const TYPES = [
  { v:'youtuber' as BizType,            label:'유튜버',           icon:'▶️' },
  { v:'streamer' as BizType,            label:'스트리머',          icon:'🎮' },
  { v:'freelance_designer' as BizType,  label:'프리랜서 디자이너', icon:'🎨' },
  { v:'freelance_developer' as BizType, label:'프리랜서 개발자',   icon:'💻' },
  { v:'freelance_writer' as BizType,    label:'작가 / 번역가',     icon:'✍️' },
  { v:'photographer' as BizType,        label:'사진작가 / 영상PD', icon:'📷' },
  { v:'other_creator' as BizType,       label:'기타 크리에이터',   icon:'✨' },
]
const REVENUES = [
  { v:'under_30m' as RevRange, label:'3천만원 미만' },
  { v:'30m_80m' as RevRange,   label:'3천만 ~ 8천만원' },
  { v:'80m_150m' as RevRange,  label:'8천만 ~ 1억 5천만원' },
  { v:'over_150m' as RevRange, label:'1억 5천만원 초과' },
]

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState<1|2|3>(1)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [form, setForm] = useState({ businessType: '' as BizType|'', fullName: '', isSimplifiedVat: false, revenueRange: '' as RevRange|'' })

  const s1ok = !!form.businessType
  const s2ok = !!form.revenueRange && form.fullName.trim().length >= 2
  const recBiz = form.revenueRange === '80m_150m' || form.revenueRange === 'over_150m'

  async function handleComplete() {
    setSaving(true); setErr('')
    const sb = createBrowserSupabase()
    const { data: { user }, error: ae } = await sb.auth.getUser()
    if (ae || !user) { router.replace('/login'); return }
    const { error: ue } = await sb.from('profiles').upsert({
      id: user.id, full_name: form.fullName.trim(),
      business_type: form.businessType, is_simplified_vat: form.isSimplifiedVat,
      revenue_range: form.revenueRange, onboarding_completed: true,
      notification_setup_done: false, plan: 'free',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' })
    if (ue) { setErr('저장에 실패했습니다. 잠시 후 다시 시도해 주세요.'); setSaving(false); return }
    router.replace('/dashboard?welcome=1')
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="mb-8">
          <div className="flex gap-2 mb-2">
            {([1,2,3] as const).map(s => (
              <div key={s} className={`flex-1 h-1.5 rounded-full transition-colors ${s <= step ? 'bg-blue-600' : 'bg-gray-800'}`} />
            ))}
          </div>
          <p className="text-center text-xs text-gray-500">{step} / 3 단계</p>
        </div>

        {step === 1 && (
          <div>
            <h2 className="text-2xl font-bold text-center mb-2">어떤 크리에이터인가요?</h2>
            <p className="text-gray-400 text-sm text-center mb-7">업종에 맞는 공제 항목을 자동으로 적용합니다.</p>
            <div className="grid grid-cols-2 gap-3 mb-7">
              {TYPES.map(t => (
                <button key={t.v} onClick={() => setForm(f => ({ ...f, businessType: t.v }))}
                  className={`rounded-xl border p-4 text-left transition-all ${form.businessType === t.v ? 'border-blue-500 bg-blue-500/10' : 'border-gray-700 bg-gray-900 hover:border-gray-500'}`}>
                  <div className="text-2xl mb-2">{t.icon}</div>
                  <div className="text-sm font-medium">{t.label}</div>
                </button>
              ))}
            </div>
            <button onClick={() => setStep(2)} disabled={!s1ok}
              className="w-full rounded-lg bg-blue-600 py-3 font-semibold hover:bg-blue-500 disabled:opacity-40 transition-colors text-sm">
              다음
            </button>
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 className="text-2xl font-bold text-center mb-2">사업자 기본 정보</h2>
            <p className="text-gray-400 text-sm text-center mb-7">세금 예측 정확도를 높이기 위한 참고 정보입니다.</p>
            <div className="space-y-5 mb-7">
              <div>
                <label htmlFor="name" className="block text-sm text-gray-300 mb-1">이름 <span className="text-gray-500">(닉네임 가능)</span></label>
                <input id="name" type="text" maxLength={50} value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))}
                  className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-white text-sm focus:border-blue-500 focus:outline-none"
                  placeholder="홍길동 또는 채널명" />
              </div>
              <div>
                <p className="text-sm text-gray-300 mb-2">예상 연간 수입 구간</p>
                <div className="grid grid-cols-2 gap-2">
                  {REVENUES.map(r => (
                    <button key={r.v} onClick={() => setForm(f => ({ ...f, revenueRange: r.v }))}
                      className={`rounded-lg border p-3 text-sm transition-all ${form.revenueRange === r.v ? 'border-blue-500 bg-blue-500/10 text-white' : 'border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-500'}`}>
                      {r.label}
                    </button>
                  ))}
                </div>
                {recBiz && <p className="text-xs text-purple-400 mt-2">👑 연 8천만원 이상은 Business 플랜 세무사 상담이 도움이 될 가능성이 있습니다. (참고용)</p>}
              </div>
              <div className="rounded-xl border border-gray-700 bg-gray-900 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">간이과세자 여부</p>
                    <p className="text-xs text-gray-500 mt-0.5">연매출 4,800만원 미만 + 간이과세자 등록</p>
                  </div>
                  <button role="switch" aria-checked={form.isSimplifiedVat}
                    onClick={() => setForm(f => ({ ...f, isSimplifiedVat: !f.isSimplifiedVat }))}
                    className={`relative w-12 h-6 rounded-full transition-colors ${form.isSimplifiedVat ? 'bg-blue-600' : 'bg-gray-700'}`}>
                    <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${form.isSimplifiedVat ? 'translate-x-7' : 'translate-x-1'}`} />
                  </button>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="flex-1 rounded-lg border border-gray-700 py-3 font-semibold hover:bg-gray-800 transition-colors text-sm">이전</button>
              <button onClick={() => setStep(3)} disabled={!s2ok} className="flex-1 rounded-lg bg-blue-600 py-3 font-semibold hover:bg-blue-500 disabled:opacity-40 transition-colors text-sm">다음</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h2 className="text-2xl font-bold text-center mb-2">거의 다 됐어요!</h2>
            <p className="text-gray-400 text-sm text-center mb-6">대시보드에서 CSV를 업로드하면 AI 분류가 바로 시작됩니다.</p>
            <div className="rounded-xl border border-blue-500/40 bg-blue-950/30 p-5 mb-4">
              <div className="flex items-center justify-between mb-3">
                <p className="font-bold text-white text-sm">⚡ Pro 혜택 (참고용)</p>
                <span className="text-xs text-green-400 font-semibold">첫 달 19,500원</span>
              </div>
              <ul className="space-y-1.5 mb-4">
                {['무제한 AI 거래 분류 (Free: 월 5회)','실시간 카카오 절세 알림','홈택스 신고 파일 자동 생성','영수증 OCR + 증빙 저장소'].map(f => (
                  <li key={f} className="flex items-start gap-2 text-xs text-blue-100">
                    <span className="text-blue-400 mt-0.5 flex-shrink-0">✓</span>{f}
                  </li>
                ))}
              </ul>
              <Link href="/signup?plan=pro" className="block w-full rounded-lg bg-blue-600 hover:bg-blue-500 py-2.5 text-center text-sm font-bold text-white transition-colors">
                첫 달 19,500원으로 Pro 시작하기
              </Link>
            </div>
            <div className={`rounded-xl border p-4 mb-5 ${recBiz ? 'border-purple-500/60 bg-purple-950/40' : 'border-purple-500/20 bg-purple-950/20'}`}>
              <div className="flex items-center justify-between mb-3">
                <p className="font-bold text-white text-sm">👑 Business 혜택</p>
                {recBiz && <span className="text-xs text-purple-300 bg-purple-900/60 px-2 py-0.5 rounded font-semibold">추천</span>}
              </div>
              <ul className="space-y-1.5 mb-4">
                {['Pro 전체 기능 포함','세무사 상담 신청 버튼','다중 계정 관리 (최대 5개)'].map(f => (
                  <li key={f} className="flex items-start gap-2 text-xs text-purple-100">
                    <span className="text-purple-400 mt-0.5 flex-shrink-0">👑</span>{f}
                  </li>
                ))}
              </ul>
              <Link href="/signup?plan=business" className="block w-full rounded-lg bg-purple-600 hover:bg-purple-500 py-2.5 text-center text-sm font-bold text-white transition-colors">
                Business 시작하기 (첫 달 44,500원)
              </Link>
            </div>
            <p className="text-xs text-gray-600 text-center mb-4">※ 참고용 AI 코치입니다. 최종 신고는 세무사와 함께 확인하세요.</p>
            {err && <p role="alert" className="text-sm text-red-400 bg-red-950/40 rounded-lg px-4 py-2 mb-4">{err}</p>}
            <div className="flex gap-3">
              <button onClick={() => setStep(2)} className="flex-1 rounded-lg border border-gray-700 py-3 font-semibold hover:bg-gray-800 transition-colors text-sm">이전</button>
              <button onClick={handleComplete} disabled={saving} className="flex-1 rounded-lg bg-gray-700 hover:bg-gray-600 py-3 font-semibold transition-colors disabled:opacity-50 text-sm">
                {saving ? '저장 중...' : '무료로 시작하기'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
