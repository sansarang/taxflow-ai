const fs = require('fs')
const content = `import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"

const ipUsage = new Map()
const DEMO_LIMIT = 3

function getIP(req) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
}

export async function POST(req: NextRequest) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const ip = getIP(req)
  const used = ipUsage.get(ip) ?? 0
  if (used >= DEMO_LIMIT) {
    return NextResponse.json({ error: "demo_limit_reached", message: "무료 체험은 " + DEMO_LIMIT + "회까지 가능합니다.", upgradeRequired: true }, { status: 402 })
  }

  let body: any
  try { body = await req.json() }
  catch { return NextResponse.json({ error: "invalid_body" }, { status: 400 }) }

  const businessType = body.businessType || "크리에이터/프리랜서"
  const jsonPrompt = "반드시 아래 JSON 배열 형식만 출력하세요:\\n[{\\\"index\\\"고리\\\",\\\"subCategory\\\":\\\"세부\\\",\\\"isDeductible\\\":true,\\\"deductionRatio\\\":1.0,\\\"confidence\\\":0.95,\\\"reasoning\\\":\\\"[참고용] 이유\\\"}]\\n카테고리: 소프트웨어,플랫폼수수료,통신비,교통비,숙박비,식비,사무용품,장비구입,인건비,마케팅비,교육훈련비,임차료,개인지출,기타"

  try {
    let results: any[] = []

    if (body.imageBase64 && body.imageMimeType) {
      const mimeType = body.imageMimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp"
      const msg = await client.messages.create({
        model: "claude-opus-4-5",
        max_tokens: 2000,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mimeType, data: body.imageBase64 } },
            { type: "text", text: "이 영수증/거래명세표를 분석해서 거래항목과 금액을 추출하고 세금공제 여부를 판단하세요. 업종: " + businessType + "\\n" + json)) } catch { results = [] }

    } else if (Array.isArray(body.transactions) && body.transactions.length > 0) {
      const txList = body.transactions.slice(0, 20).map((t: any, i: number) =>
        (i+1) + ". " + (t.description||t.desc||"") + " | " + t.amount + "원 | " + (t.date||"")
      ).join("\\n")
      const msg = await client.messages.create({
        model: "claude-opus-4-5",
        max_tokens: 2000,
        messages: [{ role: "user", content: "한국 세무전문가 AI(참고용). 업종: " + businessType + "\\n거래내역:\\n" + txList + "\\n" + jsonPrompt }]
      })
      const text = (msg.content.find((b: any) => b.type === "text") as any)?.text ?? "[]"
      try { results = JSON.parse(text.replace(/\`\`\`json|\`\`\`/g, "").trim()) } catch { results = [] }

    } else {
      return NextResponse.json({ error: "no_data" }, { status: 400 })
    }

    ipUsage.set(ip, used + 1)
    return NextResponse.json({ success: true, results, remainingDemoCount: DEMO_LIMIT - (used + 1), disclaimer: "[?" })
  } catch (e) {
    console.error("[demo-classify]", e)
    return NextResponse.json({ error: "ai_error", message: "AI 분석 중 오류가 발생했습니다." }, { status: 500 })
  }
}`

fs.writeFileSync('src/app/api/demo-classify/route.ts', content, 'utf8')
console.log('done')
