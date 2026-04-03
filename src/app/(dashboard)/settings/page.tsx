'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import {
  User, CreditCard, Bell, Briefcase,
  Zap, ExternalLink, RotateCcw, Loader2,
  CheckCircle, AlertTriangle, Shield
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProfileData {
  id: string
  email: string
  full_name: string | null
  business_name: string | null
  business_number: string | null
  business_type: string
  is_simplified_tax: boolean
  annual_revenue_tier: string
  plan: 'free' | 'pro' | 'business'
  stripe_customer_id: string | null
  monthly_classify_count: number
  monthly_classify_reset_at: string
  notification_email: boolean
  notification_kakao: boolean
  referral_code: string | null
  free_months_remaining: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PLAN_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  free:     { label: 'Free',     color: 'text-slate-600',  bg: 'bg-slate-100' },
  pro:      { label: 'Pro',      color: 'text-blue-700',   bg: 'bg-blue-100'  },
  business: { label: 'Business', color: 'text-purple-700', bg: 'bg-purple-100' },
}

const PLAN_MONTHLY_LIMITS: Record<string, number> = {
  free: 5,
  pro:  -1,  // unlimited
  business: -1,
}

const BUSINESS_TYPES = [
  { value: 'creator',    label: '크리에이터/유튜버' },
  { value: 'freelancer', label: '프리랜서' },
  { value: 'consultant', label: '컨설턴트' },
  { value: 'influencer', label: '인플루언서' },
  { value: 'other',      label: '기타' },
]

const REVENUE_TIERS = [
  { value: 'under_50m',    label: '5천만원 미만' },
  { value: '50m_150m',     label: '5천만원 ~ 1.5억원' },
  { value: 'over_150m',    label: '1.5억원 이상' },
]

// ─── Usage meter ──────────────────────────────────────────────────────────────

function UsageMeter({ count, plan }: { count: number; plan: string }) {
  const limit = PLAN_MONTHLY_LIMITS[plan] ?? 5
  if (limit === -1) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <CheckCircle className="h-4 w-4 text-green-500" />
        <span className="text-slate-600">이번 달 사용량: <strong>{count}회</strong> (무제한)</span>
      </div>
    )
  }
  const pct = Math.min(100, Math.round((count / limit) * 100))
  const barColor = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-blue-500'
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-sm">
        <span className="text-slate-600">이번 달 AI 분류 사용량</span>
        <span className={`font-semibold ${pct >= 90 ? 'text-red-600' : 'text-slate-700'}`}>
          {count} / {limit}회
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-slate-100">
        <div className={`h-2 rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      {pct >= 90 && (
        <p className="text-xs text-red-600 flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          한도에 거의 도달했습니다. 업그레이드를 권장합니다.
        </p>
      )}
    </div>
  )
}

// ─── Main settings page ───────────────────────────────────────────────────────

export default function SettingsPage() {
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [billingLoading, setBillingLoading] = useState<'checkout-pro' | 'checkout-business' | 'portal' | null>(null)

  // Profile edit state
  const [fullName,      setFullName]      = useState('')
  const [businessName,  setBusinessName]  = useState('')
  const [businessNumber,setBusinessNumber]= useState('')
  const [businessType,  setBusinessType]  = useState('creator')
  const [revenueTier,   setRevenueTier]   = useState('under_50m')

  // Notification state
  const [notifEmail, setNotifEmail] = useState(true)
  const [notifKakao, setNotifKakao] = useState(false)

  const loadProfile = useCallback(async () => {
    setLoading(true)
    try {
      const supabase = createClient() as any
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('users_profile')
        .select('*')
        .eq('id', user.id)
        .single()

      if (data) {
        setProfile(data)
        setFullName(data.full_name ?? '')
        setBusinessName(data.business_name ?? '')
        setBusinessNumber(data.business_number ?? '')
        setBusinessType(data.business_type ?? 'creator')
        setRevenueTier(data.annual_revenue_tier ?? 'under_50m')
        setNotifEmail(data.notification_email ?? true)
        setNotifKakao(data.notification_kakao ?? false)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadProfile() }, [loadProfile])

  async function saveProfile() {
    if (!profile) return
    setSaving(true)
    const supabase = createClient() as any
    try {
      const { error } = await supabase.from('users_profile').update({
        full_name:     fullName,
        business_name: businessName,
        business_number: businessNumber,
        business_type: businessType,
        annual_revenue_tier: revenueTier,
      }).eq('id', profile.id)

      if (error) throw error
      toast.success('프로필이 저장되었습니다')
      loadProfile()
    } catch {
      toast.error('저장에 실패했습니다')
    } finally {
      setSaving(false)
    }
  }

  async function saveNotifications() {
    if (!profile) return
    setSaving(true)
    const supabase = createClient() as any
    try {
      const { error } = await supabase.from('users_profile').update({
        notification_email: notifEmail,
        notification_kakao: notifKakao,
      }).eq('id', profile.id)
      if (error) throw error
      toast.success('알림 설정이 저장되었습니다')
    } catch {
      toast.error('저장에 실패했습니다')
    } finally {
      setSaving(false)
    }
  }

  async function openCheckout(plan: 'pro' | 'business') {
    setBillingLoading(`checkout-${plan}` as any)
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? '오류 발생'); return }
      window.location.href = data.url
    } catch { toast.error('네트워크 오류') }
    finally { setBillingLoading(null) }
  }

  async function openPortal() {
    setBillingLoading('portal')
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? '오류 발생'); return }
      window.location.href = data.url
    } catch { toast.error('네트워크 오류') }
    finally { setBillingLoading(null) }
  }

  if (loading || !profile) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    )
  }

  const planInfo = PLAN_LABELS[profile.plan] ?? PLAN_LABELS.free
  const isPaid   = profile.plan !== 'free'

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-6 sm:px-0">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">설정</h1>
        <p className="mt-1 text-sm text-slate-500">프로필, 결제, 알림 설정을 관리하세요.</p>
      </div>

      <Tabs defaultValue="profile">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="profile"  className="flex items-center gap-1.5 text-xs sm:text-sm">
            <User      className="h-3.5 w-3.5" /><span className="hidden sm:inline">프로필</span>
          </TabsTrigger>
          <TabsTrigger value="billing"  className="flex items-center gap-1.5 text-xs sm:text-sm">
            <CreditCard className="h-3.5 w-3.5" /><span className="hidden sm:inline">결제</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-1.5 text-xs sm:text-sm">
            <Bell      className="h-3.5 w-3.5" /><span className="hidden sm:inline">알림설정</span>
          </TabsTrigger>
          <TabsTrigger value="advisor"  className="flex items-center gap-1.5 text-xs sm:text-sm">
            <Briefcase className="h-3.5 w-3.5" /><span className="hidden sm:inline">세무사</span>
          </TabsTrigger>
        </TabsList>

        {/* ── 프로필 탭 ─────────────────────────────────────────────────── */}
        <TabsContent value="profile" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">기본 정보</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>이메일</Label>
                <Input value={profile.email} disabled className="bg-slate-50 text-slate-500" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="full-name">이름</Label>
                <Input
                  id="full-name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="홍길동"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="business-name">사업체명 / 채널명</Label>
                <Input
                  id="business-name"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="홍길동의 유튜브 채널"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="business-number">사업자등록번호 (선택)</Label>
                <Input
                  id="business-number"
                  value={businessNumber}
                  onChange={(e) => setBusinessNumber(e.target.value)}
                  placeholder="123-45-67890"
                  maxLength={12}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>업종</Label>
                  <select
                    value={businessType}
                    onChange={(e) => setBusinessType(e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {BUSINESS_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>연 매출 구간</Label>
                  <select
                    value={revenueTier}
                    onChange={(e) => setRevenueTier(e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {REVENUE_TIERS.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Referral code */}
          {profile.referral_code && (
            <Card className="border-amber-200 bg-amber-50/50">
              <CardContent className="pt-4">
                <p className="text-sm font-medium text-amber-800 mb-1">내 추천인 코드</p>
                <div className="flex items-center gap-2">
                  <code className="rounded bg-amber-100 px-3 py-1.5 text-lg font-mono font-bold text-amber-900">
                    {profile.referral_code}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-amber-300"
                    onClick={() => {
                      navigator.clipboard.writeText(profile.referral_code!)
                      toast.success('코드가 복사되었습니다')
                    }}
                  >
                    복사
                  </Button>
                </div>
                {profile.free_months_remaining > 0 && (
                  <p className="mt-2 text-xs text-amber-700">
                    🎁 무료 혜택 <strong>{profile.free_months_remaining}개월</strong> 남음
                  </p>
                )}
                <p className="mt-1 text-xs text-amber-600">
                  친구가 이 코드로 구독하면 다음 달 1개월 무료 제공!
                </p>
              </CardContent>
            </Card>
          )}

          <Button className="w-full" onClick={saveProfile} disabled={saving}>
            {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />저장 중…</> : '변경사항 저장'}
          </Button>
        </TabsContent>

        {/* ── 결제 탭 ───────────────────────────────────────────────────── */}
        <TabsContent value="billing" className="mt-4 space-y-4">
          {/* Current plan card */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">현재 플랜</CardTitle>
                <Badge className={`${planInfo.bg} ${planInfo.color} font-semibold`}>
                  {planInfo.label}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <UsageMeter count={profile.monthly_classify_count} plan={profile.plan} />

              {profile.plan === 'free' && (
                <p className="text-xs text-slate-500">
                  초기화 예정:{' '}
                  {new Date(
                    new Date(profile.monthly_classify_reset_at).getFullYear(),
                    new Date(profile.monthly_classify_reset_at).getMonth() + 1,
                    1
                  ).toLocaleDateString('ko-KR')}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Upgrade section */}
          {profile.plan === 'free' && (
            <Card className="border-blue-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Zap className="h-4 w-4 text-yellow-500" />
                  플랜 업그레이드
                </CardTitle>
                <CardDescription>더 많은 기능을 무제한으로 사용하세요</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border-2 border-blue-200 bg-blue-50 p-4">
                    <div className="font-bold text-blue-900 text-lg">Pro</div>
                    <div className="text-2xl font-extrabold text-blue-700 mt-1">$39<span className="text-sm font-normal">/월</span></div>
                    <ul className="mt-3 space-y-1 text-xs text-blue-800">
                      <li>✓ AI 분류 무제한</li>
                      <li>✓ 홈택스 내보내기 무제한</li>
                      <li>✓ 주간 리포트 이메일</li>
                      <li>✓ PDF 보고서 생성</li>
                    </ul>
                    <Button
                      className="w-full mt-3 bg-blue-600 hover:bg-blue-700 text-white text-sm"
                      size="sm"
                      onClick={() => openCheckout('pro')}
                      disabled={!!billingLoading}
                    >
                      {billingLoading === 'checkout-pro'
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : 'Pro로 시작하기'}
                    </Button>
                  </div>

                  <div className="rounded-lg border-2 border-purple-200 bg-purple-50 p-4">
                    <div className="font-bold text-purple-900 text-lg">Business</div>
                    <div className="text-2xl font-extrabold text-purple-700 mt-1">$99<span className="text-sm font-normal">/월</span></div>
                    <ul className="mt-3 space-y-1 text-xs text-purple-800">
                      <li>✓ Pro 모든 기능 포함</li>
                      <li>✓ 세무사 파트너 매칭</li>
                      <li>✓ 무제한 AI 최적화</li>
                      <li>✓ 우선 고객 지원</li>
                    </ul>
                    <Button
                      className="w-full mt-3 bg-purple-600 hover:bg-purple-700 text-white text-sm"
                      size="sm"
                      variant="outline"
                      onClick={() => openCheckout('business')}
                      disabled={!!billingLoading}
                    >
                      {billingLoading === 'checkout-business'
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : 'Business로 시작하기'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Paid plan: billing portal + upgrade option */}
          {isPaid && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">구독 관리</CardTitle>
                <CardDescription>결제 수단 변경, 영수증 확인, 구독 취소</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={openPortal}
                  disabled={!!billingLoading}
                >
                  {billingLoading === 'portal' ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />이동 중…</>
                  ) : (
                    <><ExternalLink className="mr-2 h-4 w-4" />Paddle 결제 포털 열기</>
                  )}
                </Button>

                {profile.plan === 'pro' && (
                  <>
                    <Separator />
                    <div className="text-center">
                      <p className="text-sm text-slate-500 mb-2">Business 플랜으로 업그레이드</p>
                      <Button
                        size="sm"
                        className="bg-purple-600 hover:bg-purple-700 text-white"
                        onClick={() => openCheckout('business')}
                        disabled={!!billingLoading}
                      >
                        Business로 업그레이드 — $99/월
                      </Button>
                    </div>
                  </>
                )}

                <p className="text-center text-xs text-slate-400">
                  구독 취소 시 당월 말까지 서비스가 유지됩니다.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Security note */}
          <div className="flex items-center gap-2 text-xs text-slate-500 justify-center">
            <Shield className="h-3.5 w-3.5" />
            결제는 Paddle(Merchant of Record)을 통해 256-bit TLS 암호화로 안전하게 처리됩니다. 한국 VAT는 Paddle이 자동 처리합니다.
          </div>
        </TabsContent>

        {/* ── 알림설정 탭 ───────────────────────────────────────────────── */}
        <TabsContent value="notifications" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">알림 채널 설정</CardTitle>
              <CardDescription>절세 기회 발견, 마감일 임박, 세법 변경 알림을 받으세요.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Email toggle */}
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <div className="font-medium text-sm">이메일 알림</div>
                  <div className="text-xs text-slate-500">
                    절세 기회, 마감일 알림, 주간 리포트를 이메일로 받습니다.
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={notifEmail}
                  onClick={() => setNotifEmail(!notifEmail)}
                  className={`relative h-6 w-11 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 ${
                    notifEmail ? 'bg-blue-600' : 'bg-slate-200'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                      notifEmail ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Kakao toggle */}
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <div className="font-medium text-sm flex items-center gap-2">
                    카카오 알림톡
                    <Badge variant="secondary" className="text-xs">Beta</Badge>
                  </div>
                  <div className="text-xs text-slate-500">
                    카카오 비즈메시지로 실시간 알림을 받습니다. (카카오 연동 필요)
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={notifKakao}
                  onClick={() => setNotifKakao(!notifKakao)}
                  className={`relative h-6 w-11 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 ${
                    notifKakao ? 'bg-yellow-400' : 'bg-slate-200'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                      notifKakao ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Notification types info */}
              <div className="rounded-lg bg-slate-50 p-4 space-y-2">
                <p className="text-xs font-medium text-slate-700">알림 종류</p>
                {[
                  { label: '절세 기회 발견',   desc: 'AI가 공제 가능 항목을 감지하면 즉시 알림' },
                  { label: '세금 신고 마감 임박', desc: '신고 마감일 7일, 3일, 1일 전 알림' },
                  { label: '세법 변경 감지',    desc: '매월 1일 세법 변경사항 확인 후 알림' },
                  { label: '주간 리포트',       desc: '매주 월요일 오전 지난 주 요약 (Pro+)' },
                ].map((item) => (
                  <div key={item.label} className="flex gap-2">
                    <div className="mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-blue-400 mt-1.5" />
                    <div>
                      <span className="text-xs font-medium text-slate-700">{item.label}</span>
                      <span className="text-xs text-slate-500"> — {item.desc}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Button className="w-full" onClick={saveNotifications} disabled={saving}>
            {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />저장 중…</> : '알림 설정 저장'}
          </Button>
        </TabsContent>

        {/* ── 세무사연동 탭 ─────────────────────────────────────────────── */}
        <TabsContent value="advisor" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Briefcase className="h-4 w-4" />
                세무사 파트너 연동
              </CardTitle>
              <CardDescription>Business 플랜 전용 — 검증된 세무사와 직접 연결하세요.</CardDescription>
            </CardHeader>
            <CardContent>
              {profile.plan === 'business' ? (
                <div className="space-y-4">
                  {/* Placeholder for Business plan users */}
                  <div className="rounded-lg border-2 border-dashed border-slate-200 p-8 text-center">
                    <Briefcase className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                    <p className="font-medium text-slate-700">세무사 파트너 매칭</p>
                    <p className="mt-1 text-sm text-slate-500">
                      TaxFlow AI 파트너 세무사 네트워크를 통해<br />
                      전문가와 연결됩니다. 곧 오픈 예정!
                    </p>
                    <Button variant="outline" className="mt-4" disabled>
                      매칭 신청하기 (준비 중)
                    </Button>
                  </div>
                  <div className="rounded-lg bg-green-50 border border-green-200 p-4">
                    <p className="text-sm font-medium text-green-800 mb-2">Business 플랜 혜택</p>
                    <ul className="space-y-1 text-xs text-green-700">
                      <li>✓ TaxFlow AI 제휴 세무사와 할인 상담</li>
                      <li>✓ 거래내역 자동 공유 (세무사 동의 시)</li>
                      <li>✓ 세금 신고 대행 서비스 연계</li>
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border-2 border-dashed border-slate-200 p-8 text-center">
                  <Briefcase className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                  <p className="font-semibold text-slate-700">Business 플랜 전용 기능</p>
                  <p className="mt-1 text-sm text-slate-500">
                    검증된 세무사와의 직접 연동은 Business 플랜에서만 제공됩니다.
                  </p>
                  <Button
                    className="mt-4 bg-purple-600 hover:bg-purple-700 text-white"
                    onClick={() => openCheckout('business')}
                    disabled={!!billingLoading}
                  >
                    {billingLoading === 'checkout-business' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Business로 업그레이드'
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
