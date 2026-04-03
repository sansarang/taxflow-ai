/**
 * Paddle Payments — Server-Side Only (Billing v2)
 * ─────────────────────────────────────────────────────────────────────────────
 * Paddle acts as Merchant of Record:
 *   • Korean VAT handled automatically
 *   • KRW pricing and Korean payment methods supported
 *   • No separate VAT calculation needed
 *
 * NEVER import this module in client components.
 * Uses lazy initialisation so the module can be imported at build time.
 */

import { Environment, EventName, LogLevel, Paddle } from '@paddle/paddle-node-sdk'
import type { CreateTransactionRequestBody } from '@paddle/paddle-node-sdk'

// ─── Singleton factory ────────────────────────────────────────────────────────

function getPaddle(): Paddle {
  if (!process.env.PADDLE_API_KEY) throw new Error('PADDLE_API_KEY is not set')
  return new Paddle(process.env.PADDLE_API_KEY, {
    environment:
      process.env.PADDLE_ENVIRONMENT === 'production'
        ? Environment.production
        : Environment.sandbox,
    logLevel: LogLevel.error,
  })
}

// ─── Checkout ─────────────────────────────────────────────────────────────────

/**
 * Create a Paddle-hosted checkout transaction and return the redirect URL.
 * `userId`, `plan`, and `referralCode` are stored in customData so the
 * webhook can update the DB after a successful payment.
 */
export async function createPaddleCheckoutSession(
  userId:       string,
  email:        string,
  plan:         'pro' | 'business',
  referralCode?: string
): Promise<string> {
  const paddle  = getPaddle()
  const priceId = plan === 'pro'
    ? process.env.PADDLE_PRO_PRICE_ID!
    : process.env.PADDLE_BUSINESS_PRICE_ID!
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://taxflow.ai'

  // Use `as any` for undocumented-but-supported REST fields (customer.email,
  // checkout.url) that the TypeScript SDK types don't yet expose.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body: any = {
    items:      [{ priceId, quantity: 1 }],
    customData: { userId, plan, referralCode: referralCode ?? '' },
    customer:   { email },
    checkout:   { url: `${baseUrl}/dashboard?upgraded=true` },
  } satisfies Omit<CreateTransactionRequestBody, 'customer' | 'checkout'> & Record<string, unknown>

  const txn = await paddle.transactions.create(body as CreateTransactionRequestBody)

  // `checkout.url` is set when the transaction is in a ready/checkout state
  if (txn.checkout?.url) return txn.checkout.url

  // Fallback: direct Paddle checkout URL by transaction ID
  const subdomain = process.env.PADDLE_ENVIRONMENT === 'production' ? '' : 'sandbox-'
  return `https://${subdomain}buy.paddle.com/checkout/${txn.id}`
}

// ─── Customer portal ──────────────────────────────────────────────────────────

/**
 * Return the Paddle customer self-serve portal URL.
 * Customers can manage subscriptions, update payment methods, and view invoices.
 */
export function getPaddleCustomerPortalUrl(customerId: string): string {
  const base =
    process.env.PADDLE_ENVIRONMENT === 'production'
      ? 'https://customer.paddle.com'
      : 'https://sandbox-customer.paddle.com'
  return `${base}/subscriptions?customer_id=${customerId}`
}

// ─── Webhook handler ──────────────────────────────────────────────────────────

/**
 * Verify a Paddle webhook signature and dispatch business logic.
 * Called from POST /api/webhook/paddle after reading the raw request body.
 */
export async function handlePaddleWebhook(
  rawBody:   string,
  signature: string
): Promise<void> {
  const paddle = getPaddle()
  const secret = process.env.PADDLE_WEBHOOK_SECRET

  if (!secret) throw new Error('PADDLE_WEBHOOK_SECRET is not set')

  // Verify signature and parse event
  const event = await paddle.webhooks.unmarshal(rawBody, secret, signature)
  if (!event) throw new Error('Paddle webhook: invalid signature or empty payload')

  const { createAdminClient } = await import('@/lib/supabase/server')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any

  switch (event.eventType) {
    // ── Subscription activated (new purchase) ──────────────────────────────
    case EventName.SubscriptionActivated:
    // ── Subscription changed (upgrade / downgrade) ─────────────────────────
    case EventName.SubscriptionUpdated: {
      const sub = event.data
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const customData = (sub as any).customData as Record<string, string> | null
      const userId     = customData?.userId
      if (!userId) break

      const plan       = (customData?.plan ?? 'pro') as 'pro' | 'business'
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const customerId = (sub as any).customerId as string
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const subId      = (sub as any).id as string

      await db.from('users_profile').update({
        plan,
        stripe_customer_id:     customerId,   // column reused for Paddle customer id
        stripe_subscription_id: subId,        // column reused for Paddle subscription id
      }).eq('id', userId)

      // Referral reward: give referrer +1 free month
      const referralCode = customData?.referralCode
      if (referralCode) {
        const { data: referrer } = await db
          .from('users_profile')
          .select('id, free_months_remaining')
          .eq('referral_code', referralCode)
          .single()
        if (referrer) {
          await db
            .from('users_profile')
            .update({ free_months_remaining: (referrer.free_months_remaining ?? 0) + 1 })
            .eq('id', referrer.id)
        }
      }

      console.info(`[paddle-webhook] ${event.eventType} — userId: ${userId}, plan: ${plan}`)
      break
    }

    // ── Subscription cancelled ──────────────────────────────────────────────
    case EventName.SubscriptionCanceled: {
      const sub = event.data
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const customData = (sub as any).customData as Record<string, string> | null
      const userId     = customData?.userId
      if (!userId) break

      await db.from('users_profile').update({
        plan:                   'free',
        stripe_subscription_id: null,
      }).eq('id', userId)

      console.info(`[paddle-webhook] subscription.canceled — userId: ${userId}`)
      break
    }

    // ── Transaction completed (payment successful / renewal) ───────────────
    case EventName.TransactionCompleted: {
      const txn = event.data
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const customData = (txn as any).customData as Record<string, string> | null
      const userId     = customData?.userId
      if (!userId) break

      // Reset monthly classify count on each successful payment
      await db.from('users_profile').update({
        monthly_classify_count:   0,
        monthly_classify_reset_at: new Date().toISOString(),
      }).eq('id', userId)

      console.info(`[paddle-webhook] transaction.completed — usage reset for userId: ${userId}`)
      break
    }

    default:
      break
  }
}
