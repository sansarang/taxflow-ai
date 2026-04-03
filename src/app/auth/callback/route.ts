import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code  = searchParams.get('code')
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  // ✅ Vercel에서 origin 대신 APP_URL 환경변수 사용
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://taxflow-ai-nine.vercel.app'

  if (error) {
    console.error('[callback] Auth error:', error, errorDescription)
    return NextResponse.redirect(`${baseUrl}/login?error=${encodeURIComponent(errorDescription ?? error)}`)
  }

  if (code) {
    const supabase = await createServerSupabaseClient()
    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

    if (exchangeError) {
      console.error('[callback] Code exchange failed:', exchangeError.message)
      return NextResponse.redirect(`${baseUrl}/login?error=인증에 실패했습니다`)
    }

    if (data.user) {
      // 프로필 row 보장 (DB 트리거 누락 대비) — as any로 타입 우회
      await (supabase.from('users_profile') as any).upsert(
        {
          id: data.user.id,
          email: data.user.email!,
          full_name:
            data.user.user_metadata?.full_name ??
            data.user.user_metadata?.name ??
            null,
        },
        { onConflict: 'id', ignoreDuplicates: true }
      )

      // 온보딩 완료 여부 확인 후 리다이렉트
      const { data: profile } = await (supabase as any)
        .from('users_profile')
        .select('onboarding_completed')
        .eq('id', data.user.id)
        .single() as { data: { onboarding_completed: boolean } | null }

      const destination = profile?.onboarding_completed ? '/dashboard' : '/onboarding'
      return NextResponse.redirect(`${baseUrl}${destination}`)
    }
  }

  return NextResponse.redirect(`${baseUrl}/login`)
}