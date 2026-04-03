'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Loader2, Mail, Lock, User, Tag, AlertCircle, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'

// ─── Validation schema ────────────────────────────────────────────────────────

const signupSchema = z
  .object({
    fullName: z.string().min(2, '이름은 2자 이상이어야 합니다'),
    email: z.string().email('올바른 이메일 주소를 입력하세요'),
    password: z
      .string()
      .min(8, '비밀번호는 8자 이상이어야 합니다')
      .regex(/[A-Za-z]/, '영문자를 포함해야 합니다')
      .regex(/[0-9]/, '숫자를 포함해야 합니다'),
    confirmPassword: z.string(),
    referralCode: z.string().optional(),
    agreeTerms: z.boolean().refine((v) => v === true, {
      message: '이용약관에 동의해야 합니다',
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: '비밀번호가 일치하지 않습니다',
    path: ['confirmPassword'],
  })

type SignupFormValues = z.infer<typeof signupSchema>

// ─── Component ────────────────────────────────────────────────────────────────

export default function SignupPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [isKakaoLoading, setIsKakaoLoading] = useState(false)
  const [isEmailSent, setIsEmailSent] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<SignupFormValues>({ resolver: zodResolver(signupSchema) })

  const password = watch('password', '')

  const passwordStrength = getPasswordStrength(password)

  // ── Email signup ────────────────────────────────────────────────────────────
  const onSubmit = async (values: SignupFormValues) => {
    setIsLoading(true)
    try {
      const supabase = createClient()

      const { data, error } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          data: {
            full_name: values.fullName,
          },
          emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/callback?next=/onboarding`,
        },
      })

      if (error) {
        if (error.message.includes('already registered')) {
          toast.error('이미 등록된 이메일입니다. 로그인해 주세요.')
        } else {
          toast.error(error.message)
        }
        return
      }

      // Insert profile (the DB trigger also handles this, but we add referral_by here)
      if (data.user) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from('users_profile').upsert({
          id: data.user.id,
          email: values.email,
          full_name: values.fullName,
          referred_by: values.referralCode ?? null,
        })
      }

      setIsEmailSent(true)
      toast.success('가입 이메일을 발송했습니다. 받은 편지함을 확인하세요!')
    } finally {
      setIsLoading(false)
    }
  }

  // ── Kakao OAuth ─────────────────────────────────────────────────────────────
  const handleKakaoSignup = async () => {
    setIsKakaoLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'kakao',
        options: {
          redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/callback?next=/onboarding`,
        },
      })
      if (error) toast.error('카카오 로그인에 실패했습니다: ' + error.message)
    } finally {
      // Page navigates away
    }
  }

  // ── Email sent state ────────────────────────────────────────────────────────
  if (isEmailSent) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 className="h-7 w-7 text-green-600" />
          </div>
          <h2 className="mb-2 text-xl font-semibold text-slate-900">이메일을 확인하세요</h2>
          <p className="text-sm text-slate-500">
            가입 확인 링크를 이메일로 발송했습니다.
            <br />
            링크를 클릭하면 온보딩이 시작됩니다.
          </p>
          <Button
            className="mt-6 w-full"
            variant="outline"
            onClick={() => router.push('/login')}
          >
            로그인 페이지로 이동
          </Button>
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-xl font-bold text-white shadow-lg">
            T
          </div>
          <h1 className="text-2xl font-bold text-slate-900">TaxFlow AI</h1>
          <p className="mt-1 text-sm text-slate-500">크리에이터를 위한 세금 AI 코치</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h2 className="mb-1 text-xl font-semibold text-slate-900">무료로 시작하기</h2>
          <p className="mb-6 text-sm text-slate-500">신용카드 없이 바로 시작하세요</p>

          {/* Kakao — only shown when Kakao OAuth is configured in Supabase */}
          {process.env.NEXT_PUBLIC_KAKAO_ENABLED === 'true' && (
            <>
              <Button
                type="button"
                className="mb-4 w-full gap-2 bg-[#FEE500] text-[#3C1E1E] hover:bg-[#F5DC00] focus-visible:ring-yellow-400"
                onClick={handleKakaoSignup}
                disabled={isKakaoLoading || isLoading}
              >
                {isKakaoLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <KakaoIcon />
                )}
                카카오로 시작하기
              </Button>

              {/* Divider */}
              <div className="relative mb-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-white px-3 text-slate-400">또는 이메일로 가입</span>
                </div>
              </div>
            </>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            {/* Full name */}
            <div className="space-y-1.5">
              <Label htmlFor="fullName">이름</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="fullName"
                  type="text"
                  placeholder="홍길동"
                  className="pl-10"
                  autoComplete="name"
                  {...register('fullName')}
                />
              </div>
              {errors.fullName && <FieldError message={errors.fullName.message!} />}
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <Label htmlFor="email">이메일</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  className="pl-10"
                  autoComplete="email"
                  {...register('email')}
                />
              </div>
              {errors.email && <FieldError message={errors.email.message!} />}
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <Label htmlFor="password">비밀번호</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="password"
                  type="password"
                  placeholder="8자 이상, 영문+숫자"
                  className="pl-10"
                  autoComplete="new-password"
                  {...register('password')}
                />
              </div>
              {password && <PasswordStrengthBar strength={passwordStrength} />}
              {errors.password && <FieldError message={errors.password.message!} />}
            </div>

            {/* Confirm password */}
            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword">비밀번호 확인</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="비밀번호 재입력"
                  className="pl-10"
                  autoComplete="new-password"
                  {...register('confirmPassword')}
                />
              </div>
              {errors.confirmPassword && <FieldError message={errors.confirmPassword.message!} />}
            </div>

            {/* Referral code (optional) */}
            <div className="space-y-1.5">
              <Label htmlFor="referralCode">
                추천 코드{' '}
                <span className="text-xs font-normal text-slate-400">(선택사항 — 1개월 무료)</span>
              </Label>
              <div className="relative">
                <Tag className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="referralCode"
                  type="text"
                  placeholder="ABCD1234"
                  className="pl-10 uppercase tracking-widest"
                  maxLength={8}
                  {...register('referralCode')}
                />
              </div>
            </div>

            {/* Terms */}
            <div className="flex items-start gap-2 pt-1">
              <input
                id="agreeTerms"
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                {...register('agreeTerms')}
              />
              <label htmlFor="agreeTerms" className="text-sm text-slate-600">
                <Link href="/terms" className="text-blue-600 hover:underline">이용약관</Link>과{' '}
                <Link href="/privacy" className="text-blue-600 hover:underline">개인정보 처리방침</Link>에
                동의합니다
              </label>
            </div>
            {errors.agreeTerms && <FieldError message={errors.agreeTerms.message!} />}

            <Button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700"
              disabled={isLoading || isKakaoLoading}
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              가입하기
            </Button>
          </form>
        </div>

        <p className="mt-4 text-center text-sm text-slate-500">
          이미 계정이 있으신가요?{' '}
          <Link href="/login" className="font-medium text-blue-600 hover:underline">
            로그인
          </Link>
        </p>
      </div>
    </main>
  )
}

// ─── Helper components ────────────────────────────────────────────────────────

function FieldError({ message }: { message: string }) {
  return (
    <p className="flex items-center gap-1 text-xs text-red-500">
      <AlertCircle className="h-3 w-3 shrink-0" />
      {message}
    </p>
  )
}

function PasswordStrengthBar({ strength }: { strength: number }) {
  const levels = [
    { label: '매우 약함', color: 'bg-red-500' },
    { label: '약함', color: 'bg-orange-400' },
    { label: '보통', color: 'bg-yellow-400' },
    { label: '강함', color: 'bg-green-500' },
  ]
  const current = levels[Math.min(strength, 3)]

  return (
    <div className="space-y-1">
      <div className="flex gap-1">
        {levels.map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
              i <= strength ? current.color : 'bg-slate-200'
            }`}
          />
        ))}
      </div>
      <p className="text-xs text-slate-400">비밀번호 강도: {current.label}</p>
    </div>
  )
}

function KakaoIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
      <path d="M12 3C6.477 3 2 6.589 2 11.017c0 2.87 1.746 5.394 4.38 6.948l-.883 3.294a.375.375 0 0 0 .544.42l3.837-2.544A11.13 11.13 0 0 0 12 19.034c5.523 0 10-3.588 10-8.017C22 6.59 17.523 3 12 3Z" />
    </svg>
  )
}

// ─── Password strength scorer ─────────────────────────────────────────────────

function getPasswordStrength(password: string): number {
  if (!password) return -1
  let score = 0
  if (password.length >= 8) score++
  if (password.length >= 12) score++
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++
  return Math.min(score, 3)
}
