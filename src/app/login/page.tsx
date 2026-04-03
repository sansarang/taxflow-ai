/**
 * @file src/app/login/page.tsx
 * @description TaxFlow AI — 로그인 페이지
 */
'use client'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { signInUser, signInWithOAuth, getProfileWithOnboarding } from '@/lib/supabase/auth-helpers'

const ALLOWED_NEXT = ['/dashboard', '/onboarding', '/settings']
function sanitizeNext(raw: string | null): string | null {
  if (!raw) return null
  try { const d = decodeURIComponent(raw); return ALLOWED_NEXT.some(p => d.startsWith(p)) ? d : null } catch { return null }
}

export default function LoginPage() {
  const router = useRouter()
  const sp = useSearchParams()
  const nextPath = sanitizeNext(sp.get('next'))
  const fromDemo = sp.get('ref') === 'demo'
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setErr('')
    const { data, error } = await signInUser(email, pw)
    if (error || !data.user) {
      setErr(error?.message?.includes('Invalid') ? '이메일 또는 비밀번호가 올바르지 않습니다.' : (error?.message ?? '로그인 실패'))
      setLoading(false); return
    }
    const profile = await getProfileWithOnboarding(data.user.id)
    const done = !!(profile?.onboarding_completed && profile?.business_type)
    router.replace(done ? (nextPath || '/dashboard') : '/onboarding')
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-7 text-center">
          <Link href="/" className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-blue-600 text-white font-bold text-lg mb-4">T</Link>
          <h1 className="text-2xl font-bold text-white">로그인</h1>
          {fromDemo
            ? <p className="text-blue-400 text-sm mt-1 font-medium">체험 결과를 저장하고 계속 이용하세요</p>
            : <p className="text-gray-400 text-sm mt-1">TaxFlow AI 세금 AI 코치</p>}
        </div>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="email" className="block text-sm text-gray-300 mb-1">이메일</label>
            <input id="email" type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-white text-sm placeholder-gray-600 focus:border-blue-500 focus:outline-none"
              placeholder="you@example.com" />
          </div>
          <div>
            <label htmlFor="pw" className="block text-sm text-gray-300 mb-1">비밀번호</label>
            <input id="pw" type="password" required autoComplete="current-password" value={pw} onChange={e => setPw(e.target.value)}
              className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-white text-sm placeholder-gray-600 focus:border-blue-500 focus:outline-none"
              placeholder="비밀번호" />
          </div>
          {err && <p role="alert" className="text-sm text-red-400 bg-red-950/40 rounded-lg px-4 py-2">{err}</p>}
          <button type="submit" disabled={loading}
            className="w-full rounded-lg bg-blue-600 py-3 font-semibold text-white text-sm hover:bg-blue-500 disabled:opacity-50 transition-colors">
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>
        <div className="my-5 flex items-center gap-2">
          <div className="flex-1 h-px bg-gray-800" /><span className="text-xs text-gray-500">또는</span>
          <div className="flex-1 h-px bg-gray-800" />
        </div>
        <button onClick={() => { setLoading(true); signInWithOAuth('kakao') }} disabled={loading}
          className="w-full rounded-lg bg-yellow-400 py-3 font-semibold text-gray-900 text-sm hover:bg-yellow-300 disabled:opacity-50 transition-colors">
          카카오로 로그인
        </button>
        <p className="mt-6 text-center text-sm text-gray-500">
          계정이 없으신가요? <Link href="/signup" className="text-blue-400 hover:underline font-medium">무료로 시작하기</Link>
        </p>
        <p className="mt-2 text-center text-xs text-gray-600">
          또는 <Link href="/demo" className="text-blue-500 hover:underline">회원가입 없이 체험하기</Link>
        </p>
      </div>
    </div>
  )
}
