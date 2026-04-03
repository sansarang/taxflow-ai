'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import {
  Camera, Pen, Code, BookOpen, Film, User,
  CheckCircle2, ChevronRight, ChevronLeft, Upload,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface JobType {
  value:       string
  label:       string
  icon:        React.ElementType
  description: string
  deductions:  string[]
}

const JOB_TYPES: JobType[] = [
  {
    value: 'creator',
    label: '유튜버/크리에이터',
    icon: Camera,
    description: '유튜브, 인스타그램, 틱톡 등 콘텐츠 크리에이터',
    deductions: ['장비비 (카메라, 조명, 마이크)', '편집 소프트웨어 구독', '스튜디오 임차료'],
  },
  {
    value: 'designer',
    label: '프리랜서 디자이너',
    icon: Pen,
    description: 'UI/UX, 그래픽, 브랜딩 디자인',
    deductions: ['Adobe CC, Figma 구독', '하드웨어 (모니터, 태블릿)', '교육비·강의비'],
  },
  {
    value: 'developer',
    label: '프리랜서 개발자',
    icon: Code,
    description: '소프트웨어 개발, 앱 개발, 웹 개발',
    deductions: ['소프트웨어·SaaS 구독', '업무용 통신비 50%', '교육비·기술서적'],
  },
  {
    value: 'writer',
    label: '작가/번역가',
    icon: BookOpen,
    description: '소설, 기사, 번역, 카피라이팅',
    deductions: ['도서·자료 구입비', '소프트웨어 (Scrivener 등)', '교육·세미나 참가비'],
  },
  {
    value: 'editor',
    label: '영상편집자',
    icon: Film,
    description: '유튜브·광고·영화 편집 전문',
    deductions: ['편집 소프트웨어 (Premiere, DaVinci)', '음악 라이선스 구입', '외장 하드·저장장치'],
  },
  {
    value: 'other',
    label: '기타 1인사업자',
    icon: User,
    description: '강사, 컨설턴트, 기타 프리랜서',
    deductions: ['업무용 교통비', '통신비 50%', '일반 사무용품'],
  },
]

// ─── Step 2 form schema ───────────────────────────────────────────────────────

const REVENUE_TIERS = [
  { value: 'under_30m',    label: '3천만 원 미만'         },
  { value: 'under_50m',    label: '3천만 ~ 5천만 원'      },
  { value: '50m_150m',     label: '5천만 ~ 1억5천만 원'   },
  { value: 'over_150m',    label: '1억5천만 원 이상'       },
]

const businessSchema = z.object({
  business_number: z.string().optional(),
  business_name:   z.string().optional(),
  revenue_tier:    z.string().min(1, '매출 구간을 선택해 주세요'),
  is_simplified:   z.string(),
})
type BusinessForm = z.infer<typeof businessSchema>

// ─── Step 3 bank guide data ────────────────────────────────────────────────────

const BANKS = [
  { name: 'KB국민은행',  path: '인터넷뱅킹 → 조회 → 거래내역 조회 → Excel 다운로드' },
  { name: '신한은행',    path: '인터넷뱅킹 → 조회/이체 → 거래내역 조회 → CSV' },
  { name: '우리은행',    path: '우리WON뱅킹 → 계좌 → 거래내역 → 내보내기' },
  { name: '하나은행',    path: '하나원큐 → 내 계좌 → 거래내역 → 엑셀 다운로드' },
  { name: '기업은행',    path: 'IBK기업은행 → 조회 → 거래내역 → CSV 저장' },
  { name: '농협은행',    path: 'NH스마트뱅킹 → 계좌 → 거래내역 → 내려받기' },
  { name: '카카오뱅크',  path: '카카오뱅크 앱 → 계좌 → 거래내역 전체보기 → 내보내기' },
  { name: '토스뱅크',   path: '토스 앱 → 계좌 → 거래 내역 → 파일로 내보내기' },
]

// ─── Step indicator ────────────────────────────────────────────────────────────

function StepDot({ step, current }: { step: number; current: number }) {
  const done   = current > step
  const active = current === step
  return (
    <div className={cn(
      'flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-colors',
      done   && 'bg-blue-600 text-white',
      active && 'bg-blue-600 text-white ring-4 ring-blue-100',
      !done && !active && 'bg-slate-100 text-slate-400',
    )}>
      {done ? <CheckCircle2 className="h-4 w-4" /> : step}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter()
  const [step,        setStep]        = useState(1)
  const [jobType,     setJobType]     = useState<string>('')
  const [saving,      setSaving]      = useState(false)

  const { register, handleSubmit, setValue, watch, formState: { errors } } =
    useForm<BusinessForm>({
      resolver: zodResolver(businessSchema),
      defaultValues: { revenue_tier: '', is_simplified: 'false' },
    })

  const revenueValue = watch('revenue_tier')

  // ── Complete onboarding ───────────────────────────────────────────────────

  const complete = useCallback(async () => {
    setSaving(true)
    try {
      const supabase = createClient() as any
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { toast.error('로그인이 필요합니다'); return }

      const values = watch()
      await supabase.from('users_profile').update({
        business_type:         jobType,
        business_name:         values.business_name || null,
        business_number:       values.business_number || null,
        annual_revenue_tier:   values.revenue_tier || 'under_50m',
        is_simplified_tax:     values.is_simplified === 'true',
        onboarding_completed:  true,
      }).eq('id', user.id)

      toast.success('설정이 완료되었습니다!')
      router.push('/upload')
    } catch {
      toast.error('저장 중 오류가 발생했습니다')
    } finally {
      setSaving(false)
    }
  }, [jobType, router, watch])

  const onStep2Submit = () => setStep(3)

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <main className="flex min-h-screen items-start justify-center bg-gradient-to-b from-slate-50 to-white px-4 py-10">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white text-base font-bold mx-auto">
            T
          </div>
          <h1 className="text-2xl font-bold text-slate-900">TaxFlow AI 시작하기</h1>
          <p className="mt-1 text-sm text-slate-500">맞춤형 세금 코칭을 위해 기본 정보를 입력해주세요</p>
        </div>

        {/* Step indicator */}
        <div className="mb-8 flex items-center justify-center gap-3">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-3">
              <StepDot step={s} current={step} />
              {s < 3 && (
                <div className={cn(
                  'h-px w-12 transition-colors',
                  step > s ? 'bg-blue-600' : 'bg-slate-200'
                )} />
              )}
            </div>
          ))}
        </div>

        {/* ── STEP 1: Job type ─────────────────────────────────────────── */}
        {step === 1 && (
          <div>
            <h2 className="mb-1 text-lg font-semibold text-slate-900">업종을 선택해주세요</h2>
            <p className="mb-5 text-sm text-slate-500">업종에 맞는 공제 항목을 자동으로 추천해드립니다</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {JOB_TYPES.map((jt) => {
                const Icon    = jt.icon
                const selected = jobType === jt.value
                return (
                  <button
                    key={jt.value}
                    type="button"
                    onClick={() => setJobType(jt.value)}
                    className={cn(
                      'flex flex-col items-start gap-2 rounded-xl border-2 p-4 text-left transition-all',
                      selected
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50'
                    )}
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className={cn(
                        'flex h-9 w-9 items-center justify-center rounded-lg',
                        selected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'
                      )}>
                        <Icon className="h-4.5 w-4.5" />
                      </div>
                      {selected && <CheckCircle2 className="h-4 w-4 text-blue-600" />}
                    </div>
                    <div>
                      <p className={cn(
                        'text-sm font-semibold',
                        selected ? 'text-blue-800' : 'text-slate-800'
                      )}>
                        {jt.label}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">{jt.description}</p>
                    </div>
                    {/* Top 3 deductions */}
                    <ul className="mt-1 space-y-1">
                      {jt.deductions.map((d) => (
                        <li key={d} className="flex items-start gap-1.5 text-[11px] text-slate-500">
                          <span className={cn(
                            'mt-0.5 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full',
                            selected ? 'bg-blue-500' : 'bg-slate-300'
                          )} />
                          {d}
                        </li>
                      ))}
                    </ul>
                  </button>
                )
              })}
            </div>
            <div className="mt-6 flex justify-end">
              <Button
                onClick={() => setStep(2)}
                disabled={!jobType}
                className="gap-2"
              >
                다음 단계
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 2: Business info ─────────────────────────────────────── */}
        {step === 2 && (
          <form onSubmit={handleSubmit(onStep2Submit)}>
            <h2 className="mb-1 text-lg font-semibold text-slate-900">사업자 정보 입력</h2>
            <p className="mb-5 text-sm text-slate-500">정확한 세금 계산을 위해 사업자 정보를 입력해주세요</p>

            <div className="space-y-4">
              {/* Business number */}
              <div className="space-y-1.5">
                <Label className="text-sm">사업자등록번호 <span className="text-slate-400 text-xs">(선택)</span></Label>
                <Input
                  {...register('business_number')}
                  placeholder="000-00-00000"
                  className="h-9 text-sm"
                />
              </div>

              {/* Business name */}
              <div className="space-y-1.5">
                <Label className="text-sm">상호명 <span className="text-slate-400 text-xs">(선택)</span></Label>
                <Input
                  {...register('business_name')}
                  placeholder="예: 홍길동 스튜디오"
                  className="h-9 text-sm"
                />
              </div>

              {/* Revenue tier */}
              <div className="space-y-1.5">
                <Label className="text-sm">
                  연 매출 구간 <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={revenueValue}
                  onValueChange={(v) => setValue('revenue_tier', v, { shouldValidate: true })}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="매출 구간을 선택하세요" />
                  </SelectTrigger>
                  <SelectContent>
                    {REVENUE_TIERS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.revenue_tier && (
                  <p className="text-xs text-red-500">{errors.revenue_tier.message}</p>
                )}
              </div>

              {/* Simplified tax payer */}
              <div className="rounded-lg border border-slate-200 p-4">
                <p className="mb-3 text-sm font-medium text-slate-800">간이과세자 여부</p>
                <div className="flex gap-3">
                  {[
                    { val: 'false', label: '일반과세자' },
                    { val: 'true',  label: '간이과세자 (연매출 1억400만 원 미만)' },
                  ].map(({ val, label }) => (
                    <label key={val} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        {...register('is_simplified')}
                        value={val}
                        className="accent-blue-600"
                      />
                      <span className="text-sm text-slate-700">{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-between">
              <Button type="button" variant="outline" onClick={() => setStep(1)} className="gap-2">
                <ChevronLeft className="h-4 w-4" /> 이전
              </Button>
              <Button type="submit" className="gap-2">
                다음 단계 <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </form>
        )}

        {/* ── STEP 3: Bank guide ────────────────────────────────────────── */}
        {step === 3 && (
          <div>
            <h2 className="mb-1 text-lg font-semibold text-slate-900">은행 거래내역 CSV 내보내기</h2>
            <p className="mb-5 text-sm text-slate-500">
              거래내역 CSV 파일을 업로드하면 AI가 자동으로 분류합니다
            </p>

            <div className="space-y-2">
              {BANKS.map((bank, i) => (
                <div
                  key={bank.name}
                  className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3.5"
                >
                  <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-700">
                    {i + 1}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{bank.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{bank.path}</p>
                  </div>
                  {/* Screenshot placeholder */}
                  <div className="ml-auto flex-shrink-0 h-8 w-12 rounded border border-dashed border-slate-200 bg-slate-50 flex items-center justify-center">
                    <span className="text-[8px] text-slate-300">이미지</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 p-3">
              <p className="text-xs text-amber-700">
                💡 <strong>팁:</strong> 최근 3~6개월 거래내역을 내보내면 더 정확한 분류를 받을 수 있습니다.
                EUC-KR 인코딩으로 저장된 파일도 자동 처리됩니다.
              </p>
            </div>

            <div className="mt-6 flex justify-between">
              <Button type="button" variant="outline" onClick={() => setStep(2)} className="gap-2">
                <ChevronLeft className="h-4 w-4" /> 이전
              </Button>
              <Button onClick={complete} disabled={saving} className="gap-2">
                {saving ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    저장 중...
                  </span>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    CSV 업로드 시작하기
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
