import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"

const PROTECTED = ["/dashboard", "/upload", "/transactions", "/optimize", "/export", "/simulator", "/settings"]
const AUTH_ROUTES = ["/login", "/signup"]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const isProtected = PROTECTED.some(p => pathname.startsWith(p))
  const isAuthRoute = AUTH_ROUTES.some(p => pathname.startsWith(p))
  const isOnboarding = pathname.startsWith("/onboarding")

  if (!user && isProtected) {
    const url = new URL("/login", request.url)
    url.searchParams.set("redirectTo", pathname)
    return NextResponse.redirect(url)
  }
  if (user && isAuthRoute) {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }
  if (user && !isOnboarding && isProtected) {
    const { data: profile } = await supabase.from("users_profile")
      .select("onboarding_completed").eq("id", user.id).single()
    if (profile && !profile.onboarding_completed) {
      return NextResponse.redirect(new URL("/onboarding", request.url))
    }
  }
  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)"],
}
