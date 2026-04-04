const fs = require('fs')

const route = `import { NextRequest, NextResponse } from "next/server"
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
    return NextResponse.json({
      error: "demo_limit_reached",
      message: \`무료 체험은 \${DEMO_LIMIT}회까지 가능합니다. 회원가입 후 무제한 이용하세요.\`,
      upgradeRequired: true,
    }, { status: 402 })
  }

  let body: { transactions?: any[]; imageBase64?: string; imageMimeType?: string; businessType?: string }
  try { body = await req.json() }
  catch { return NextResponse.json({ error: "invalid_body" }, { status: 400 }) }

  const businessT let results: any[] = []

    // 이미지 OCR 분석
    if (body.imageBase64 && body.imageMimeType) {
      const message = await client.messages.create({
        model: "claude-opus-4-5",
        max_tokens: 2000,
        messages: [{
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: body.imageMimeType as any, data: body.imageBase64 }
            },
            {
              type: "text",
              text: \`이 영수증/거래명세표/거래내역 이미지를 분석해서 거래 항목들을 추출하고 세금 공제 가능 여부를 판단하세요.
업종: \${businessType}

반드시 아래 JSON 배열 형식만 출력하고 다른 텍스트는 없어야 합니다:
[
  {
    "index": 1,
    "desc": "거래 설명",
    "amount": -65000,
    "category": "카테고리명",
    "subCategory": "세부카테고리",
    "isDeductible": true,
    "deductionRatio": 1.0,
    "confidence": 0.95,
    "reasoning": "const text = message.content.find((b: any) => b.type === "text")?.text ?? "[]"
      try { results = JSON.parse(text.replace(/\`\`\`json|\`\`\`/g, "").trim()) } catch { results = [] }

    } else {
      // 텍스트 거래내역 분석
      const transactions = body.transactions
      if (!Array.isArray(transactions) || transactions.length === 0) {
        return NextResponse.json({ error: "no_transactions" }, { status: 400 })
      }
      const limited = transactions.slice(0, 20)
      const txList = limited.map((t: any, i: number) =>
        \`\${i + 1}. \${t.description || t.desc || ""} | \${t.amount}원 | \${t.date || ""}\`
      ).join("\\n")

      const message = await client.messages.create({
        model: "claude-opus-4-5",
        max_tokens: 2000,
        messages: [{ role: "user", content: \`당신은 한국 세무 전문가 AI입니다 (참고용).
업종: \${businessType}

아래 거래내역을 분석해서 각 항목의 세금 공제 가능 여부를 판단하세요.

거래내역:
\${txgory": "카테고리명",
    "subCategory": "세부카테고리",
    "isDeductible": true,
    "deductionRatio": 1.0,
    "confidence": 0.95,
    "reasoning": "[참고용] 이유"
  }
]

카테고리: 소프트웨어, 플랫폼수수료, 통신비, 교통비, 숙박비, 식비, 사무용품, 장비구입, 인건비, 마케팅비, 교육훈련비, 임차료, 개인지출, 기타
모든 reasoning은 "[참고용]"으로 시작하고 "~가능성 있음" 표현만 사용하세요.\` }]
      })
      const text = message.content.find((b: any) => b.type === "text")?.text ?? "[]"
      try { results = JSON.parse(text.replace(/\`\`\`json|\`\`\`/g, "").trim()) } catch { results = [] }
    }

    ipUsage.set(ip, used + 1)
    return NextResponse.json({
      success: true,
      results,
      remainingDemoCount: DEMO_LIMIT - (used + 1),
      disclaimer: "[참고용] 본 분석은 AI 생성 결과이며 법적 세무 조언이 아닙니다.",
    })
  } catch (e) {
    console.error("[demo-classify]", e)
    returnc('src/app/page.tsx', 'utf8')
p = p.replace(
  `    if (file.type.startsWith("image/")) {
      transactions = [{ description: file.name, amount: 0, date: new Date().toISOString().slice(0, 10) }]
    } else {`,
  `    if (file.type.startsWith("image/")) {
      // 이미지는 base64로 변환해서 Vision API로 분석
      const reader = new FileReader()
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve((reader.result as string).split(",")[1])
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      setFileName(file.name)
      setPhase("uploading")
      setUploadPct(0)
      setError(null)
      let up = 0
      await new Promise<void>(resolve => {
        const t = setInterval(() => {
          up += 15
          if (up >= 100) { setUploadPct(100); clearInterval(t); resolve() }
          else setUploadPct(up)
        }, 60)
      })
      await new Promise(r => setTimeout(r, 400))
      setPhase("analyzing")
      setAp = 0
      const apTimer = setInterval(() => {
        ap += 3
        if (ap >= 90) { ap = 90; clearInterval(apTimer) }
        setAnalyzePct(ap)
      }, 150)
      try {
        const res = await fetch("/api/demo-classify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: base64, imageMimeType: file.type }),
        })
        const data = await res.json()
        clearInterval(apTimer)
        setAnalyzePct(100)
        await new Promise(r => setTimeout(r, 300))
        if (data.upgradeRequired) { setError(data.message); setPhase("idle"); return }
        if (!data.success || !data.results || data.results.length === 0) {
          setError(data.message || "분석 결과가 없습니다.")
          setPhase("idle")
          return
        }
        onComplete(data.results as TxResult[])
      } catch {
        clearInterval(apTimer)
        setError("네트워크 오류가 발생했습니다.")
        setPhase("idle")teFileSync('src/app/page.tsx', p, 'utf8')
console.log('page done')
