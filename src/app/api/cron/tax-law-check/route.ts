/**
 * Cron: Monthly Tax Law Change Monitor
 * ─────────────────────────────────────────────────────────────────────────────
 * Vercel Cron schedule: 0 0 1 * *  (00:00 UTC on the 1st of each month)
 *
 * Queries Claude for known or upcoming Korean tax law changes affecting:
 *   - 부가가치세법 (VAT Act)
 *   - 소득세법 (Income Tax Act)
 *   - 조세특례제한법 (Special Tax Treatment Control Act)
 *
 * If Claude reports any changes:
 *   1. Upsert affected rows in `tax_law_table`
 *   2. Insert `law_change` alerts for ALL users
 *
 * Note: Claude's knowledge has a training cutoff, so this surfaces enacted or
 * announced changes known at that time.  Human review is still recommended
 * before acting on any detected changes.
 */

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase/server'
import { SYSTEM_PROMPT_BASE, DISCLAIMER } from '@/lib/ai/prompts'

// ─── Auth guard ───────────────────────────────────────────────────────────────

function verifyCronSecret(request: NextRequest): boolean {
  return request.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface TaxLawChange {
  category: string        // 'vat' | 'income_tax' | 'special_tax' | etc.
  key: string             // unique key for upsert, e.g. 'vat_standard_rate_2027'
  value: Record<string, unknown>
  description: string     // Korean description of the change
  effectiveYear: number
  changeSummary: string   // Short Korean summary for user alert
  severity: 'minor' | 'moderate' | 'major'
}

interface ClaudeResponse {
  hasChanges: boolean
  changes: TaxLawChange[]
  checkedAt: string
  disclaimer: string
}

// ─── Claude prompt ────────────────────────────────────────────────────────────

const TAX_LAW_CHECK_PROMPT = `
현재 연도를 기준으로 한국 세법에 변경된 내용이 있는지 분석해주세요.
분석 대상: 부가가치세법, 소득세법, 조세특례제한법

다음 JSON 형식으로만 응답하세요 (JSON 외 텍스트 절대 금지):

{
  "hasChanges": true | false,
  "changes": [
    {
      "category": "vat" | "income_tax" | "special_tax" | "creator_deductions" | "other",
      "key": "유니크_키_영문_언더스코어",
      "value": { /* 변경된 값 또는 규정 내용 */ },
      "description": "한국어로 변경 내용 설명",
      "effectiveYear": 2026,
      "changeSummary": "사용자에게 보여줄 30자 이내 한국어 요약",
      "severity": "minor" | "moderate" | "major"
    }
  ],
  "checkedAt": "${new Date().toISOString()}",
  "disclaimer": "${DISCLAIMER}"
}

변경사항이 없거나 확인 불가한 경우 hasChanges: false, changes: [] 로 응답하세요.
추측이나 불확실한 정보는 포함하지 마세요.
`.trim()

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startedAt = Date.now()

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const db = createAdminClient()
    const year = new Date().getFullYear()

    // ── Ask Claude about tax law changes ─────────────────────────────────────
    let parsed: ClaudeResponse

    try {
      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 3000,
        system: SYSTEM_PROMPT_BASE,
        messages: [{ role: 'user', content: TAX_LAW_CHECK_PROMPT }],
      })

      const content = message.content[0]
      if (content.type !== 'text') throw new Error('Non-text Claude response')

      const clean = content.text
        .replace(/^```(?:json)?\n?/m, '')
        .replace(/\n?```$/m, '')
        .trim()

      parsed = JSON.parse(clean) as ClaudeResponse
    } catch (claudeErr) {
      console.error('[cron/tax-law-check] Claude error:', claudeErr)
      return NextResponse.json(
        { error: 'Claude API 오류', detail: String(claudeErr) },
        { status: 500 }
      )
    }

    if (!parsed.hasChanges || parsed.changes.length === 0) {
      console.info('[cron/tax-law-check] No tax law changes detected')
      return NextResponse.json({
        success: true,
        hasChanges: false,
        message: '세법 변경사항 없음',
        elapsed: Date.now() - startedAt,
      })
    }

    // ── Upsert changed rows in tax_law_table ──────────────────────────────────
    const upsertRows = parsed.changes.map((c) => ({
      category: c.category,
      key: `${c.key}_${year}`,
      value: c.value,
      description: c.description,
      effective_year: c.effectiveYear,
      updated_at: new Date().toISOString(),
    }))

    const { error: upsertErr } = await (db as any)
      .from('tax_law_table')
      .upsert(upsertRows, { onConflict: 'key' })

    if (upsertErr) {
      console.error('[cron/tax-law-check] Upsert error:', upsertErr)
    }

    // ── Fetch all user IDs to insert alerts ────────────────────────────────
    const { data: users, error: usersErr } = await (db as any)
      .from('users_profile')
      .select('id')

    if (usersErr || !users) {
      throw new Error(`Failed to fetch users: ${usersErr?.message}`)
    }

    // Build one alert per significant change per user
    // For efficiency, only alert for moderate/major changes
    const alertableChanges = parsed.changes.filter(
      (c) => c.severity === 'moderate' || c.severity === 'major'
    )

    if (alertableChanges.length > 0) {
      const alertRows = users.flatMap((u: { id: string }) =>
        alertableChanges.map((c) => ({
          user_id: u.id,
          alert_type: 'law_change' as const,
          title: `[세법 변경] ${c.changeSummary}`,
          body: `${c.description}\n\n적용 연도: ${c.effectiveYear}년\n\n${DISCLAIMER}`,
          amount_impact: null,
          is_read: false,
          is_pushed: false,
        }))
      )

      // Batch insert in chunks of 500 to avoid Supabase request size limits
      const CHUNK = 500
      for (let i = 0; i < alertRows.length; i += CHUNK) {
        const chunk = alertRows.slice(i, i + CHUNK)
        const { error: alertErr } = await (db as any)
          .from('optimization_alerts')
          .insert(chunk)

        if (alertErr) {
          console.error(`[cron/tax-law-check] Alert insert error (chunk ${i}):`, alertErr)
        }
      }
    }

    console.info(
      `[cron/tax-law-check] Complete — changes: ${parsed.changes.length}, ` +
      `alerted: ${alertableChanges.length}, users: ${users.length}`
    )

    return NextResponse.json({
      success: true,
      hasChanges: true,
      changesDetected: parsed.changes.length,
      alertsSent: alertableChanges.length,
      changesSummary: parsed.changes.map((c) => ({
        category: c.category,
        summary: c.changeSummary,
        severity: c.severity,
        effectiveYear: c.effectiveYear,
      })),
      elapsed: Date.now() - startedAt,
    })
  } catch (error) {
    console.error('[cron/tax-law-check] Fatal error:', error)
    return NextResponse.json(
      { error: '세법 변경사항 확인 실패', detail: String(error) },
      { status: 500 }
    )
  }
}
