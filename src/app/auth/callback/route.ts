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
