'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Lock, Zap, Check, X, Tag, Users, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Plan } from '@/types/user'

// ─── Plan feature comparison data ────────────────────────────────────────────

interface PlanFeature {
  label: string
  free: string | boolean
  pro: string | boolean
  business: string | boolean
}

const PLAN_FEATURES: PlanFeature[] = [
  {
    label: '거래내역 AI 분류',
    free: '월 5건',
    pro: '무제한',
    business: '무제한',
  },
  {
    label: 'AI 최적화 분석',
    free: '월 3회',
    pro: '월 30회',
    business: '무제한',
  },
  {
    label: '홈택스 내보내기',
    free: '월 1회',
    pro: '무제한',
    business: '무제한',
  },
  {
    label: '주간 리포트 이메일',
    free: false,
    pro: true,
    business: true,
  },
  {
    label: 'PDF 세금 보고서',
    free: false,
    pro: true,
    business: true,
  },
  {
    label: '카카오 알림톡',
    free: false,
    pro: true,
    business: true,
  },
  {
    label: '세무사 파트너 연동',
    free: false,
    pro: false,
    business: true,
  },
  {
    label: '우선 고객 지원',
    free: false,
    pro: false,
    business: true,
  },
]

const PLAN_PRICES = {
  pro:      { monthly: '$39', krw: '약 5.5만원' },
  business: { monthly: '$99', krw: '약 14만원' },
}

// ─── Plan order ───────────────────────────────────────────────────────────────

const PLAN_ORDER: Plan[] = ['free', 'pro', 'business']

function planRank(plan: Plan): number {
  return PLAN_ORDER.indexOf(plan)
}

// ─── Feature cell rendering ───────────────────────────────────────────────────

function FeatureCell({ value }: { value: string | boolean }) {
  if (value === true)  return <Check className="mx-auto h-4 w-4 text-green-600" />
  if (value === false) return <X    className="mx-auto h-4 w-4 text-slate-300" />
  return <span className="text-sm text-slate-700">{value}</span>
}

// ─── Upgrade modal ────────────────────────────────────────────────────────────

function UpgradeModal({
  open,
  onClose,
  requiredPlan,
  currentPlan,
}: {
  open: boolean
  onClose: () => void
  requiredPlan: Plan
  currentPlan: Plan
}) {
  const [referralCode, setReferralCode] = useState('')
  const [loadingPlan, setLoadingPlan]   = useState<'pro' | 'business' | null>(null)

  async function handleUpgrade(plan: 'pro' | 'business') {
    setLoadingPlan(plan)
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, referralCode: referralCode.trim() || undefined }),
      })
      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error ?? '결제 페이지 이동에 실패했습니다')
        return
      }

      window.location.href = data.url
    } catch {
      toast.error('네트워크 오류가 발생했습니다')
    } finally {
      setLoadingPlan(null)
    }
  }

  const recommendPlan: 'pro' | 'business' = requiredPlan === 'business' ? 'business' : 'pro'

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-900">
            <Zap className="h-5 w-5 text-yellow-500" />
            업그레이드로 잠금 해제
          </DialogTitle>
          <DialogDescription>
            {requiredPlan === 'pro'
              ? 'Pro 플랜으로 업그레이드하면 이 기능을 사용할 수 있습니다.'
              : 'Business 플랜 전용 기능입니다.'}
          </DialogDescription>
        </DialogHeader>

        {/* ── Plan comparison table ─────────────────────────────────────── */}
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="py-2 pr-4 text-left font-medium text-slate-600 w-1/3">기능</th>
                <th className="py-2 px-2 text-center font-medium text-slate-500">
                  <div>무료</div>
                  <div className="text-xs text-slate-400 font-normal">Free</div>
                </th>
                <th className={`py-2 px-2 text-center font-semibold rounded-t-lg ${
                  recommendPlan === 'pro' ? 'bg-blue-50 text-blue-700' : 'text-slate-700'
                }`}>
                  <div className="flex items-center justify-center gap-1">
                    Pro
                    {recommendPlan === 'pro' && (
                      <Badge className="text-[10px] bg-blue-600 text-white px-1 py-0">추천</Badge>
                    )}
                  </div>
                  <div className="text-xs font-normal">{PLAN_PRICES.pro.monthly}/월</div>
                </th>
                <th className={`py-2 px-2 text-center font-semibold rounded-t-lg ${
                  recommendPlan === 'business' ? 'bg-purple-50 text-purple-700' : 'text-slate-700'
                }`}>
                  <div className="flex items-center justify-center gap-1">
                    Business
                    {recommendPlan === 'business' && (
                      <Badge className="text-[10px] bg-purple-600 text-white px-1 py-0">추천</Badge>
                    )}
                  </div>
                  <div className="text-xs font-normal">{PLAN_PRICES.business.monthly}/월</div>
                </th>
              </tr>
            </thead>
            <tbody>
              {PLAN_FEATURES.map((feature) => (
                <tr key={feature.label} className="border-b border-slate-100 last:border-0">
                  <td className="py-2 pr-4 text-slate-700">{feature.label}</td>
                  <td className="py-2 px-2 text-center"><FeatureCell value={feature.free} /></td>
                  <td className={`py-2 px-2 text-center ${recommendPlan === 'pro' ? 'bg-blue-50/50' : ''}`}>
                    <FeatureCell value={feature.pro} />
                  </td>
                  <td className={`py-2 px-2 text-center ${recommendPlan === 'business' ? 'bg-purple-50/50' : ''}`}>
                    <FeatureCell value={feature.business} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── CTA buttons ──────────────────────────────────────────────── */}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {currentPlan === 'free' && (
            <Button
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold"
              onClick={() => handleUpgrade('pro')}
              disabled={!!loadingPlan}
            >
              {loadingPlan === 'pro' ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />처리 중…</>
              ) : (
                <>
                  <Zap className="mr-2 h-4 w-4" />
                  Pro로 업그레이드 — {PLAN_PRICES.pro.monthly}/월
                </>
              )}
            </Button>
          )}

          {(currentPlan === 'free' || currentPlan === 'pro') && (
            <Button
              variant={currentPlan === 'pro' ? 'default' : 'outline'}
              className={`w-full font-semibold ${
                currentPlan === 'pro'
                  ? 'bg-purple-600 hover:bg-purple-700 text-white'
                  : 'border-purple-300 text-purple-700 hover:bg-purple-50'
              }`}
              onClick={() => handleUpgrade('business')}
              disabled={!!loadingPlan}
            >
              {loadingPlan === 'business' ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />처리 중…</>
              ) : (
                `Business — ${PLAN_PRICES.business.monthly}/월`
              )}
            </Button>
          )}
        </div>

        {/* ── Referral code ─────────────────────────────────────────────── */}
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-2 text-amber-800 font-semibold text-sm mb-3">
            <Users className="h-4 w-4" />
            친구 초대 혜택
          </div>
          <p className="text-xs text-amber-700 mb-3">
            친구의 추천 코드를 입력하면 첫 달 50% 할인을 받을 수 있습니다.
            친구를 초대하면 다음 달 1개월 무료 제공!
          </p>
          <div className="flex gap-2">
            <div className="flex-1 space-y-1">
              <Label className="text-xs text-amber-800">추천인 코드 (선택)</Label>
              <div className="relative">
                <Tag className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-amber-500" />
                <Input
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value.trim().toUpperCase())}
                  placeholder="ABCD1234"
                  maxLength={8}
                  className="pl-8 text-sm h-8 border-amber-300 bg-white"
                />
              </div>
            </div>
          </div>
        </div>

        <p className="mt-2 text-center text-xs text-slate-400">
          결제는 Paddle을 통해 안전하게 처리됩니다 (Merchant of Record). 언제든지 취소 가능합니다.
        </p>
      </DialogContent>
    </Dialog>
  )
}

// ─── PlanGate — main export ───────────────────────────────────────────────────

interface PlanGateProps {
  requiredPlan: Plan
  children: React.ReactNode
  fallback?: React.ReactNode
}

/**
 * Wrap any feature that requires a paid plan.
 * If the user's current plan is insufficient, renders a lock overlay with an
 * upgrade modal instead of the children.
 */
export function PlanGate({ requiredPlan, children, fallback }: PlanGateProps) {
  const [currentPlan, setCurrentPlan] = useState<Plan>('free')
  const [isLoading,   setIsLoading]   = useState(true)
  const [showModal,   setShowModal]   = useState(false)

  useEffect(() => {
    const supabase = createClient() as any
    ;(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: profile } = await supabase
          .from('users_profile')
          .select('plan')
          .eq('id', user.id)
          .single()

        if (profile?.plan) setCurrentPlan(profile.plan as Plan)
      } finally {
        setIsLoading(false)
      }
    })()
  }, [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      </div>
    )
  }

  const hasAccess = planRank(currentPlan) >= planRank(requiredPlan)

  if (hasAccess) return <>{children}</>

  // Custom fallback provided by parent
  if (fallback) return <>{fallback}</>

  // Default: lock overlay
  return (
    <>
      <div
        className="relative cursor-pointer rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-8 text-center transition-colors hover:border-blue-300 hover:bg-blue-50/50"
        onClick={() => setShowModal(true)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && setShowModal(true)}
      >
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-200">
          <Lock className="h-6 w-6 text-slate-500" />
        </div>
        <p className="font-semibold text-slate-700">
          {requiredPlan === 'pro' ? 'Pro' : 'Business'} 플랜 전용 기능
        </p>
        <p className="mt-1 text-sm text-slate-500">
          클릭하여 업그레이드 옵션을 확인하세요
        </p>
        <div className="mt-4">
          <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
            <Zap className="mr-1.5 h-3.5 w-3.5" />
            업그레이드
          </Button>
        </div>
      </div>

      <UpgradeModal
        open={showModal}
        onClose={() => setShowModal(false)}
        requiredPlan={requiredPlan}
        currentPlan={currentPlan}
      />
    </>
  )
}
