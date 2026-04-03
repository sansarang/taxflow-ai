/**
 * @file src/app/signup/page.tsx
 * @description TaxFlow AI — 회원가입 페이지
 */
'use client'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { signUpNewUser, signInWithOAuth } from '@/lib/supabase/auth-helpers'

export default function SignupPage() {
  const router = useRouter()
  const sp = useSearchParams()
  const fromDemo = sp.get('ref') === 'demo'
  const plan = sp.get('plan') ?? 'free'
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setErr('')
    if (pw.length < 8)  { setErr('비밀번호는 8자 이상이어야 합니다.'); return }
    if (pw !== confirm) { setErr('비밀번호가 일치하지 않습니다.'); return }
    setLoading(true)
    const { data, error } = await signUpNewUser(email, pw)
    if (error) {
      setErr(error.message.includes('already registered') ? '이미 가입된 이메일입니다.' : (error.message ?? '가입 실패'))
      setLoading(false); return
    }
    if (data.session) { router.replace('/onboarding'); return }
    setSent(true); setLoading(false)
  }

  if (sent) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <div className="text-5xl mb-4">📧</div>
        <h2 className="text-xl font-bold text-white mb-2">이메일을 확인하세요</h2>
        <p className="text-gray-400 text-sm mb-8"><strong className="text-white">{email}</strong>으로 확인 링크를 보냈습니다.</p>
        <Link href="/login" className="text-sm text-blue-400 hover:underline">로그인 페이지로 돌아가기</Link>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="mb-7 text-center">
          <Link href="/" className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-blue-600 text-white font-bold text-lg mb-4">T</Link>
          <h1 className="text-2xl font-bold text-white">무료로 시작하기</h1>
          {fromDemo
            ? <p className="text-blue-400 text-sm mt-1 font-medium">체험 결과를 저장하고 더 많은 기능을 사용하세요</p>
            : <p className="text-gray-400 text-sm mt-1">월 5회 무료 · 신용카드 불필요</p>}
          {plan === 'pro' && (
            <div className="mt-2 inline-block bg-blue-600/20 border border-blue-500/40 rounded-lg px-3 py-1">
              <p className="text-xs text-blue-300 font-medium">🎉 Pro 첫 달 19,500원 선택됨</p>
            </div>
          )}
          {plan === 'business' && (
            <div className="mt-2 inline-block bg-purple-600/20 border border-purple-500/40 rounded-lg px-3 py-1">
              <p className="text-xs text-purple-300 font-medium">👑 Business 첫 달 44,500원 선택됨</p>
            </div>
          )}
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
            <input id="pw" type="password" required autoComplete="new-password" value={pw} onChange={e => setPw(e.target.value)}
              className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-white text-sm placeholder-gray-600 focus:border-blue-500 focus:outline-none"
              placeholder="8자 이상" />
          </div>
          <div>
            <label htmlFor="confirm" className="block text-sm text-gray-300 mb-1">비밀번호 확인</label>
            <input id="confirm" type="password" required autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)}
              className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-white text-sm placeholder-gray-600 focus:border-blue-500 focus:outline-none"
              placeholder="비밀번호 재입력" />
          </div>
          {err && <p role="alert" className="text-sm text-red-400 bg-red-950/40 rounded-lg px-4 py-2">{err}</p>}
          <button type="submit" disabled={loading}
            className="w-full rounded-lg bg-blue-600 py-3 font-semibold text-white text-sm hover:bg-blue-500 disabled:opacity-50 transition-colors">
            {loading ? '처리 중...' : '무료로 시작하기'}
          </button>
        </form>
        <div className="my-5 flex items-center gap-2">
          <div className="flex-1 h-px bg-gray-800" /><span className="text-xs text-gray-500">또는</span>
          <div className="flex-1 h-px bg-gray-800" />
        </div>
        <button onClick={() => { setLoading(true); signInWithOAuth('kakao', '/onboarding') }} disabled={loading}
          className="w-full rounded-lg bg-yellow-400 py-3 font-semibold text-gray-900 text-sm hover:bg-yellow-300 disabled:opacity-50 transition-colors">
          카카오로 시작하기
        </button>
        <p className="mt-5 text-center text-sm text-gray-500">
          이미 계정이 있으신가요? <Link href="/login" className="text-blue-400 hover:underline">로그인</Link>
        </p>
        <p className="mt-1 text-center text-xs text-gray-600">
          또는 <Link href="/demo" className="text-blue-500 hover:underline">회원가입 없이 체험하기</Link>
        </p>
      </div>
    </div>
  )
}
