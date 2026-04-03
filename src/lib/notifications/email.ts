/**
 * Email Notification Service (Resend)
 * ─────────────────────────────────────────────────────────────────────────────
 * All outbound transactional email goes through this module.
 * Templates are Korean, mobile-responsive HTML with inline styles.
 * Every email includes the legal disclaimer in the footer.
 *
 * Resend API docs: https://resend.com/docs/api-reference/emails/send-email
 */

import type { OptimizationAlert } from '@/types/supabase'
import type { TaxReportData } from '@/lib/ai/reporter'

// ─── Public types ─────────────────────────────────────────────────────────────

export interface TaxDeadline {
  name: string         // "부가세 1기 예정신고"
  dueDate: string      // ISO "2026-04-25"
  description: string  // "신고 기간: 2026년 1월 ~ 3월"
  penaltyNote?: string // "무신고 시 20% 가산세 부과"
}

// ─── Constants ────────────────────────────────────────────────────────────────

const FROM = 'TaxFlow AI <noreply@taxflow.ai>'
const RESEND_API = 'https://api.resend.com/emails'
const DISCLAIMER =
  '⚠️ 본 서비스는 참고용 AI 코치입니다. 최종 신고는 사용자가 직접 또는 세무사와 함께 확인하세요. AI 판단은 법적 효력이 없습니다.'

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Send optimization alerts summary to a user.
 */
export async function sendOptimizationAlert(
  to: string,
  userName: string,
  alerts: OptimizationAlert[]
): Promise<void> {
  const subject = `[TaxFlow AI] ${userName}님, 절세 기회 ${alerts.length}건을 발견했습니다`
  const html = buildOptimizationAlertEmail(userName, alerts)
  await callResend(to, subject, html)
}

/**
 * Send weekly tax report summary.
 */
export async function sendWeeklyReport(
  to: string,
  userName: string,
  reportData: TaxReportData
): Promise<void> {
  const subject = `[TaxFlow AI] ${userName}님의 주간 세금 리포트`
  const html = buildWeeklyReportEmail(userName, reportData)
  await callResend(to, subject, html)
}

/**
 * Send an upcoming tax deadline reminder.
 */
export async function sendDeadlineReminder(
  to: string,
  userName: string,
  deadline: TaxDeadline
): Promise<void> {
  const daysLeft = Math.ceil(
    (new Date(deadline.dueDate).getTime() - Date.now()) / 86_400_000
  )
  const subject = `[TaxFlow AI] ⏰ ${deadline.name} D-${daysLeft} 마감 임박`
  const html = buildDeadlineReminderEmail(userName, deadline, daysLeft)
  await callResend(to, subject, html)
}

// ─── Low-level send helper ────────────────────────────────────────────────────

async function callResend(to: string, subject: string, html: string): Promise<void> {
  const res = await fetch(RESEND_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText)
    throw new Error(`[email] Resend API error ${res.status}: ${body}`)
  }
}

// ─── HTML template builders ───────────────────────────────────────────────────

function buildOptimizationAlertEmail(
  userName: string,
  alerts: OptimizationAlert[]
): string {
  const totalImpact = alerts.reduce((s, a) => s + (a.amount_impact ?? 0), 0)
  const alertRows = alerts
    .map(
      (a) => `
      <tr>
        <td style="padding:14px 0;border-bottom:1px solid #e2e8f0;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;">
            <div>
              <span style="display:inline-block;background:${alertBadgeColor(a.alert_type)};color:#fff;
                font-size:11px;padding:2px 8px;border-radius:12px;margin-bottom:6px;">
                ${alertTypeLabel(a.alert_type)}
              </span>
              <div style="font-size:15px;font-weight:600;color:#1e293b;">${a.title}</div>
              <div style="font-size:13px;color:#64748b;margin-top:4px;">${a.body}</div>
            </div>
            ${
              a.amount_impact
                ? `<div style="font-size:15px;font-weight:700;color:#16a34a;white-space:nowrap;margin-left:16px;">
                     ₩${formatKRW(a.amount_impact)}
                   </div>`
                : ''
            }
          </div>
        </td>
      </tr>`
    )
    .join('')

  return layout(`
    <h2 style="margin:0 0 8px;font-size:22px;color:#1e293b;">안녕하세요, ${escHtml(userName)}님 👋</h2>
    <p style="margin:0 0 24px;font-size:15px;color:#475569;">
      AI가 거래 내역을 분석하여 <strong>${alerts.length}건</strong>의 절세 기회를 발견했습니다.
    </p>

    ${
      totalImpact > 0
        ? `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;
                       padding:16px 20px;margin-bottom:24px;text-align:center;">
             <div style="font-size:13px;color:#16a34a;font-weight:600;margin-bottom:4px;">예상 절감 가능 금액</div>
             <div style="font-size:28px;font-weight:800;color:#15803d;">₩${formatKRW(totalImpact)}</div>
           </div>`
        : ''
    }

    <table style="width:100%;border-collapse:collapse;">
      <tbody>${alertRows}</tbody>
    </table>

    <div style="margin-top:28px;text-align:center;">
      <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://taxflow.ai'}/dashboard"
         style="display:inline-block;background:#2563eb;color:#fff;font-size:15px;font-weight:600;
                padding:14px 32px;border-radius:8px;text-decoration:none;">
        TaxFlow AI에서 확인하기 →
      </a>
    </div>
  `)
}

function buildWeeklyReportEmail(
  userName: string,
  report: TaxReportData
): string {
  const topCategoryRows = report.topCategories
    .slice(0, 5)
    .map(
      (c) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;font-size:14px;color:#475569;">${escHtml(c.label)}</td>
        <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;font-size:14px;color:#1e293b;
                   font-weight:600;text-align:right;">₩${formatKRW(c.amount)}</td>
      </tr>`
    )
    .join('')

  const riskColor = report.riskScore >= 70 ? '#dc2626' : report.riskScore >= 40 ? '#d97706' : '#16a34a'
  const riskLabel = report.riskScore >= 70 ? '높음' : report.riskScore >= 40 ? '보통' : '낮음'

  return layout(`
    <h2 style="margin:0 0 8px;font-size:22px;color:#1e293b;">주간 세금 리포트</h2>
    <p style="margin:0 0 24px;font-size:14px;color:#64748b;">${report.period} · ${escHtml(userName)}님</p>

    <!-- KPI cards -->
    <table style="width:100%;border-collapse:separate;border-spacing:8px;margin-bottom:24px;">
      <tr>
        <td style="background:#f8fafc;border-radius:10px;padding:16px;width:50%;vertical-align:top;">
          <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;">총 수입</div>
          <div style="font-size:20px;font-weight:700;color:#1e293b;margin-top:6px;">₩${formatKRW(report.totalIncome)}</div>
        </td>
        <td style="background:#f8fafc;border-radius:10px;padding:16px;width:50%;vertical-align:top;">
          <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;">총 지출</div>
          <div style="font-size:20px;font-weight:700;color:#1e293b;margin-top:6px;">₩${formatKRW(report.totalExpense)}</div>
        </td>
      </tr>
      <tr>
        <td style="background:#f8fafc;border-radius:10px;padding:16px;vertical-align:top;">
          <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;">예상 세금</div>
          <div style="font-size:20px;font-weight:700;color:#dc2626;margin-top:6px;">₩${formatKRW(report.estimatedTax)}</div>
        </td>
        <td style="background:#f8fafc;border-radius:10px;padding:16px;vertical-align:top;">
          <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;">리스크 점수</div>
          <div style="font-size:20px;font-weight:700;color:${riskColor};margin-top:6px;">${report.riskScore}점 <span style="font-size:13px;">(${riskLabel})</span></div>
        </td>
      </tr>
    </table>

    <!-- AI Summary -->
    <div style="background:#eff6ff;border-left:4px solid #2563eb;border-radius:0 8px 8px 0;padding:16px 20px;margin-bottom:24px;">
      <div style="font-size:13px;color:#1d4ed8;font-weight:600;margin-bottom:8px;">🤖 AI 요약</div>
      <div style="font-size:14px;color:#1e3a8a;">${escHtml(report.summary.headline)}</div>
      ${
        report.summary.actionRequired
          ? `<div style="font-size:13px;color:#1d4ed8;margin-top:10px;font-weight:600;">
               📌 조치 필요: ${escHtml(report.summary.actionRequired)}
             </div>`
          : ''
      }
    </div>

    <!-- Top categories -->
    ${
      topCategoryRows
        ? `<div style="margin-bottom:24px;">
             <div style="font-size:14px;font-weight:600;color:#1e293b;margin-bottom:12px;">지출 카테고리 TOP 5</div>
             <table style="width:100%;border-collapse:collapse;">
               <tbody>${topCategoryRows}</tbody>
             </table>
           </div>`
        : ''
    }

    <div style="text-align:center;">
      <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://taxflow.ai'}/dashboard"
         style="display:inline-block;background:#2563eb;color:#fff;font-size:15px;font-weight:600;
                padding:14px 32px;border-radius:8px;text-decoration:none;">
        전체 리포트 보기 →
      </a>
    </div>
  `)
}

function buildDeadlineReminderEmail(
  userName: string,
  deadline: TaxDeadline,
  daysLeft: number
): string {
  const urgencyColor = daysLeft <= 3 ? '#dc2626' : daysLeft <= 7 ? '#d97706' : '#2563eb'
  const urgencyBg = daysLeft <= 3 ? '#fef2f2' : daysLeft <= 7 ? '#fffbeb' : '#eff6ff'

  return layout(`
    <h2 style="margin:0 0 8px;font-size:22px;color:#1e293b;">마감 임박 알림</h2>
    <p style="margin:0 0 24px;font-size:15px;color:#475569;">
      ${escHtml(userName)}님, 세금 신고 마감일이 다가오고 있습니다.
    </p>

    <div style="background:${urgencyBg};border:2px solid ${urgencyColor};border-radius:12px;padding:24px;margin-bottom:24px;text-align:center;">
      <div style="font-size:13px;color:${urgencyColor};font-weight:600;letter-spacing:1px;margin-bottom:8px;">
        D-${daysLeft}
      </div>
      <div style="font-size:24px;font-weight:800;color:#1e293b;margin-bottom:8px;">
        ${escHtml(deadline.name)}
      </div>
      <div style="font-size:15px;color:#475569;margin-bottom:8px;">
        📅 마감일: <strong>${formatDate(deadline.dueDate)}</strong>
      </div>
      <div style="font-size:14px;color:#64748b;">${escHtml(deadline.description)}</div>
    </div>

    ${
      deadline.penaltyNote
        ? `<div style="background:#fef2f2;border-radius:8px;padding:14px 16px;margin-bottom:24px;
                       font-size:13px;color:#b91c1c;">
             ⚠️ ${escHtml(deadline.penaltyNote)}
           </div>`
        : ''
    }

    <div style="background:#f8fafc;border-radius:10px;padding:16px 20px;margin-bottom:24px;">
      <div style="font-size:14px;font-weight:600;color:#1e293b;margin-bottom:12px;">체크리스트</div>
      <div style="font-size:14px;color:#475569;line-height:2;">
        ☐ 거래내역 CSV 업로드 완료 확인<br>
        ☐ AI 분류 결과 검토 및 수정<br>
        ☐ 영수증 미첨부 항목 처리<br>
        ☐ 최종 세금 신고서 검토<br>
        ☐ 홈택스(hometax.go.kr) 신고
      </div>
    </div>

    <div style="text-align:center;">
      <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://taxflow.ai'}/export"
         style="display:inline-block;background:#2563eb;color:#fff;font-size:15px;font-weight:600;
                padding:14px 32px;border-radius:8px;text-decoration:none;">
        신고서 내보내기 →
      </a>
    </div>
  `)
}

// ─── Shared layout wrapper ────────────────────────────────────────────────────

function layout(content: string): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>TaxFlow AI</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Apple SD Gothic Neo','맑은 고딕','나눔고딕',sans-serif;">
  <table style="width:100%;background:#f1f5f9;" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table style="max-width:600px;width:100%;background:#fff;border-radius:16px;
                      box-shadow:0 1px 3px rgba(0,0,0,0.1);overflow:hidden;" cellpadding="0" cellspacing="0">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1e293b 0%,#0f172a 100%);
                       padding:28px 32px;text-align:center;">
              <span style="font-size:22px;font-weight:800;color:#fff;letter-spacing:-0.5px;">
                TaxFlow <span style="color:#60a5fa;">AI</span>
              </span>
              <div style="font-size:11px;color:#94a3b8;margin-top:4px;letter-spacing:2px;">
                크리에이터 세금 AI 코치
              </div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              ${content}
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="height:1px;background:#e2e8f0;"></td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;background:#f8fafc;">
              <p style="margin:0 0 8px;font-size:12px;color:#94a3b8;line-height:1.6;">
                ${DISCLAIMER}
              </p>
              <p style="margin:0;font-size:11px;color:#cbd5e1;">
                TaxFlow AI · 이 이메일은 자동 발송되었습니다.
                수신 설정은 <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://taxflow.ai'}/settings"
                style="color:#60a5fa;text-decoration:none;">설정 페이지</a>에서 변경하실 수 있습니다.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

// ─── Template helpers ─────────────────────────────────────────────────────────

function escHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatKRW(amount: number): string {
  return Math.abs(Math.round(amount)).toLocaleString('ko-KR')
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`
}

function alertTypeLabel(type: OptimizationAlert['alert_type']): string {
  const map: Record<string, string> = {
    receipt_missing: '영수증 누락',
    deduction_found: '공제 발견',
    tax_deadline: '신고 마감',
    law_change: '세법 변경',
    saving_opportunity: '절세 기회',
  }
  return map[type] ?? type
}

function alertBadgeColor(type: OptimizationAlert['alert_type']): string {
  const map: Record<string, string> = {
    receipt_missing: '#dc2626',
    deduction_found: '#16a34a',
    tax_deadline: '#d97706',
    law_change: '#7c3aed',
    saving_opportunity: '#0891b2',
  }
  return map[type] ?? '#64748b'
}

// ─── Backward-compat generic helper (used by push-dispatcher legacy code) ────

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string
  subject: string
  html: string
}): Promise<void> {
  await callResend(to, subject, html)
}

export { buildWeeklyReportEmail as buildWeeklyReportEmailLegacy }
