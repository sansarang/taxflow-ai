/**
 * Kakao Alimtalk Notification Service
 * ─────────────────────────────────────────────────────────────────────────────
 * Kakao Alimtalk (카카오 알림톡) uses the Kakao Biz Message API, which requires:
 *   - Kakao Business account approval
 *   - Pre-registered message templates (템플릿 심사 통과 필요)
 *   - Yellow ID (카카오 채널) setup
 *
 * TODO: Replace the placeholder implementation with the real Kakao Biz Message
 *       API calls once a Kakao Business account is available and templates are
 *       approved.  Reference: https://business.kakao.com/info/bizmessage/
 *
 * Until then, this module logs the would-be notification and returns normally
 * so the rest of the notification pipeline is unaffected.
 */

import type { OptimizationAlert } from '@/types/supabase'
import type { TaxDeadline } from './email'

// ─── Template codes ───────────────────────────────────────────────────────────
//
// These must match the template codes registered in the Kakao Business console.

const TEMPLATE_CODES = {
  optimizationAlert: 'TAXFLOW_OPT_01',
  deadlineReminder: 'TAXFLOW_DL_01',
  weeklyReport: 'TAXFLOW_WR_01',
} as const

type TemplateCode = (typeof TEMPLATE_CODES)[keyof typeof TEMPLATE_CODES]

// ─── Low-level send ───────────────────────────────────────────────────────────

/**
 * Send a Kakao Alimtalk message.
 *
 * @param phoneNumber  - Recipient's phone number (국제 형식: +821012345678)
 * @param templateCode - Pre-approved Kakao Biz Message template code
 * @param variables    - Template variable substitutions ({ key: value })
 *
 * TODO: Implement with real Kakao Biz Message API.
 *       Endpoint (partner API): POST https://alimtalk-api.kakao.com/v2/sender/{senderKey}/message
 *       Headers:
 *         Authorization: Bearer {ACCESS_TOKEN}
 *         Content-Type: application/json
 *       Body:
 *         { templateCode, recipientList: [{ recipientNo, templateParameter: variables }] }
 */
export async function sendKakaoAlert(
  phoneNumber: string,
  templateCode: string,
  variables: Record<string, string>
): Promise<void> {
  if (!process.env.KAKAO_REST_API_KEY) {
    // Silently skip in dev / when key is absent
    console.debug('[kakao] KAKAO_REST_API_KEY not set — skipping Alimtalk')
    return
  }

  // TODO: Replace with real Kakao Biz Message API call
  // Example implementation (requires approved Kakao Business account):
  //
  // const res = await fetch(
  //   `https://alimtalk-api.kakao.com/v2/sender/${KAKAO_SENDER_KEY}/message`,
  //   {
  //     method: 'POST',
  //     headers: {
  //       Authorization: `Bearer ${ACCESS_TOKEN}`,
  //       'Content-Type': 'application/json',
  //     },
  //     body: JSON.stringify({
  //       templateCode,
  //       recipientList: [{
  //         recipientNo: phoneNumber,
  //         templateParameter: variables,
  //       }],
  //     }),
  //   }
  // )
  // if (!res.ok) throw new Error(`Kakao API error: ${res.statusText}`)

  console.debug('[kakao] Alimtalk placeholder fired', {
    phoneNumber: phoneNumber.slice(0, -4) + '****',  // mask for privacy
    templateCode,
    variables,
  })
}

// ─── Typed helpers ────────────────────────────────────────────────────────────

/**
 * Send optimization alert via Kakao Alimtalk.
 * Template variables: #{userName}, #{alertCount}, #{totalSavings}, #{link}
 */
export async function sendKakaoOptimizationAlert(
  phoneNumber: string,
  userName: string,
  alerts: OptimizationAlert[]
): Promise<void> {
  const totalSavings = alerts.reduce((s, a) => s + (a.amount_impact ?? 0), 0)
  await sendKakaoAlert(phoneNumber, TEMPLATE_CODES.optimizationAlert, {
    userName,
    alertCount: String(alerts.length),
    totalSavings: totalSavings > 0 ? `${Math.round(totalSavings).toLocaleString('ko-KR')}원` : '확인 필요',
    topAlert: alerts[0]?.title ?? '',
    link: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://taxflow.ai'}/dashboard`,
  })
}

/**
 * Send deadline reminder via Kakao Alimtalk.
 * Template variables: #{userName}, #{deadlineName}, #{dueDate}, #{daysLeft}, #{link}
 */
export async function sendKakaoDeadlineReminder(
  phoneNumber: string,
  userName: string,
  deadline: TaxDeadline
): Promise<void> {
  const daysLeft = Math.ceil(
    (new Date(deadline.dueDate).getTime() - Date.now()) / 86_400_000
  )
  await sendKakaoAlert(phoneNumber, TEMPLATE_CODES.deadlineReminder, {
    userName,
    deadlineName: deadline.name,
    dueDate: deadline.dueDate,
    daysLeft: String(daysLeft),
    description: deadline.description,
    link: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://taxflow.ai'}/export`,
  })
}

/**
 * Send weekly report summary via Kakao Alimtalk.
 * Template variables: #{userName}, #{estimatedTax}, #{riskScore}, #{link}
 */
export async function sendKakaoWeeklyReport(
  phoneNumber: string,
  userName: string,
  estimatedTax: number,
  riskScore: number
): Promise<void> {
  await sendKakaoAlert(phoneNumber, TEMPLATE_CODES.weeklyReport as TemplateCode, {
    userName,
    estimatedTax: `${Math.round(estimatedTax).toLocaleString('ko-KR')}원`,
    riskScore: String(riskScore),
    riskLevel: riskScore >= 70 ? '높음' : riskScore >= 40 ? '보통' : '낮음',
    link: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://taxflow.ai'}/dashboard`,
  })
}
