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
