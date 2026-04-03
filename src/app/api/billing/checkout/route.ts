/**
 * POST /api/billing/checkout
 * ─────────────────────────────────────────────────────────────────────────────
 * Creates a Paddle checkout transaction and returns the redirect URL.
 * Called from client components (plan-gate, settings page).
 *
 * Paddle acts as Merchant of Record — Korean VAT and KRW pricing are handled
 * automatically on the Paddle side.
 *
 * Body: { plan: 'pro' | 'business', referralCode?: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createPaddleCheckoutSession } from '@/lib/payments/paddle'

const schema = z.object({
  plan:         z.enum(['pro', 'business']),
  referralCode: z.string().max(16).optional(),
})

export async function POST(request: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()

  if (authErr || !user) {
    return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
  }

  // ── Validate body ─────────────────────────────────────────────────────────
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: '요청 형식이 잘못되었습니다' }, { status: 400 })
  }

  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'plan은 pro 또는 business여야 합니다' },
      { status: 400 }
    )
  }

  const { plan, referralCode } = parsed.data

  // ── Create Paddle checkout ────────────────────────────────────────────────
  try {
    const url = await createPaddleCheckoutSession(
      user.id,
      user.email!,
      plan,
      referralCode
    )
    return NextResponse.json({ url })
  } catch (err) {
    console.error('[billing/checkout] Paddle error:', err)
    return NextResponse.json(
      { error: '결제 세션 생성에 실패했습니다' },
      { status: 500 }
    )
  }
}
