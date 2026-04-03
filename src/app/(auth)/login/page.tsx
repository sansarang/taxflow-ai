'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Loader2, Mail, Lock, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'

const loginSchema = z.object({
  email: z.string().email('올바른 이메일 주소를 입력하세요'),
  password: z.string().min(8, '비밀번호는 8자 이상이어야 합니다'),
})

type LoginFormValues = z.infer<typeof loginSchema>

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo') ?? '/dashboard'

  const [isEmailLoading, setIsEmailLoading] = useState(false)
  const [isKakaoLoading, setIsKakaoLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) })

  const onSubmit = async (values: LoginFormValues) => {
    setIsEmailLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      })

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          toast.error('이메일 또는 비밀번호가 올바르지 않습니다')
        } else if (error.message.includes('Email not confirmed')) {
          toast.error('이메일 인증을 완료해 주세요. 받은 편지함을 확인하세요.')
        } else {
          toast.error(error.message)
        }
        return
      }

      toast.success('로그인 성공!')
      router.push(redirectTo)
      router.refresh()
    } finally {
      setIsEmailLoading(false)
    }
  }

  const handleKakaoLogin = async () => {
    setIsKakaoLoading(true)
    try {
      const supabase = createClient()
      // ✅ 수정: window.location.origin 사용 + /auth/callback 경로 정확히 지정
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'kakao',
        options: {
          redirectTo: `https://taxflow-ai-nine.vercel.app/auth/callback`,
        },
      })
      if (error) toast.error('카카오 로그인에 실패했습니다: ' + error.message)
    } finally {
      setIsKakaoLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-xl font-bold text-white shadow-lg">
            T
          </div>
          <h1 className="text-2xl font-bold text-slate-900">TaxFlow AI</h1>
          <p className="mt-1 text-sm text-slate-500">크리에이터를 위한 세금 AI 코치</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h2 className="mb-6 text-xl font-semibold text-slate-900">로그인</h2>

          {/* ✅ 카카오 버튼 — 항상 표시 (NEXT_PUBLIC_KAKAO_ENABLED 조건 제거) */}
          <Button
            type="button"
            className="mb-4 w-full gap-2 bg-[#FEE500] text-[#3C1E1E] hover:bg-[#F5DC00] focus-visible:ring-yellow-400"
            onClick={handleKakaoLogin}
            disabled={isKakaoLoading || isEmailLoading}
          >
            {isKakaoLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <KakaoIcon />
            )}
            카카오로 시작하기
          </Button>

          <div className="relative mb-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white px-3 text-slate-400">또는 이메일로 로그인</span>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
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
              {errors.email && (
                <p className="flex items-center gap-1 text-xs text-red-500">
                  <AlertCircle className="h-3 w-3" />
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">비밀번호</Label>
                <Link href="/forgot-password" className="text-xs text-blue-600 hover:underline">
                  비밀번호 찾기
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  className="pl-10"
                  autoComplete="current-password"
                  {...register('password')}
                />
              </div>
              {errors.password && (
                <p className="flex items-center gap-1 text-xs text-red-500">
                  <AlertCircle className="h-3 w-3" />
                  {errors.password.message}
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700"
              disabled={isEmailLoading || isKakaoLoading}
            >
              {isEmailLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              로그인
            </Button>
          </form>
        </div>

        <p className="mt-4 text-center text-sm text-slate-500">
          계정이 없으신가요?{' '}
          <Link href="/signup" className="font-medium text-blue-600 hover:underline">
            무료로 시작하기
          </Link>
        </p>

        <p className="mt-6 text-center text-xs leading-relaxed text-slate-400">
          로그인 시{' '}
          <Link href="/terms" className="hover:underline">이용약관</Link>과{' '}
          <Link href="/privacy" className="hover:underline">개인정보 처리방침</Link>에 동의하게 됩니다.
        </p>
      </div>
    </main>
  )
}

function KakaoIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
      <path d="M12 3C6.477 3 2 6.589 2 11.017c0 2.87 1.746 5.394 4.38 6.948l-.883 3.294a.375.375 0 0 0 .544.42l3.837-2.544A11.13 11.13 0 0 0 12 19.034c5.523 0 10-3.588 10-8.017C22 6.59 17.523 3 12 3Z" />
    </svg>
  )
}