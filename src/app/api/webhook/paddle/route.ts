/**
 * POST /api/webhook/paddle
 * ─────────────────────────────────────────────────────────────────────────────
 * Receives Paddle webhook events, verifies the signature using the raw request
 * body, then delegates business logic to handlePaddleWebhook().
 *
 * Raw body is required for signature verification — do NOT use request.json().
 * The `paddle-signature` header is sent with every Paddle webhook request.
 */

import { NextRequest, NextResponse } from 'next/server'
import { handlePaddleWebhook } from '@/lib/payments/paddle'

export async function POST(request: NextRequest) {
  const rawBody  = await request.text()
  const signature = request.headers.get('paddle-signature') ?? ''

  if (!signature) {
    return NextResponse.json({ error: 'Missing paddle-signature header' }, { status: 400 })
  }

  try {
    await handlePaddleWebhook(rawBody, signature)
  } catch (err) {
    console.error('[paddle-webhook] Error processing event:', err)
    return NextResponse.json({ error: 'Webhook error' }, { status: 400 })
  }

  // Always return 200 to prevent Paddle from retrying
  return NextResponse.json({ received: true })
}
