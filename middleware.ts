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
