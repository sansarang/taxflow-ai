/**
 * POST /api/billing/portal
 * ─────────────────────────────────────────────────────────────────────────────
 * Returns the Paddle customer self-serve portal URL.
 * Customers can manage subscriptions, update payment methods, and view invoices.
 *
 * No Paddle API call required — the URL is built from the stored customer ID.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server'
import { getPaddleCustomerPortalUrl } from '@/lib/payments/paddle'

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()

  if (authErr || !user) {
    return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any
  const { data: profile } = await db
    .from('users_profile')
    .select('stripe_customer_id')   // column reused for Paddle customer ID
    .eq('id', user.id)
    .single()

  if (!profile?.stripe_customer_id) {
    return NextResponse.json(
      { error: '구독 정보가 없습니다. 먼저 플랜을 구독하세요.' },
      { status: 404 }
    )
  }

  try {
    const url = getPaddleCustomerPortalUrl(profile.stripe_customer_id)
    return NextResponse.json({ url })
  } catch (err) {
    console.error('[billing/portal]', err)
    return NextResponse.json({ error: '포털 URL 생성에 실패했습니다' }, { status: 500 })
  }
}
