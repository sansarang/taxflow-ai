import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const ipUsage = new Map<string, number>()
const DEMO_LIMIT = 3

function getIP(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
}

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  const used = ipUsage.get(ip) ?? 0
  if (used >= DEMO_LIMIT) {
    return NextResponse.json({ error: "demo_limit_reached", message: `무료 체험은 ${DEMO_LIMIT}회까지 가능합니다. 회원가입 후 무제한 이용하세요.`, upgradeRequired: true }, { status: 402 })
  }
  let body: { transactions?: unknown[]; businessType?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: "invalid_body" }, { status: 400 }) }
  const traransactions) || transactions.length === 0) {
    return NextResponse.json({ error: "no_transactions" }, { status: 400 })
  }
  const limited = transactions.slice(0, 20)
  const businessType = body.businessType || "크리에이터/프리랜서"
  try {
    const prompt = `당신은 한국 세무 전문가 AI입니다 (참고용).\n업종: ${businessType}\n\n아래 거래내역을 분석해서 각 항목의 세금 공제 가능 여부를 판단하세요.\n\n거래내역:\n${limited.map((t: any, i: number) => `${i + 1}. ${t.description || t.desc || ""} | ${t.amount}원 | ${t.date || ""}`).join("\n")}\n\n반드시 아래 JSON 배열 형식만 출력하고 다른 텍스트는 없어야 합니다:\n[\n  {\n    "index": 1,\n    "desc": "거래 설명",\n    "amount": -65000,\n    "category": "카테고리명",\n    "subCategory": "세부카테고리",\n    "isDeductible": true,\n    "deductionRatio": 1.0,\n    "confidence": 0.95,\n    "reasoning": "[참고용] 이유"\n  }\n]\n\n카테고리: 소프트웨어, 플?"user", content: prompt }] })
    const text = message.content.find(b => b.type === "text")?.text ?? "[]"
    let results: unknown[]
    try { results = JSON.parse(text.replace(/```json|```/g, "").trim()) } catch { results = [] }
    ipUsage.set(ip, used + 1)
    return NextResponse.json({ success: true, results, remainingDemoCount: DEMO_LIMIT - (used + 1), disclaimer: "[참고용] 본 분석은 AI 생성 결과이며 법적 세무 조언이 아닙니다." })
  } catch (e) {
    console.error("[demo-classify]", e)
    return NextResponse.json({ error: "ai_error", message: "AI 분석 중 오류가 발생했습니다." }, { status: 500 })
  }
}
