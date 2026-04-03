#!/bin/bash
# TaxFlow AI — 전체 파일 생성 스크립트
# 사용법: 프로젝트 루트에서 bash setup.sh

set -e
echo "🚀 TaxFlow AI 파일 생성 시작..."

# ─── 디렉토리 생성 ─────────────────────────────────────────────────────────────
mkdir -p src/lib/redis
mkdir -p src/lib/ai
mkdir -p src/lib/supabase
mkdir -p src/app/demo
mkdir -p src/app/login
mkdir -p src/app/signup
mkdir -p src/app/onboarding
mkdir -p src/app/dashboard
mkdir -p src/app/auth/callback
mkdir -p src/app/api/classify
mkdir -p src/app/api/receipts/upload
mkdir -p src/app/api/demo/analyze
mkdir -p src/app/api/health
mkdir -p src/app/api/checkout
mkdir -p src/components/dashboard

echo "📁 디렉토리 생성 완료"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 1. middleware.ts (루트)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
cat > middleware.ts << 'MIDDLEWARE_EOF'
/**
 * @file middleware.ts
 * @description TaxFlow AI — Route guard
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

const PUBLIC_PAGES = ['/', '/login', '/signup', '/demo', '/pricing', '/auth/callback', '/auth/confirm']
const PUBLIC_API   = ['/api/health', '/api/webhook', '/api/demo']

function isPublicPage(p: string) { return PUBLIC_PAGES.some(x => p === x || p.startsWith(x + '/') || p.startsWith(x + '?')) }
function isPublicApi(p: string)  { return PUBLIC_API.some(x => p.startsWith(x)) }

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl
  if (isPublicPage(pathname)) return NextResponse.next()
  if (isPublicApi(pathname))  return NextResponse.next()

  let res = NextResponse.next({ request: { headers: req.headers } })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return req.cookies.get(name)?.value },
        set(name: string, value: string, options: CookieOptions) {
          req.cookies.set({ name, value, ...options })
          res = NextResponse.next({ request: { headers: req.headers } })
          res.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          req.cookies.set({ name, value: '', ...options })
          res = NextResponse.next({ request: { headers: req.headers } })
          res.cookies.set({ name, value: '', ...options })
        },
      },
    },
  )

  const { data: { user }, error } = await supabase.auth.getUser()
  const authed = !error && !!user

  if (pathname.startsWith('/api/')) {
    if (!authed) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    return res
  }

  if (pathname === '/login' || pathname === '/signup') {
    if (authed) {
      const dest = await resolvePostLoginDest(supabase, user!.id)
      return NextResponse.redirect(new URL(dest, req.url))
    }
    return res
  }

  if (!authed) {
    const url = new URL('/login', req.url)
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  const onboarded = await checkOnboarding(supabase, user!.id)

  if (pathname.startsWith('/dashboard')) {
    if (!onboarded) return NextResponse.redirect(new URL('/onboarding', req.url))
    return res
  }
  if (pathname.startsWith('/onboarding')) {
    if (onboarded) return NextResponse.redirect(new URL('/dashboard', req.url))
    return res
  }

  return res
}

async function checkOnboarding(supabase: any, userId: string): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('profiles').select('onboarding_completed,business_type').eq('id', userId).single()
    return !!(data?.onboarding_completed && data?.business_type)
  } catch { return false }
}

async function resolvePostLoginDest(supabase: any, userId: string): Promise<string> {
  return (await checkOnboarding(supabase, userId)) ? '/dashboard' : '/onboarding'
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
MIDDLEWARE_EOF

echo "✅ middleware.ts"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 2. src/lib/supabase/auth-helpers.ts
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
cat > src/lib/supabase/auth-helpers.ts << 'AUTH_EOF'
/**
 * @file src/lib/supabase/auth-helpers.ts
 * @description TaxFlow AI — Auth 유틸리티
 */
'use client'
import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient, User } from '@supabase/supabase-js'

let _client: SupabaseClient | null = null

export function createBrowserSupabase(): SupabaseClient {
  return (_client ??= createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  ))
}

function clearLocalStorage(): void {
  if (typeof window === 'undefined') return
  Object.keys(localStorage)
    .filter(k => k.startsWith('sb-') || k.includes('supabase'))
    .forEach(k => localStorage.removeItem(k))
}

export async function signUpNewUser(email: string, password: string) {
  const sb = createBrowserSupabase()
  await sb.auth.signOut({ scope: 'local'  }).catch(() => {})
  await sb.auth.signOut({ scope: 'global' }).catch(() => {})
  clearLocalStorage()
  return sb.auth.signUp({
    email, password,
    options: { emailRedirectTo: `${location.origin}/auth/callback?next=/onboarding` },
  })
}

export async function signInUser(email: string, password: string) {
  const sb = createBrowserSupabase()
  await sb.auth.signOut({ scope: 'local' }).catch(() => {})
  clearLocalStorage()
  return sb.auth.signInWithPassword({ email, password })
}

export async function signOutUser(): Promise<void> {
  const sb = createBrowserSupabase()
  await sb.auth.signOut({ scope: 'global' }).catch(() => {})
  clearLocalStorage()
  window.location.href = '/'
}

export async function signInWithOAuth(provider: 'kakao' | 'google', next = '/onboarding') {
  const sb = createBrowserSupabase()
  await sb.auth.signOut({ scope: 'local' }).catch(() => {})
  clearLocalStorage()
  return sb.auth.signInWithOAuth({
    provider,
    options: { redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
  })
}

export async function getCurrentUser(): Promise<User | null> {
  const { data: { user }, error } = await createBrowserSupabase().auth.getUser()
  return (error || !user) ? null : user
}

export async function getProfileWithOnboarding(userId: string) {
  const { data, error } = await createBrowserSupabase()
    .from('profiles')
    .select('id,full_name,business_type,is_simplified_vat,plan,onboarding_completed,revenue_range,notification_setup_done')
    .eq('id', userId).single()
  return error ? null : data
}
AUTH_EOF

echo "✅ src/lib/supabase/auth-helpers.ts"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 3. src/app/auth/callback/route.ts
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
cat > src/app/auth/callback/route.ts << 'CALLBACK_EOF'
/**
 * @file src/app/auth/callback/route.ts
 * @description OAuth / 이메일 확인 callback
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

const ALLOWED_NEXT = ['/dashboard', '/onboarding', '/settings']
function sanitizeNext(raw: string | null): string | null {
  if (!raw) return null
  try { const d = decodeURIComponent(raw); return ALLOWED_NEXT.some(p => d.startsWith(p)) ? d : null } catch { return null }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = new URL(req.url)
  const code = searchParams.get('code')
  const next = sanitizeNext(searchParams.get('next'))
  if (!code) return NextResponse.redirect(`${origin}/login?error=missing_code`)

  const store = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: n => store.get(n)?.value,
        set: (n, v, o: CookieOptions) => { try { store.set({ name: n, value: v, ...o }) } catch {} },
        remove: (n, o: CookieOptions) => { try { store.set({ name: n, value: '', ...o }) } catch {} },
      },
    },
  )
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)
  if (error || !data.user) return NextResponse.redirect(`${origin}/login?error=auth_failed`)

  const { data: profile } = await supabase
    .from('profiles').select('onboarding_completed,business_type').eq('id', data.user.id).single()
  const done = !!(profile?.onboarding_completed && profile?.business_type)
  const dest = !done ? '/onboarding' : (next || '/dashboard')
  return NextResponse.redirect(`${origin}${dest}`)
}
CALLBACK_EOF

echo "✅ src/app/auth/callback/route.ts"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 4. src/app/login/page.tsx
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
cat > src/app/login/page.tsx << 'LOGIN_EOF'
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
LOGIN_EOF

echo "✅ src/app/login/page.tsx"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 5. src/app/signup/page.tsx
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
cat > src/app/signup/page.tsx << 'SIGNUP_EOF'
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
SIGNUP_EOF

echo "✅ src/app/signup/page.tsx"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 6. src/app/onboarding/page.tsx
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
cat > src/app/onboarding/page.tsx << 'ONBOARD_EOF'
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
ONBOARD_EOF

echo "✅ src/app/onboarding/page.tsx"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 7. src/app/demo/page.tsx
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
cat > src/app/demo/page.tsx << 'DEMO_EOF'
/**
 * @file src/app/demo/page.tsx
 * @description TaxFlow AI — 체험 페이지 (인증 불필요)
 */
'use client'
import { useState, useRef } from 'react'
import Link from 'next/link'

type Step = 'upload'|'analyzing'|'result'
const SAMPLE = {
  classified:23, deductibleCount:14, missedCount:5, missedAmount:872000, riskScore:62,
  items:[
    { description:'Adobe Creative Cloud', amount:68000,  category:'소프트웨어 구독',    deductible:true  },
    { description:'스타벅스 강남점',        amount:15000,  category:'접대비 (한도 검토)',  deductible:true  },
    { description:'쿠팡 로켓배송',          amount:125000, category:'소모품비 (검토 필요)', deductible:false },
    { description:'YouTube Premium',      amount:14900,  category:'콘텐츠 제작비',       deductible:true  },
    { description:'이마트24',             amount:8500,   category:'식비 (사적 용도)',     deductible:false },
  ],
}

export default function DemoPage() {
  const [step, setStep] = useState<Step>('upload')
  const [result, setResult] = useState<typeof SAMPLE|null>(null)
  const [modal, setModal] = useState(false)
  const [drag, setDrag] = useState(false)
  const [label, setLabel] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function start(lbl: string) {
    setLabel(lbl); setStep('analyzing')
    await new Promise(r => setTimeout(r, 1400))
    setResult(SAMPLE); setStep('result')
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 px-4 py-4 flex items-center justify-between sticky top-0 bg-gray-950/95 backdrop-blur z-20">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-sm">T</div>
          <span className="font-bold text-sm">TaxFlow AI</span>
        </Link>
        <div className="flex items-center gap-2">
          <Link href="/login" className="text-sm text-gray-400 hover:text-white">로그인</Link>
          <Link href="/signup" className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold hover:bg-blue-500 transition-colors">무료 가입</Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 sm:py-14">
        {step === 'upload' && (
          <>
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs text-blue-400 mb-4">회원가입 없이 무료 체험</div>
              <h1 className="text-2xl sm:text-3xl font-bold mb-3">30초 만에 공제 항목 확인</h1>
              <p className="text-gray-400 text-sm">은행 거래내역 CSV 또는 영수증 사진을 올리면 AI가 즉시 분석합니다.</p>
            </div>
            <div onDrop={e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) start(f.name) }}
              onDragOver={e => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)}
              onClick={() => fileRef.current?.click()}
              className={`rounded-2xl border-2 border-dashed p-10 text-center cursor-pointer transition-all ${drag ? 'border-blue-500 bg-blue-950/40' : 'border-gray-700 hover:border-gray-500'}`}>
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.jpg,.jpeg,.png,.heic,.webp" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) start(f.name) }} />
              <div className="text-5xl mb-4">📤</div>
              <p className="font-semibold mb-1">파일을 드래그하거나 클릭하세요</p>
              <p className="text-gray-500 text-sm">CSV, Excel, 영수증 사진 지원</p>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-4">
              {[{ icon:'📊', t:'은행 CSV', d:'거래내역 파일' }, { icon:'📷', t:'영수증 사진', d:'OCR 자동 분석' }].map(b => (
                <button key={b.t} onClick={() => fileRef.current?.click()}
                  className="rounded-xl border border-gray-700 bg-gray-900 p-4 text-left hover:border-gray-500 transition-colors">
                  <div className="text-2xl mb-1.5">{b.icon}</div>
                  <p className="font-semibold text-sm">{b.t}</p>
                  <p className="text-gray-500 text-xs mt-0.5">{b.d}</p>
                </button>
              ))}
            </div>
            <div className="mt-6 text-center">
              <p className="text-gray-500 text-sm mb-3">파일이 없으신가요?</p>
              <button onClick={() => start('sample_data.csv')}
                className="rounded-lg bg-gray-800 border border-gray-700 px-6 py-2.5 text-sm font-semibold hover:bg-gray-700 transition-colors">
                샘플 데이터로 체험하기
              </button>
            </div>
          </>
        )}

        {step === 'analyzing' && (
          <div className="text-center py-20">
            <div className="text-6xl mb-6 animate-pulse">🤖</div>
            <h2 className="text-xl font-bold mb-3">AI가 분석 중입니다...</h2>
            <p className="text-gray-400 text-sm mb-6">{label}</p>
            <div className="flex justify-center gap-1.5">
              {[0,1,2].map(i => <div key={i} className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay:`${i*0.15}s` }} />)}
            </div>
          </div>
        )}

        {step === 'result' && result && (
          <div>
            <div className="rounded-2xl bg-gradient-to-r from-red-950/80 to-orange-950/60 border border-red-800/50 p-5 mb-5">
              <p className="text-lg font-bold text-white mb-1">⚠️ 이번 달 놓친 공제 약 <span className="text-yellow-300">{result.missedAmount.toLocaleString()}원</span></p>
              <p className="text-red-200 text-sm mb-3">{result.missedCount}건의 거래에서 공제 항목을 놓치고 있을 가능성이 있습니다. (참고용)</p>
              <button onClick={() => setModal(true)} className="rounded-lg bg-blue-600 hover:bg-blue-500 px-4 py-2 text-sm font-bold text-white transition-colors">
                Pro에서 실시간 알림 받기 (첫 달 19,500원) →
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-5">
              {[{ l:'분류 완료', v:`${result.classified}건`, c:'text-blue-400' },
                { l:'공제 가능', v:`${result.deductibleCount}건`, c:'text-green-400' },
                { l:'위험도',    v:`${result.riskScore}점`, c:result.riskScore>=60?'text-red-400':'text-yellow-400' }].map(s => (
                <div key={s.l} className="rounded-xl border border-gray-700 bg-gray-900 p-4 text-center">
                  <p className={`text-2xl font-bold ${s.c}`}>{s.v}</p>
                  <p className="text-xs text-gray-400 mt-1">{s.l}</p>
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-gray-700 bg-gray-900 p-5 mb-5">
              <h3 className="font-bold text-sm text-gray-300 mb-4">분석 결과 미리보기</h3>
              <div className="space-y-3">
                {result.items.map((item, i) => (
                  <div key={i} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{item.description}</p>
                      <p className="text-xs text-gray-500">{item.category}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold">{item.amount.toLocaleString()}원</p>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${item.deductible ? 'bg-green-900/50 text-green-400' : 'bg-gray-800 text-gray-500'}`}>
                        {item.deductible ? '공제 가능' : '검토 필요'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 relative">
                <div className="opacity-30 blur-sm space-y-3 select-none pointer-events-none">
                  {['네이버 광고비','Adobe Stock','노션 구독'].map(t => (
                    <div key={t} className="flex justify-between text-xs"><span>{t}</span><span>●●,●●●원</span></div>
                  ))}
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <button onClick={() => setModal(true)} className="rounded-lg bg-blue-600 hover:bg-blue-500 px-4 py-2 text-sm font-bold text-white shadow-lg">
                    🔓 전체 결과 보기 (회원가입 필요)
                  </button>
                </div>
              </div>
            </div>
            <button onClick={() => setModal(true)} className="w-full rounded-xl bg-blue-600 hover:bg-blue-500 py-4 font-bold text-lg text-white transition-colors mb-2">
              📥 분석 결과 저장하기
            </button>
            <p className="text-center text-xs text-gray-500 mb-4">저장하려면 무료 회원가입이 필요합니다</p>
            <p className="text-center text-xs text-gray-600">※ 샘플 데이터 기반 참고용. 실제 금액은 다를 수 있습니다.</p>
          </div>
        )}
      </main>

      {modal && (
        <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 px-4 pb-4 sm:pb-0"
          onClick={e => { if (e.target === e.currentTarget) setModal(false) }}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md p-6 sm:p-8">
            <div className="text-center mb-5">
              <div className="text-4xl mb-3">⚠️</div>
              <h3 className="text-xl font-bold text-white mb-2">공제 기회를 놓치고 계십니다</h3>
              <p className="text-gray-400 text-sm leading-relaxed">Pro 사용자들은 실시간으로 놓친 공제를 카카오톡으로 받고 있습니다. 지금 업그레이드하면 <strong className="text-white">첫 달 19,500원</strong>에 이용 가능합니다.</p>
            </div>
            <ul className="space-y-2 mb-5">
              {['무제한 AI 거래 분류','실시간 카카오 절세 알림','홈택스 신고 파일 자동 생성','영수증 OCR + 증빙 저장소'].map(f => (
                <li key={f} className="flex items-center gap-2 text-sm text-gray-200"><span className="text-blue-400">⚡</span>{f}</li>
              ))}
            </ul>
            <Link href="/signup?plan=pro&ref=demo" className="block w-full rounded-xl bg-blue-600 hover:bg-blue-500 py-3.5 text-center font-bold text-white transition-colors mb-3">
              Pro 19,500원으로 시작하기 (첫 달)
            </Link>
            <Link href="/signup?ref=demo" className="block w-full rounded-xl border border-gray-600 py-3 text-center text-sm text-gray-300 hover:bg-gray-800 transition-colors mb-3">
              무료로 가입하기 (월 5회 제한)
            </Link>
            <button onClick={() => setModal(false)} className="block w-full text-xs text-gray-500 hover:text-gray-400 text-center py-2">나중에 하기</button>
          </div>
        </div>
      )}
    </div>
  )
}
DEMO_EOF

echo "✅ src/app/demo/page.tsx"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 8. src/app/dashboard/page.tsx (Server Component)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
cat > src/app/dashboard/page.tsx << 'DASH_PAGE_EOF'
/**
 * @file src/app/dashboard/page.tsx
 * @description TaxFlow AI — 대시보드 Server Component
 */
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import DashboardClient from '@/components/dashboard/dashboard-client'

async function getData(welcomeParam: boolean) {
  const store = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: n => store.get(n)?.value,
        set: (n, v, o: CookieOptions) => { try { store.set({ name: n, value: v, ...o }) } catch {} },
        remove: (n, o: CookieOptions) => { try { store.set({ name: n, value: '', ...o }) } catch {} },
      },
    },
  )
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id,full_name,business_type,is_simplified_vat,plan,onboarding_completed,revenue_range,notification_setup_done')
    .eq('id', user.id).single()

  if (!profile?.onboarding_completed || !profile?.business_type) redirect('/onboarding')

  const yearStart = `${new Date().getFullYear()}-01-01`
  const month     = new Date().toISOString().slice(0, 7)
  const ago30     = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 7)

  const [txRes, alertRes, summaryRes, usageRes, receiptRes, usageHistRes] = await Promise.all([
    supabase.from('transactions')
      .select('id,description,amount,date,tax_category,is_deductible,classified_at,vendor,receipt_url')
      .eq('user_id', user.id).order('date', { ascending: false }).limit(10),
    supabase.from('optimization_alerts')
      .select('id,type,priority,title,message,savings_impact,action_required,created_at')
      .eq('user_id', user.id).order('created_at', { ascending: false }).limit(5),
    supabase.from('transactions')
      .select('amount,tax_category,is_deductible,risk_flags,date')
      .eq('user_id', user.id).gte('date', yearStart),
    supabase.from('usage_logs').select('count').eq('user_id', user.id).eq('month', month).maybeSingle(),
    supabase.from('receipts')
      .select('id,description,amount,image_url,created_at,transaction_id')
      .eq('user_id', user.id).order('created_at', { ascending: false }).limit(12),
    supabase.from('usage_logs').select('count,month')
      .eq('user_id', user.id).gte('month', ago30).order('month', { ascending: false }).limit(3),
  ])

  return {
    user: { id: user.id, email: user.email ?? '' },
    profile,
    recentTransactions: txRes.data      ?? [],
    recentAlerts:       alertRes.data   ?? [],
    taxSummary:         summaryRes.data ?? [],
    monthlyUsage:       (usageRes.data as any)?.count ?? 0,
    receipts:           receiptRes.data ?? [],
    usageHistory:       usageHistRes.data ?? [],
    isFirstVisit:       welcomeParam && !profile?.notification_setup_done,
  }
}

export default async function DashboardPage({
  searchParams,
}: { searchParams: Promise<{ welcome?: string }> }) {
  const sp = await searchParams
  const data = await getData(sp?.welcome === '1')
  return <DashboardClient {...data} />
}
DASH_PAGE_EOF

echo "✅ src/app/dashboard/page.tsx"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 9. src/components/dashboard/dashboard-client.tsx
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
cat > src/components/dashboard/dashboard-client.tsx << 'DASH_CLIENT_EOF'
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
DASH_CLIENT_EOF

echo "✅ src/components/dashboard/dashboard-client.tsx"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 10. src/app/api/classify/route.ts
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
cat > src/app/api/classify/route.ts << 'CLASSIFY_EOF'
/**
 * @file src/app/api/classify/route.ts
 * @description TaxFlow AI — /api/classify v7 Final
 * Free: 월 5회 / Pro: 무제한+OCR / Business: 무제한+OCR+세무사
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { classifyTransactions } from '@/lib/ai/classifier'
import { runDeductionOptimizer } from '@/lib/ai/optimizer'
import { dispatchPushNotification } from '@/lib/notifications/push-dispatcher'
import { rateLimitCache } from '@/lib/redis/cache'
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import type { ClassificationResult } from '@/types/transaction'
import type { DeductionOptimizerResult } from '@/types/tax'

const FREE_LIMIT  = 5
const MAX_RETRIES = 3
const PADDLE_BASE = 'https://api.paddle.com'
const STRIPE_BASE = 'https://api.stripe.com/v1'
const TAX_FORM    = process.env.NEXT_PUBLIC_TAX_ADVISOR_FORM_URL ?? 'https://forms.gle/XXXXXXXXXX'
const DEFAULT_TAX_LAW = { year: new Date().getFullYear(), vatRate: 0.1, entertainmentCap: 3_600_000, simplifiedVatLimit: 48_000_000 }

const BodySchema = z.object({
  transactionIds: z.array(z.string().uuid()).min(1).max(500),
  year:    z.number().int().min(2020).max(2030).default(() => new Date().getFullYear()),
  quarter: z.number().int().min(1).max(4).optional(),
  receiptImages: z.array(z.object({
    base64: z.string(),
    mimeType: z.enum(['image/jpeg','image/png','image/webp','image/heic']),
    filename: z.string().optional(),
  })).max(5).optional(),
})

let _ant: Anthropic|null = null
const ant = () => (_ant ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! }))

export async function POST(req: NextRequest): Promise<NextResponse> {
  const supabase = await createServerClient()
  const { data: { user }, error: ae } = await supabase.auth.getUser()
  if (ae || !user) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })

  const rl = await rateLimitCache.checkUploadLimit(user.id)
  if (!rl.allowed) return NextResponse.json({ error: '시간당 업로드 한도를 초과했습니다.' }, { status: 429 })

  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: '요청 형식이 올바르지 않습니다.' }, { status: 400 })
  const { transactionIds, year, quarter, receiptImages } = parsed.data

  const { data: profile } = await supabase.from('profiles')
    .select('plan,business_type,is_simplified_vat,stripe_customer_id,paddle_subscription_id')
    .eq('id', user.id).single()

  const plan            = (profile?.plan as string) ?? 'free'
  const isSimplifiedVat = (profile?.is_simplified_vat as boolean) ?? false
  const businessType    = (profile?.business_type as string) ?? 'creator'
  const isFree = plan === 'free', isBiz = plan === 'business'

  // Free 월 5회 체크
  if (isFree) {
    const { data: ur } = await supabase.from('usage_logs').select('count').eq('user_id', user.id).eq('month', nowM()).maybeSingle()
    const used = (ur as any)?.count ?? 0
    if (used + transactionIds.length > FREE_LIMIT) {
      const missed = await estimateMissed(supabase, user.id)
      return NextResponse.json(buildLimitResp(used, FREE_LIMIT - used, missed), { status: 402 })
    }
  }

  const { data: txRows, error: txe } = await supabase.from('transactions').select('*').in('id', transactionIds).eq('user_id', user.id)
  if (txe || !txRows?.length) return NextResponse.json({ error: '거래 내역을 찾을 수 없습니다.' }, { status: 404 })
  if (txRows.length !== transactionIds.length) return NextResponse.json({ error: '접근 권한 오류.' }, { status: 403 })

  let taxLaw: Record<string, unknown> = DEFAULT_TAX_LAW
  try { const { data: l } = await supabase.from('tax_law_table').select('data').eq('year', year).single(); if (l?.data) taxLaw = l.data as Record<string, unknown> } catch {}

  // 영수증 OCR (Pro/Business 전용)
  const ocrResults: OcrResult[] = []
  if (!isFree && receiptImages?.length) {
    for (const img of receiptImages) {
      const ocr = await ocrReceipt(img.base64, img.mimeType)
      if (ocr) { ocrResults.push(ocr); await saveReceipt(supabase, user.id, img.base64, img.mimeType, ocr, img.filename) }
    }
  }

  let classified: ClassificationResult[]
  try { classified = await classifyTransactions(user.id, txRows as any, taxLaw, businessType) }
  catch (e) { console.error('[classify]', e); return NextResponse.json({ error: '분류 처리 중 오류가 발생했습니다.' }, { status: 500 }) }

  await Promise.allSettled(classified.map(c =>
    supabase.from('transactions').update({ tax_category:c.taxCategory, is_deductible:c.isDeductible, confidence:c.confidence, risk_flags:c.riskFlags, vendor:c.vendor, korean_reason:c.koreanReason, classified_at:new Date().toISOString(), cache_source:c.cacheSource }).eq('id', c.transactionId).eq('user_id', user.id)
  ))

  let optimizer: DeductionOptimizerResult|null = null
  try { optimizer = await runDeductionOptimizer(user.id, txRows as any, classified, taxLaw, { year, quarter, isSimplifiedVat, businessType }) }
  catch (e) { console.error('[optimizer]', e) }

  let alerts: any[] = []
  if (optimizer?.alerts?.length) alerts = await insertAlerts(supabase, user.id, optimizer.alerts)

  recordUsage(supabase, user.id, plan, classified.length, profile).catch(e => console.error('[billing]', e))
  if (!isFree && alerts.length > 0) dispatchPushNotification(user.id, alerts.slice(0, 3)).catch(() => {})

  const freeTeaser = isFree ? buildInlineTeaser(classified, optimizer) : null
  const bizData = isBiz ? { taxAdvisorFormUrl: TAX_FORM, canRequestAdvisor: true } : null

  return NextResponse.json({
    classified: classified.length, riskScore: optimizer?.riskScore ?? 0,
    alerts: alerts.slice(0, 5), forecast: optimizer?.forecast ?? null,
    forecastMessages: optimizer?.forecast?.messages ?? [],
    insurance: optimizer?.insurance ?? null, vatForecast: optimizer?.vatForecast ?? null,
    depreciations: optimizer?.depreciations ?? [],
    burnout: isFree ? null : (optimizer?.burnout ?? null),
    missedDeductions: optimizer?.missedDeductions ?? [],
    ocrResults: isFree ? [] : ocrResults,
    summary: buildSummary(classified, optimizer), freeTeaser, bizData,
    disclaimer: '※ 본 분석은 참고용 AI 코치 결과입니다. 최종 세금 신고 시 세무사와 함께 확인하시길 권장드립니다. AI 판단은 법적 효력이 없습니다.',
  })
}

function buildLimitResp(used: number, remaining: number, missed: { amount: number; riskScore: number }) {
  const { amount, riskScore } = missed
  return {
    error: 'free_limit_reached', code: 'UPGRADE_REQUIRED',
    currentUsage: used, limit: FREE_LIMIT, remaining: Math.max(0, remaining),
    teaser: {
      bannerMessage: amount > 0 ? `이번 달 놓친 공제 ${fmt(amount)}원 → Pro에서 바로 확인하세요 (첫 달 19,500원)` : '이번 달 공제 누락 가능성이 감지됩니다. Pro 상세 분석을 권장드립니다. (참고용)',
      modalTitle: '공제 기회를 놓치고 계십니다',
      modalBody: 'Pro 사용자들은 실시간으로 놓친 공제를 카카오톡으로 받고 있습니다. 지금 업그레이드하면 첫 달 19,500원에 이용 가능합니다.',
      riskMessage: riskScore >= 60 ? `세금 위험도 ${riskScore}점 — Pro 전환 시 매일 위험 알림 수신 가능성이 있습니다. (참고용)` : null,
      missedAmountKrw: amount, riskScore,
      proPrice: '19,500원 (첫 달 50% 할인)', bizPrice: '44,500원 (첫 달 50% 할인)',
      proCheckoutUrl: '/api/checkout?plan=pro&ref=limit', bizCheckoutUrl: '/api/checkout?plan=business&ref=limit',
    },
    disclaimer: '※ 참고용 AI 코치 결과입니다. AI 판단은 법적 효력이 없습니다.',
  }
}

function buildInlineTeaser(c: ClassificationResult[], opt: DeductionOptimizerResult|null): object|null {
  if (!opt) return null
  const top  = [...(opt.missedDeductions??[])].sort((a:any,b:any)=>b.estimatedSaving-a.estimatedSaving)[0]
  const risk = opt.riskScore ?? 0
  const depr = (opt.depreciations??[]).reduce((s:number,d:any)=>s+d.annualDeduction,0)
  if (!top && risk < 30 && depr === 0) return null
  const msgs: string[] = []
  if (top)        msgs.push(`공제 누락 가능성: ${top.description?.slice(0,20)} — 약 ${fmt(top.estimatedSaving)}원 (참고용)`)
  if (risk >= 50) msgs.push(`세금 위험도 ${risk}점 — Pro 실시간 알림 권장 (참고용)`)
  if (depr)       msgs.push(`장비 감가상각 공제 약 ${fmt(depr)}원 — Pro 상세 분석 가능 (참고용)`)
  msgs.push('번아웃 시뮬레이터·주간 리포트는 Pro에서 이용하실 수 있습니다.')
  return { messages: msgs, proPrice: '19,500원', proCheckoutUrl: '/api/checkout?plan=pro&ref=inline' }
}

interface OcrResult { description:string; amount:number; date:string|null; vendor:string; category:string; isDeductible:boolean; rawText:string }

async function ocrReceipt(base64: string, mimeType: string): Promise<OcrResult|null> {
  try {
    const resp = await ant().messages.create({
      model: 'claude-sonnet-4-20250514', max_tokens: 500,
      system: '한국 영수증 OCR. JSON만 출력: {"description":"가맹점명","amount":숫자,"date":"YYYY-MM-DD or null","vendor":"업체명","category":"소프트웨어구독|장비구입|광고비|접대비|소모품비|기타","isDeductible":true/false,"rawText":"텍스트요약"}. 모든 판단 참고용, 법적 효력 없음.',
      messages: [{ role:'user', content:[{ type:'image', source:{ type:'base64', media_type:mimeType as any, data:base64 } },{ type:'text', text:'이 영수증을 분석해주세요.' }] }],
    })
    const text = (resp.content.find(b=>b.type==='text') as Anthropic.TextBlock)?.text ?? ''
    return JSON.parse(text.replace(/```json|```/g,'').trim()) as OcrResult
  } catch (e) { console.error('[OCR]', e); return null }
}

async function saveReceipt(supabase: any, userId: string, base64: string, mimeType: string, ocr: OcrResult, filename?: string) {
  try {
    const ext = mimeType.split('/')[1] ?? 'jpg'
    const key = `${userId}/${Date.now()}.${ext}`
    await supabase.storage.from('receipts').upload(key, Buffer.from(base64,'base64'), { contentType:mimeType, upsert:false })
    const { data: { publicUrl } } = supabase.storage.from('receipts').getPublicUrl(key)
    await supabase.from('receipts').insert({ user_id:userId, description:ocr.description, amount:ocr.amount, date:ocr.date, vendor:ocr.vendor, category:ocr.category, is_deductible:ocr.isDeductible, image_url:publicUrl, raw_text:ocr.rawText, created_at:new Date().toISOString() })
  } catch (e) { console.error('[saveReceipt]', e) }
}

async function estimateMissed(supabase: any, userId: string): Promise<{ amount:number; riskScore:number }> {
  try {
    const { data } = await supabase.from('transactions').select('amount,is_deductible,risk_flags').eq('user_id',userId).gte('date',`${new Date().getFullYear()}-01-01`).limit(200)
    if (!data?.length) return { amount:0, riskScore:0 }
    const missed = (data as any[]).filter(t=>t.risk_flags?.includes('review_needed')||!t.is_deductible).reduce((s,t)=>s+Math.abs(t.amount??0),0)
    const rc = (data as any[]).filter(t=>t.risk_flags?.includes('review_needed')).length
    return { amount:Math.round(missed*0.15), riskScore:Math.min(100,Math.round((rc/data.length)*150)) }
  } catch { return { amount:0, riskScore:0 } }
}

async function insertAlerts(supabase: any, userId: string, alerts: any[]): Promise<any[]> {
  const ins: any[] = [], dead: any[] = []
  await Promise.all(alerts.slice(0,6).map(async a => {
    let le: unknown
    for (let i=0; i<MAX_RETRIES; i++) {
      try {
        const { data, error } = await supabase.from('optimization_alerts').insert({ user_id:userId, type:a.type??'general', priority:a.priority??'medium', title:a.title, message:a.message, savings_impact:a.savingsImpact??0, action_required:a.actionRequired??false, created_at:new Date().toISOString() }).select().single()
        if (error) throw error; ins.push(data); return
      } catch (e) { le=e; await sl(150*2**i) }
    }
    dead.push({ alert:a, error:String(le) })
  }))
  if (dead.length) supabase.from('alert_dead_letter').insert(dead.map(d=>({ user_id:userId, payload:d.alert, error_message:d.error, created_at:new Date().toISOString() }))).then(()=>{}).catch((e:unknown)=>console.error('[dead_letter]',e))
  return ins
}

async function recordUsage(sb: any, uid: string, plan: string, count: number, profile: any) {
  await sb.from('usage_logs').upsert({ user_id:uid, month:nowM(), count }, { onConflict:'user_id,month' }).catch(()=>{})
  if (plan === 'free') return
  const cfg = paddleCfg()
  if (cfg && profile?.paddle_subscription_id) { await paddleUsage(profile.paddle_subscription_id,count,cfg).catch(e=>console.error('[Paddle]',e)); return }
  if (process.env.STRIPE_SECRET_KEY && profile?.stripe_customer_id) await stripeUsage(profile.stripe_customer_id,count).catch(e=>console.error('[Stripe]',e))
}

function paddleCfg() {
  const k=process.env.PADDLE_API_KEY, p=process.env.PADDLE_USAGE_PRICE_ID
  if (!k||!p) return null
  const m=process.env.PADDLE_PRORATION_MODE??'prorated_immediately'
  return { k, p, m:(m==='prorated_next_billing_period'?m:'prorated_immediately') as 'prorated_immediately'|'prorated_next_billing_period' }
}

async function paddleUsage(subId: string, count: number, cfg: NonNullable<ReturnType<typeof paddleCfg>>) {
  const { k, p, m } = cfg
  const g = await fetch(`${PADDLE_BASE}/subscriptions/${subId}`, { headers:{ Authorization:`Bearer ${k}`, 'Content-Type':'application/json' } })
  if (!g.ok) throw new Error(`Paddle GET ${g.status}`)
  const sub = await g.json() as { data?:{ items?:{ price?:{ id:string }; quantity?:number }[] } }
  const item = sub.data?.items?.find(i=>i.price?.id===p)
  if (!item) throw new Error(`Paddle price ${p} not in sub`)
  const iKey = `taxflow-${subId}-${Math.floor(Date.now()/60_000)}`
  const r = await fetch(`${PADDLE_BASE}/subscriptions/${subId}`, { method:'PATCH', headers:{ Authorization:`Bearer ${k}`, 'Content-Type':'application/json', 'Paddle-Version':'1', 'Idempotency-Key':iKey }, body:JSON.stringify({ proration_billing_mode:m, items:[{ price_id:p, quantity:(item.quantity??0)+count }] }) })
  if (!r.ok) throw new Error(`Paddle PATCH ${r.status}`)
}

async function stripeUsage(cid: string, count: number) {
  const ts=Math.floor(Date.now()/1000)
  const r = await fetch(`${STRIPE_BASE}/billing/meter_events`, { method:'POST', headers:{ Authorization:`Bearer ${process.env.STRIPE_SECRET_KEY}`, 'Content-Type':'application/x-www-form-urlencoded' }, body:new URLSearchParams({ event_name:process.env.STRIPE_METER_EVENT_NAME??'classification_usage', 'payload[stripe_customer_id]':cid, 'payload[value]':String(count), timestamp:String(ts), identifier:`taxflow-${cid}-${ts}` }) })
  if (!r.ok) throw new Error(`Stripe ${r.status}`)
}

function buildSummary(c: ClassificationResult[], opt: DeductionOptimizerResult|null) {
  const n=c.length||1
  return { total:c.length, deductible:c.filter(x=>x.isDeductible).length, reviewNeeded:c.filter(x=>x.riskFlags?.includes('review_needed')).length, highConfidence:c.filter(x=>x.confidence>=0.85).length, cacheHitRate:+((c.filter(x=>x.cacheSource!=='claude').length/n).toFixed(3)), missedDeductionCount:opt?.missedDeductions?.length??0, estimatedMissedSaving:opt?.missedDeductions?.reduce((s:number,m:any)=>s+m.estimatedSaving,0)??0 }
}

const sl    = (ms: number) => new Promise<void>(r => setTimeout(r, ms))
const nowM  = ()           => new Date().toISOString().slice(0, 7)
const fmt   = (n: number)  => n.toLocaleString('ko-KR')
CLASSIFY_EOF

echo "✅ src/app/api/classify/route.ts"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 모든 파일 생성 완료!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📦 생성된 파일 목록:"
echo "  middleware.ts"
echo "  src/lib/supabase/auth-helpers.ts"
echo "  src/app/auth/callback/route.ts"
echo "  src/app/login/page.tsx"
echo "  src/app/signup/page.tsx"
echo "  src/app/onboarding/page.tsx"
echo "  src/app/demo/page.tsx"
echo "  src/app/dashboard/page.tsx"
echo "  src/components/dashboard/dashboard-client.tsx"
echo "  src/app/api/classify/route.ts"
echo ""
echo "⚠️  주의: app/page.tsx (Landing)는 길이 제한으로 별도 수동 작성 필요"
echo ""
echo "📋 다음 단계:"
echo "  1. .env.local 환경변수 설정"
echo "  2. Supabase DB 마이그레이션 실행 (아래 SQL)"
echo "  3. pnpm dev 로 개발 서버 시작"
echo ""
echo "🗄️  Supabase Migration SQL:"
cat << 'SQL_EOF'
-- 터미널 출력용 SQL (Supabase Dashboard > SQL Editor에서 실행)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed    boolean  NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS revenue_range           text,
  ADD COLUMN IF NOT EXISTS full_name               text,
  ADD COLUMN IF NOT EXISTS notification_setup_done boolean  DEFAULT false,
  ADD COLUMN IF NOT EXISTS notification_type       text;

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS receipt_url text;

CREATE TABLE IF NOT EXISTS receipts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid REFERENCES auth.users NOT NULL,
  description   text,
  amount        integer,
  date          date,
  vendor        text,
  category      text,
  is_deductible boolean,
  image_url     text,
  raw_text      text,
  transaction_id uuid,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS receipts_user_id_idx ON receipts(user_id);
SQL_EOF