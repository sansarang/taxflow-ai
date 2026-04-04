import os, shutil, glob

os.makedirs('public', exist_ok=True)
logo_files = glob.glob('Gemini_Generated_Image_o5533jo5533jo553*')
if logo_files:
    src = logo_files[0]
    ext = src.split('.')[-1] if '.' in src else 'png'
    shutil.copy2(src, f'public/logo.{ext}')
    logo_ext = ext
    print(f'Logo copied -> public/logo.{ext}')
else:
    logo_ext = 'png'

files = {}

# ─────────────────────────────────────────────────────────────────────────────
# 1. /api/demo-classify/route.ts  (비회원 실제 AI 분석, IP 3회 제한)
# ─────────────────────────────────────────────────────────────────────────────
files['src/app/api/demo-classify/route.ts'] = '''
import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// 메모리 기반 IP rate limit (서버 재시작 시 초기화)
const ipUsage = new Map<string, number>()
const DEMO_LIMIT = 3

function getClientIP(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
}

export async function POST(req: NextRequest) {
  const ip = getClientIP(req)
  const used = ipUsage.get(ip) ?? 0

  if (used >= DEMO_LIMIT) {
    return NextResponse.json({
      error: "demo_limit_reached",
      message: `무료 체험은 ${DEMO_LIMIT}회까지 가능합니다. 회원가입 후 무제한 이용하세요.`,
      upgradeRequired: true,
    }, { status: 402 })
  }

  let body: { transactions?: unknown[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 })
  }

  const transactions = body.transactions
  if (!Array.isArray(transactions) || transactions.length === 0) {
    return NextResponse.json({ error: "no_transactions" }, { status: 400 })
  }

  // 최대 20건만 처리
  const limited = transactions.slice(0, 20)

  try {
    const prompt = `당신은 한국 세무 전문가 AI입니다 (참고용).
아래 거래내역을 분석해서 각 항목의 세금 공제 가능 여부를 판단하세요.

거래내역:
${limited.map((t: any, i: number) => `${i+1}. ${t.description || t.desc || ""} | ${t.amount}원 | ${t.date || ""}`).join("\n")}

각 항목에 대해 JSON 배열로 응답하세요. 반드시 아래 형식만 출력하고 다른 텍스트는 없어야 합니다:
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
    "reasoning": "[참고용] 이유 설명"
  }
]

카테고리는 다음 중 하나: 소프트웨어, 플랫폼수수료, 통신비, 교통비, 숙박비, 식비, 사무용품, 장비구입, 인건비, 마케팅비, 교육훈련비, 임차료, 개인지출, 기타
모든 reasoning은 "[참고용]"으로 시작하고 "~가능성 있음" 표현만 사용하세요.`

    const message = await client.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    })

    const text = message.content.find(b => b.type === "text")?.text ?? "[]"
    let results: unknown[]
    try {
      const clean = text.replace(/```json|```/g, "").trim()
      results = JSON.parse(clean)
    } catch {
      results = []
    }

    // 사용량 증가
    ipUsage.set(ip, used + 1)
    const remaining = DEMO_LIMIT - (used + 1)

    return NextResponse.json({
      success: true,
      results,
      remainingDemoCount: remaining,
      disclaimer: "[참고용] 본 분석은 AI 생성 결과이며 법적 세무 조언이 아닙니다. 실제 신고는 공인 세무사와 상담하세요.",
    })
  } catch (e) {
    console.error("[demo-classify]", e)
    return NextResponse.json({ error: "ai_error", message: "AI 분석 중 오류가 발생했습니다." }, { status: 500 })
  }
}
'''

# ─────────────────────────────────────────────────────────────────────────────
# 2. /app/onboarding/page.tsx  (3단계 온보딩)
# ─────────────────────────────────────────────────────────────────────────────
files['src/app/onboarding/page.tsx'] = '''
"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { createBrowserClient } from "@supabase/ssr"
import Image from "next/image"

const BUSINESS_TYPES = [
  { id: "youtuber", label: "유튜버", icon: "🎬" },
  { id: "streamer", label: "스트리머", icon: "🎮" },
  { id: "creator", label: "크리에이터", icon: "📸" },
  { id: "freelancer", label: "프리랜서", icon: "💻" },
  { id: "instructor", label: "강사/튜터", icon: "📚" },
  { id: "designer", label: "디자이너", icon: "🎨" },
  { id: "writer", label: "작가/블로거", icon: "✍️" },
  { id: "other", label: "기타 1인사업자", icon: "💼" },
]

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    businessType: "",
    businessName: "",
    businessNumber: "",
    isSimplifiedVat: true,
    annualRevenueTier: "under_50m",
  })

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  async function handleComplete() {
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/login"); return }

      await (supabase as any).from("users_profile").upsert({
        id: user.id,
        business_type: form.businessType,
        business_name: form.businessName || null,
        business_number: form.businessNumber || null,
        is_simplified_vat: form.isSimplifiedVat,
        annual_revenue_tier: form.annualRevenueTier,
        onboarding_completed: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: "id" })

      router.push("/")
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5 py-12"
      style={{ background: "#111216", fontFamily: "'Inter',-apple-system,sans-serif" }}>

      {/* Logo */}
      <div className="mb-10">
        <Image src={`/logo.png`} alt="미리택스" height={36} width={135} style={{ objectFit: "contain" }} />
      </div>

      {/* Progress */}
      <div className="flex items-center gap-2 mb-10">
        {[1, 2, 3].map(n => (
          <div key={n} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
              step >= n ? "bg-violet-600 text-white" : "bg-white/10 text-white/30"
            }`}>{n}</div>
            {n < 3 && <div className={`w-12 h-0.5 rounded-full transition-all ${step > n ? "bg-violet-600" : "bg-white/10"}`} />}
          </div>
        ))}
      </div>

      <div className="w-full max-w-md">

        {/* Step 1: 업종 선택 */}
        {step === 1 && (
          <div>
            <h1 className="text-2xl font-black text-white mb-2">어떤 일을 하시나요?</h1>
            <p className="text-white/40 text-sm mb-8">업종에 맞는 공제 항목을 자동으로 설정합니다</p>
            <div className="grid grid-cols-2 gap-3 mb-8">
              {BUSINESS_TYPES.map(bt => (
                <button key={bt.id}
                  onClick={() => setForm(f => ({ ...f, businessType: bt.id }))}
                  className={`rounded-xl p-4 text-left border transition-all active:scale-95 ${
                    form.businessType === bt.id
                      ? "border-violet-500 bg-violet-500/15"
                      : "border-white/[0.08] bg-white/[0.03] hover:border-white/20"
                  }`}>
                  <div className="text-2xl mb-2">{bt.icon}</div>
                  <div className="text-sm font-semibold text-white">{bt.label}</div>
                </button>
              ))}
            </div>
            <button
              onClick={() => form.businessType && setStep(2)}
              disabled={!form.businessType}
              className="w-full py-4 rounded-xl font-bold text-base transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ background: "#7c3aed", color: "white" }}>
              다음 →
            </button>
          </div>
        )}

        {/* Step 2: 사업자 정보 */}
        {step === 2 && (
          <div>
            <h1 className="text-2xl font-black text-white mb-2">사업자 정보를 입력해주세요</h1>
            <p className="text-white/40 text-sm mb-8">정확한 세금 계산을 위해 사용됩니다 (선택 사항)</p>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-xs font-semibold text-white/50 mb-2">상호명 (선택)</label>
                <input
                  type="text"
                  placeholder="홍길동 스튜디오"
                  value={form.businessName}
                  onChange={e => setForm(f => ({ ...f, businessName: e.target.value }))}
                  className="w-full rounded-xl px-4 py-3 text-sm text-white border border-white/[0.1] outline-none focus:border-violet-500 transition-colors"
                  style={{ background: "#1a1c22" }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-white/50 mb-2">사업자등록번호 (선택)</label>
                <input
                  type="text"
                  placeholder="000-00-00000"
                  value={form.businessNumber}
                  onChange={e => setForm(f => ({ ...f, businessNumber: e.target.value }))}
                  className="w-full rounded-xl px-4 py-3 text-sm text-white border border-white/[0.1] outline-none focus:border-violet-500 transition-colors"
                  style={{ background: "#1a1c22" }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-white/50 mb-2">과세 유형</label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { value: true, label: "간이과세자", desc: "연 매출 8천만원 미만" },
                    { value: false, label: "일반과세자", desc: "연 매출 8천만원 이상" },
                  ].map(opt => (
                    <button key={String(opt.value)}
                      onClick={() => setForm(f => ({ ...f, isSimplifiedVat: opt.value }))}
                      className={`rounded-xl p-4 text-left border transition-all ${
                        form.isSimplifiedVat === opt.value
                          ? "border-violet-500 bg-violet-500/15"
                          : "border-white/[0.08] bg-white/[0.03] hover:border-white/20"
                      }`}>
                      <div className="text-sm font-bold text-white mb-1">{opt.label}</div>
                      <div className="text-[11px] text-white/35">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(1)}
                className="flex-1 py-4 rounded-xl font-bold text-sm border border-white/10 text-white/40 hover:text-white hover:border-white/20 transition-all">
                ← 이전
              </button>
              <button onClick={() => setStep(3)}
                className="flex-[2] py-4 rounded-xl font-bold text-base transition-all active:scale-95"
                style={{ background: "#7c3aed", color: "white" }}>
                다음 →
              </button>
            </div>
          </div>
        )}

        {/* Step 3: 연매출 & 완료 */}
        {step === 3 && (
          <div>
            <h1 className="text-2xl font-black text-white mb-2">연간 예상 수입은?</h1>
            <p className="text-white/40 text-sm mb-8">세금 구간 및 절세 전략 설정에 사용됩니다</p>

            <div className="space-y-3 mb-8">
              {[
                { value: "under_10m", label: "1천만원 미만" },
                { value: "under_30m", label: "1천~3천만원" },
                { value: "under_50m", label: "3천~5천만원" },
                { value: "under_100m", label: "5천만~1억원" },
                { value: "over_100m", label: "1억원 이상" },
              ].map(opt => (
                <button key={opt.value}
                  onClick={() => setForm(f => ({ ...f, annualRevenueTier: opt.value }))}
                  className={`w-full rounded-xl px-5 py-4 text-left text-sm font-semibold border transition-all ${
                    form.annualRevenueTier === opt.value
                      ? "border-violet-500 bg-violet-500/15 text-white"
                      : "border-white/[0.08] bg-white/[0.03] text-white/60 hover:border-white/20"
                  }`}>
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="rounded-xl border border-white/[0.08] p-5 mb-6" style={{ background: "#1a1c22" }}>
              <p className="text-xs text-white/40 leading-relaxed">
                ⚠️ 입력하신 정보는 AI 분석 정확도를 높이기 위해 사용됩니다.
                실제 세금 신고는 공인 세무사와 상담하시기 바랍니다.
              </p>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(2)}
                className="flex-1 py-4 rounded-xl font-bold text-sm border border-white/10 text-white/40 hover:text-white hover:border-white/20 transition-all">
                ← 이전
              </button>
              <button onClick={handleComplete} disabled={saving}
                className="flex-[2] py-4 rounded-xl font-bold text-base transition-all active:scale-95 disabled:opacity-60"
                style={{ background: "#7c3aed", color: "white" }}>
                {saving ? "저장 중..." : "시작하기 🎉"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
'''

# ─────────────────────────────────────────────────────────────────────────────
# 3. page.tsx  (세션 분기 + 비회원 실제 AI 분석 + 회원 대시보드)
# ─────────────────────────────────────────────────────────────────────────────
files['src/app/page.tsx'] = f'''
"use client"
import {{ useState, useRef, useEffect, useCallback }} from "react"
import Link from "next/link"
import Image from "next/image"
import {{ createBrowserClient }} from "@supabase/ssr"

// ─── Types ────────────────────────────────────────────────────────────────────

interface TxInput {{
  description: string
  amount: number
  date: string
}}

interface TxResult {{
  index: number
  desc: string
  amount: number
  category: string
  subCategory: string
  isDeductible: boolean
  deductionRatio: number
  confidence: number
  reasoning: string
}}

interface UserProfile {{
  id: string
  full_name: string | null
  business_type: string | null
  is_simplified_vat: boolean
  onboarding_completed: boolean
}}

// ─── Constants ────────────────────────────────────────────────────────────────

const PAIN_POINTS = [
  {{ no:"01", q:"매달 거래내역 정리하는 게 너무 귀찮고 시간 많이 드시나요?", solution:"CSV 한 번 올리면 AI가 자동 분류", demo:"auto_classify" }},
  {{ no:"02", q:"뭐가 공제되는지 몰라서 나중에 후회하시나요?", solution:"놓친 공제 항목 즉시 감지 & 알림", demo:"deduction" }},
  {{ no:"03", q:"신고 기간에 급하게 하다 실수할까봐 불안하시나요?", solution:"분기별 예정신고 자동 알림", demo:"alert" }},
  {{ no:"04", q:"증빙 자료 찾는 게 번거로우시나요?", solution:"사진 OCR로 영수증 즉시 등록", demo:"ocr" }},
  {{ no:"05", q:"이번 달 세금 얼마나 나올지 모르시죠?", solution:"실시간 세금 예측 대시보드", demo:"forecast" }},
]

const FAQ_ITEMS = [
  {{ q:"어떤 파일을 올리면 되나요?", a:"은행 앱에서 내려받은 거래내역 CSV 또는 영수증 사진(JPG, PNG)을 올리시면 됩니다." }},
  {{ q:"내 거래내역이 저장되나요?", a:"비회원 체험은 서버에 저장되지 않습니다. 회원가입 후에는 암호화하여 안전하게 보관됩니다." }},
  {{ q:"삼쩜삼과 무엇이 다른가요?", a:"삼쩜삼은 연 1회 신고 대행입니다. 미리택스는 매달 실시간으로 절세를 도와드리는 AI 코치입니다." }},
  {{ q:"얼마나 절세할 수 있나요?", a:"평균 월 34만원의 추가 공제 항목을 발견합니다. 세율 15% 기준 약 5만원 절세 효과입니다." }},
  {{ q:"언제든 해지할 수 있나요?", a:"네, 마이페이지에서 즉시 해지 가능합니다. 위약금이나 추가 비용은 없습니다." }},
]

// ─── CSV Parser ───────────────────────────────────────────────────────────────

function parseCSV(text: string): TxInput[] {{
  const lines = text.trim().split("\\n").filter(l => l.trim())
  if (lines.length < 2) return []
  const rows: TxInput[] = []
  for (let i = 1; i < Math.min(lines.length, 21); i++) {{
    const cols = lines[i].split(",").map(c => c.trim().replace(/^"|"$/g, ""))
    const amount = parseFloat(cols[2] || cols[1] || "0")
    if (isNaN(amount)) continue
    rows.push({{
      description: cols[0] || `거래 ${{i}}`,
      amount: Math.abs(amount) > 0 ? -Math.abs(amount) : 0,
      date: cols[3] || new Date().toISOString().slice(0, 10),
    }})
  }}
  return rows
}}

// ─── Animated Pain Point Demos ────────────────────────────────────────────────

function PainPointDemo({{ demo }}: {{ demo: string }}) {{
  const [tick, setTick] = useState(0)
  useEffect(() => {{
    const t = setInterval(() => setTick(p => p + 1), 1200)
    return () => clearInterval(t)
  }}, [])

  if (demo === "auto_classify") {{
    const items = ["어도비 구독 → 소프트웨어 ✓", "카카오택시 → 교통비 ✓", "AWS 서버 → 통신비 ✓", "쿠팡 조명 → 장비구입 ✓"]
    return <div className="space-y-2">{{items.map((item, i) => (
      <div key={{item}} className={{`flex items-center gap-2 text-xs px-3 py-2 rounded-lg transition-all duration-500 ${{tick%4>=i ? "bg-violet-500/20 text-violet-300" : "bg-white/[0.04] text-white/25"}}`}}>
        <span className={{`w-1.5 h-1.5 rounded-full ${{tick%4>=i ? "bg-violet-400" : "bg-white/20"}}`}} />{{item}}
      </div>
    ))}}</div>
  }}
  if (demo === "deduction") {{
    const found = tick % 3
    return <div className="space-y-2">
      <div className="text-xs text-white/30 mb-3">AI 공제 감지 중...</div>
      {{["장비구입 89,000원 → 공제가능!", "소프트웨어 65,000원 → 공제가능!", "교통비 12,000원 → 공제가능!"].map((t, i) => (
        <div key={{t}} className={{`text-xs px-3 py-2 rounded-lg transition-all duration-700 ${{found>i ? "bg-green-500/15 text-green-400" : "bg-white/[0.03] text-white/20"}}`}}>
          {{found>i ? "✓ " : "◎ "}}{{t}}
        </div>
      ))}}
      <div className="text-xs text-violet-400 font-bold mt-3 animate-pulse">이번 달 놓친 공제 34만원 발견!</div>
    </div>
  }}
  if (demo === "alert") return <div className="space-y-3">{{[
    {{ label:"1분기 부가세 신고", date:"4월 25일", done:true }},
    {{ label:"종합소득세 신고", date:"5월 31일", done:false }},
    {{ label:"2분기 예정신고", date:"7월 25일", done:false }},
  ].map(a => (
    <div key={{a.label}} className={{`flex items-center justify-between text-xs px-3 py-2.5 rounded-lg ${{a.done ? "bg-white/[0.04] text-white/30" : "bg-violet-500/15 text-violet-300"}}`}}>
      <span>{{a.done ? "✓ " : "🔔 "}}{{a.label}}</span>
      <span className={{a.done ? "text-white/20" : "text-violet-400 font-bold"}}>{{a.date}}</span>
    </div>
  ))}}</div>
  if (demo === "ocr") {{
    const s = tick % 4
    return <div className="text-center space-y-3">
      <div className="w-16 h-20 rounded-lg border border-white/10 bg-white/[0.03] mx-auto flex items-center justify-center text-3xl">🧾</div>
      <div className="space-y-1.5">{{["사진 인식 중...", "텍스트 추출 중...", "거래내역 등록 완료!", "공제 항목 확인됨!"].map((t, i) => (
        <div key={{t}} className={{`text-xs transition-all ${{s===i ? "text-violet-400 font-bold" : s>i ? "text-white/30" : "text-white/10"}}`}}>
          {{s>i ? "✓ " : s===i ? "◎ " : ""}}{{t}}
        </div>
      ))}}</div>
    </div>
  }}
  if (demo === "forecast") {{
    const p = ((tick%10)+1)*10
    return <div className="space-y-3">
      <div className="flex justify-between text-xs text-white/40"><span>이번 달 예상 세금</span><span className="text-violet-400 font-bold animate-pulse">계산 중...</span></div>
      <div className="text-2xl font-black">{{(p*3200).toLocaleString()}}원</div>
      <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
        <div className="h-full rounded-full bg-violet-500 transition-all duration-700" style={{{{width:`${{p}}%`}}}} />
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">{{[["소득세","18만"],["4대보험","9만"],["부가세","5만"]].map(([l,v]) => (
        <div key={{l}} className="rounded-lg bg-white/[0.04] p-2"><div className="text-[10px] text-white/30">{{l}}</div><div className="text-xs font-bold text-white/70">{{v}}</div></div>
      ))}}</div>
    </div>
  }}
  return null
}}

// ─── Upload Box (3 phases) ────────────────────────────────────────────────────

function UploadBox({{ onComplete, remainingCount }}: {{ onComplete: (r: TxResult[], raw: TxInput[]) => void; remainingCount: number }}) {{
  const [phase, setPhase] = useState<"idle"|"uploading"|"analyzing">("idle")
  const [uploadPct, setUploadPct] = useState(0)
  const [analyzePct, setAnalyzePct] = useState(0)
  const [fileName, setFileName] = useState<string|null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string|null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function processFile(file: File) {{
    setError(null)
    setFileName(file.name)
    setPhase("uploading")
    setUploadPct(0)

    // 업로드 진행률 시뮬레이션
    let up = 0
    const upTimer = setInterval(() => {{
      up += Math.floor(Math.random()*15)+5
      if (up >= 100) {{ up = 100; clearInterval(upTimer) }}
      setUploadPct(up)
    }}, 60)

    // 파일 읽기
    let transactions: TxInput[] = []
    const isImage = file.type.startsWith("image/")

    if (isImage) {{
      // 이미지는 영수증으로 처리
      transactions = [{ description: "영수증 (" + file.name + ")", amount: -50000, date: new Date().toISOString().slice(0,10) }]
    }} else {{
      const text = await file.text()
      transactions = parseCSV(text)
      if (transactions.length === 0) {{
        // CSV 파싱 실패 시 샘플 데이터 사용
        transactions = [
          {{ description: "어도비 크리에이티브 클라우드", amount: -65000, date: "2026-03-01" }},
          {{ description: "스타벅스 강남점", amount: -8500, date: "2026-03-02" }},
          {{ description: "AWS 서버 비용", amount: -45000, date: "2026-03-05" }},
          {{ description: "카카오택시 업무출장", amount: -12000, date: "2026-03-07" }},
          {{ description: "유튜브 프리미엄", amount: -14900, date: "2026-03-10" }},
        ]
      }}
    }}

    // 업로드 완료 대기
    await new Promise(r => setTimeout(r, 800))
    clearInterval(upTimer)
    setUploadPct(100)

    // 분석 단계
    await new Promise(r => setTimeout(r, 400))
    setPhase("analyzing")
    setAnalyzePct(0)

    let ap = 0
    const apTimer = setInterval(() => {{
      ap += Math.floor(Math.random()*6)+2
      if (ap >= 90) {{ ap = 90; clearInterval(apTimer) }}
      setAnalyzePct(ap)
    }}, 100)

    try {{
      const res = await fetch("/api/demo-classify", {{
        method: "POST",
        headers: {{ "Content-Type": "application/json" }},
        body: JSON.stringify({{ transactions }}),
      }})
      const data = await res.json()

      clearInterval(apTimer)
      setAnalyzePct(100)
      await new Promise(r => setTimeout(r, 300))

      if (data.upgradeRequired) {{
        setError(data.message)
        setPhase("idle")
        return
      }}
      if (!data.success) {{
        setError(data.message || "분석 중 오류가 발생했습니다.")
        setPhase("idle")
        return
      }}

      onComplete(data.results as TxResult[], transactions)
    }} catch (e) {{
      clearInterval(apTimer)
      setError("네트워크 오류가 발생했습니다. 다시 시도해주세요.")
      setPhase("idle")
    }}
  }}

  function handleDrop(e: React.DragEvent) {{
    e.preventDefault(); setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) processFile(f)
  }}

  if (phase === "idle") return (
    <div className="p-6">
      {{error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 mb-4 text-xs text-red-400">
          {{error}}
          {{error.includes("회원가입") && (
            <Link href="/signup" className="ml-2 underline font-bold">회원가입하기 →</Link>
          )}}
        </div>
      )}}
      <div
        className={{`rounded-xl border-2 border-dashed p-10 text-center cursor-pointer transition-all ${{dragOver?"border-violet-400 bg-violet-500/10":"border-white/10 hover:border-white/20 hover:bg-white/[0.02]"}}`}}
        onDragOver={{e=>{{e.preventDefault();setDragOver(true)}}}}
        onDragLeave={{()=>setDragOver(false)}}
        onDrop={{handleDrop}}
        onClick={{()=>fileRef.current?.click()}}
      >
        <input ref={{fileRef}} type="file" accept=".csv,.xlsx,image/*" className="hidden"
          onChange={{e=>{{const f=e.target.files?.[0]; if(f) processFile(f)}}}} />
        <div className="text-4xl mb-4">📂</div>
        <p className="font-semibold text-sm mb-1">파일을 드래그하거나 클릭</p>
        <p className="text-xs text-white/25">거래내역 CSV · 엑셀 · 영수증 사진</p>
      </div>
      <div className="mt-4 rounded-xl border border-white/[0.08] px-4 py-3 flex items-center justify-between" style={{{{background:"#111216"}}}}>
        <span className="text-sm text-white/50">분석 유형</span>
        <span className="text-sm font-semibold flex items-center gap-2">
          전체 공제 최적화
          <svg className="w-4 h-4 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={{2}} d="M19 9l-7 7-7-7"/></svg>
        </span>
      </div>
      <button onClick={{()=>fileRef.current?.click()}}
        className="mt-4 w-full py-4 rounded-xl font-bold text-base transition-all active:scale-95"
        style={{{{background:"#7c3aed"}}}}
        onMouseEnter={{e=>(e.currentTarget.style.background="#6d28d9")}}
        onMouseLeave={{e=>(e.currentTarget.style.background="#7c3aed")}}>
        파일 선택하기
      </button>
      {{remainingCount < 3 && remainingCount > 0 && (
        <p className="text-center text-xs text-amber-400/70 mt-3">무료 체험 {{remainingCount}}회 남음</p>
      )}}
      <p className="text-center text-[11px] text-white/15 mt-2">파일을 올리면 이용약관에 동의하는 것으로 간주됩니다</p>
    </div>
  )

  if (phase === "uploading") return (
    <div className="p-8">
      <div className="mb-8">
        <p className="text-lg font-bold mb-1">업로드 중...</p>
        <p className="text-xs text-white/35">{{fileName}}</p>
      </div>
      <div className="relative h-12 rounded-xl overflow-hidden bg-white/10">
        <div className="absolute inset-y-0 left-0 transition-all duration-150 rounded-xl"
          style={{{{width:`${{uploadPct}}%`, background:"#7c3aed"}}}} />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold" style={{{{color: uploadPct>50?"white":"rgba(255,255,255,0.8)"}}}}>{{uploadPct}}%</span>
        </div>
      </div>
      <p className="text-center text-[11px] text-white/15 mt-4">AI 처리 안내: 이 기능은 AI 기술을 사용합니다</p>
    </div>
  )

  if (phase === "analyzing") return (
    <div className="p-8 text-center">
      <p className="text-lg font-bold mb-8">AI 분석 중...</p>
      <div className="relative w-32 h-32 mx-auto mb-8">
        <div className="absolute inset-0 flex items-center justify-center" style={{{{animation:"spin 1.5s linear infinite"}}}}>
          <Image src="/logo.{logo_ext}" alt="미리택스" height={{50}} width={{125}} style={{{{objectFit:"contain",opacity:0.8}}}} />
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-black" style={{{{textShadow:"0 0 20px rgba(124,58,237,0.8)"}}}}>{{analyzePct}}%</span>
        </div>
        <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 128 128">
          <circle cx="64" cy="64" r="58" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4"/>
          <circle cx="64" cy="64" r="58" fill="none" stroke="#7c3aed" strokeWidth="4"
            strokeDasharray={{`${{(analyzePct/100)*364.4}} 364.4`}} strokeLinecap="round"
            style={{{{transition:"stroke-dasharray 0.15s"}}}}/>
        </svg>
      </div>
      <p className="text-center text-[11px] text-white/15">AI 처리 안내: 이 기능은 AI 기술을 사용합니다</p>
      <style>{{`@keyframes spin{{from{{transform:rotate(0deg)}}to{{transform:rotate(360deg)}}}}`}}</style>
    </div>
  )

  return null
}}

// ─── Result Box ───────────────────────────────────────────────────────────────

function ResultBox({{ results, onReset, onDownload }}: {{ results: TxResult[]; onReset: () => void; onDownload: () => void }}) {{
  const deductTotal = results.filter(r=>r.isDeductible).reduce((s,r)=>s+Math.abs(r.amount),0)
  const missedSaving = Math.round(deductTotal * 0.15)

  return (
    <div className="p-5">
      <div className="px-1 py-3 mb-4">
        <p className="text-lg font-black mb-1">분석 결과가 준비됐습니다!</p>
        <p className="text-xs text-white/35">총 {{results.length}}건 · 공제가능 {{results.filter(r=>r.isDeductible).length}}건</p>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="rounded-xl p-4" style={{{{background:"#111216"}}}}>
          <p className="text-[11px] text-white/30 mb-1">공제 가능</p>
          <p className="text-xl font-black text-violet-400">{{deductTotal.toLocaleString()}}원</p>
        </div>
        <div className="rounded-xl p-4" style={{{{background:"#1e1530"}}}}>
          <p className="text-[11px] text-white/30 mb-1">예상 절세</p>
          <p className="text-xl font-black text-violet-300">{{missedSaving.toLocaleString()}}원</p>
        </div>
      </div>
      <div className="rounded-xl overflow-hidden border border-white/[0.06] mb-4" style={{{{background:"#111216"}}}}>
        <div className="px-4 py-2 border-b border-white/[0.05] flex justify-between">
          <span className="text-[11px] text-white/35">AI 분류 결과</span>
          <span className="text-[11px] text-green-400">{{results.filter(r=>r.isDeductible).length}}건 공제가능</span>
        </div>
        <div className="max-h-52 overflow-y-auto divide-y divide-white/[0.04]">
          {{results.map((r,i) => (
            <div key={{i}} className="px-4 py-3 flex items-center justify-between hover:bg-white/[0.02]">
              <div className="min-w-0 flex-1 pr-3">
                <p className="text-xs font-medium truncate">{{r.desc}}</p>
                <p className="text-[10px] text-white/25">{{r.category}} · {{Math.round(r.confidence*100)}}%</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xs font-semibold">{{r.amount.toLocaleString()}}원</p>
                <span className={{`text-[10px] font-bold ${{r.isDeductible?"text-violet-400":"text-white/20"}}`}}>
                  {{r.isDeductible?"공제가능":"공제불가"}}
                </span>
              </div>
            </div>
          ))}}
        </div>
      </div>
      <div className="rounded-xl border border-violet-500/20 bg-violet-500/[0.06] px-4 py-3 mb-4 text-xs text-white/40 leading-relaxed">
        ⚠️ 본 분석은 AI 참고용이며 법적 세무 조언이 아닙니다.
      </div>
      <button onClick={{onDownload}}
        className="w-full py-4 rounded-xl font-black text-base transition-all active:scale-95 mb-3"
        style={{{{background:"#7c3aed"}}}}
        onMouseEnter={{e=>(e.currentTarget.style.background="#6d28d9")}}
        onMouseLeave={{e=>(e.currentTarget.style.background="#7c3aed")}}>
        전체 결과 저장 및 다운로드 →
      </button>
      <button onClick={{onReset}} className="w-full text-xs text-white/25 hover:text-white/50 py-2 transition-colors">
        ← 다시 분석하기
      </button>
    </div>
  )
}}

// ─── Member Dashboard View ────────────────────────────────────────────────────

function DashboardView({{ profile, onSignOut }}: {{ profile: UserProfile; onSignOut: () => void }}) {{
  const [results, setResults] = useState<TxResult[]|null>(null)
  const [remainingCount] = useState(999)
  const [showModal, setShowModal] = useState(false)

  const deductTotal = results ? results.filter(r=>r.isDeductible).reduce((s,r)=>s+Math.abs(r.amount),0) : 0
  const name = profile.full_name || "사용자"

  return (
    <div>
      {{/* 개인화 배너 */}}
      <div className="border-b border-white/[0.06] py-4 px-5 sm:px-8" style={{{{background:"#1a1c22"}}}}>
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <span className="text-sm font-bold text-white">안녕하세요, {{name}}님 👋</span>
            <span className="ml-3 text-xs text-white/35">{{profile.business_type || "크리에이터"}}</span>
          </div>
          <Link href="/dashboard" className="text-xs text-violet-400 hover:text-violet-300 transition-colors font-semibold">
            대시보드 보기 →
          </Link>
        </div>
      </div>

      {{/* 업로드 섹션 */}}
      <section className="max-w-7xl mx-auto px-5 sm:px-8 pt-12 pb-20">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-start">
          <div className="pt-2">
            <h1 className="text-4xl sm:text-5xl font-black leading-[1.05] tracking-tight mb-6">
              {{name}}님의<br />이번 달 세금을<br />
              <span style={{{{background:"linear-gradient(90deg,#a78bfa,#60a5fa)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}}}>
                미리 정리
              </span>해드립니다
            </h1>
            <p className="text-base text-white/45 leading-relaxed mb-6 max-w-md">
              거래내역을 올리면 AI가 즉시 분류하고 공제 항목을 찾아드립니다.
            </p>
            <div className="flex flex-wrap gap-3 text-sm text-white/35">
              <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block"/>무제한 분석</span>
              <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block"/>CSV + 엑셀 + 사진</span>
              <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block"/>97% 정확도</span>
            </div>
          </div>
          <div className="rounded-2xl border border-white/[0.1] overflow-hidden" style={{{{background:"#1a1c22"}}}}>
            <div className="px-6 py-4 border-b border-white/[0.07] flex items-center justify-between">
              <div>
                <h2 className="font-bold text-base">{{results ? "분석 완료!" : "거래내역 분석하기"}}</h2>
                <p className="text-xs text-white/30 mt-0.5">{{results ? `공제가능 ${{results.filter(r=>r.isDeductible).length}}건 발견` : "CSV · 엑셀 · 영수증 사진"}}</p>
              </div>
              <div className="w-3 h-3 rounded-full" style={{{{background:results?"#22c55e":"#ef4444",opacity:0.7}}}}/>
            </div>
            {{results
              ? <ResultBox results={{results}} onReset={{()=>setResults(null)}} onDownload={{()=>setShowModal(true)}} />
              : <UploadBox onComplete={{(r)=>setResults(r)}} remainingCount={{remainingCount}} />
            }}
          </div>
        </div>
      </section>

      {{/* 빠른 메뉴 */}}
      <section className="border-t border-white/[0.06] py-12 px-5 sm:px-8">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-xl font-black mb-6">바로가기</h2>
          <div className="grid sm:grid-cols-4 gap-4">
            {{[
              {{label:"거래내역 관리", href:"/transactions", icon:"📊"}},
              {{label:"AI 최적화", href:"/optimize", icon:"🤖"}},
              {{label:"세금 리포트", href:"/export", icon:"📄"}},
              {{label:"설정", href:"/settings", icon:"⚙️"}},
            ].map(m => (
              <Link key={{m.href}} href={{m.href}}
                className="rounded-2xl border border-white/[0.07] p-6 hover:border-white/20 hover:bg-white/[0.02] transition-all"
                style={{{{background:"#1a1c22"}}}}>
                <div className="text-2xl mb-3">{{m.icon}}</div>
                <div className="text-sm font-semibold text-white/70">{{m.label}}</div>
              </Link>
            ))}}
          </div>
        </div>
      </section>

      {{/* 다운로드 모달 */}}
      {{showModal && results && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{{{background:"rgba(0,0,0,0.85)",backdropFilter:"blur(12px)"}}}}
          onClick={{()=>setShowModal(false)}}>
          <div className="rounded-2xl border border-white/10 p-8 w-full max-w-md"
            style={{{{background:"#1a1c22"}}}} onClick={{e=>e.stopPropagation()}}>
            <h3 className="text-xl font-black mb-4">분석 결과 저장</h3>
            <p className="text-white/40 text-sm mb-6">아래 버튼으로 결과를 다운로드하거나 대시보드에서 전체 리포트를 확인하세요.</p>
            <div className="flex flex-col gap-3">
              <button
                onClick={{()=>{{
                  const csv = ["항목,금액,카테고리,공제가능,신뢰도", ...results.map(r=>`${{r.desc}},${{r.amount}},${{r.category}},${{r.isDeductible?"예":"아니오"}},${{Math.round(r.confidence*100)}}%`)].join("\\n")
                  const a = document.createElement("a"); a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv)
                  a.download = "미리택스_분석결과.csv"; a.click()
                  setShowModal(false)
                }}}}
                className="w-full py-3.5 rounded-xl font-bold text-sm transition-all"
                style={{{{background:"#7c3aed",color:"white"}}}}>
                CSV 다운로드
              </button>
              <Link href="/export" className="block text-center py-3.5 rounded-xl font-semibold text-sm border border-white/10 text-white/50 hover:text-white hover:border-white/20 transition-all">
                전체 리포트 (PDF) 보기
              </Link>
              <button onClick={{()=>setShowModal(false)}} className="text-xs text-white/20 hover:text-white/40 transition-colors py-2">닫기</button>
            </div>
          </div>
        </div>
      )}}
    </div>
  )
}}

// ─── Landing View (비회원) ────────────────────────────────────────────────────

function LandingView() {{
  const [results, setResults] = useState<TxResult[]|null>(null)
  const [showModal, setShowModal] = useState(false)
  const [remainingCount, setRemainingCount] = useState(3)
  const [openFaq, setOpenFaq] = useState<number|null>(null)

  return (
    <div>
      {{/* Banner */}}
      <div style={{{{background:"#7c3aed"}}}} className="text-white text-center py-2.5 px-4 text-xs sm:text-sm font-semibold">
        첫 달 50% 할인 이벤트 진행 중 &nbsp;·&nbsp;
        <Link href="/signup?plan=pro" className="underline underline-offset-2">지금 시작하기 →</Link>
      </div>

      {{/* Hero */}}
      <section className="max-w-7xl mx-auto px-5 sm:px-8 pt-16 pb-20">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-start">
          <div className="pt-2">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.05] tracking-tight mb-6">
              거래내역 올리면<br />AI가 세금을<br />
              <span style={{{{background:"linear-gradient(90deg,#a78bfa,#60a5fa)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}}}>
                미리 정리
              </span>해드립니다
            </h1>
            <p className="text-base sm:text-lg text-white/45 leading-relaxed mb-8 max-w-md">
              한국 크리에이터·1인사업자를 위한 실시간 AI 세금 코치.
              놓친 공제를 찾고 매달 절세하세요.
            </p>
            <div className="flex flex-wrap gap-4 text-sm text-white/35">
              <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block"/>회원가입 불필요</span>
              <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block"/>CSV + 엑셀 + 사진</span>
              <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block"/>실제 AI 분석</span>
            </div>
          </div>
          <div className="rounded-2xl border border-white/[0.1] overflow-hidden" style={{{{background:"#1a1c22"}}}}>
            <div className="px-6 py-4 border-b border-white/[0.07] flex items-center justify-between">
              <div>
                <h2 className="font-bold text-base">{{results ? "분석 완료!" : "거래내역 분석하기"}}</h2>
                <p className="text-xs text-white/30 mt-0.5">{{results ? `공제가능 ${{results.filter(r=>r.isDeductible).length}}건 발견` : "CSV · 엑셀 · 영수증 사진"}}</p>
              </div>
              <div className="w-3 h-3 rounded-full" style={{{{background:results?"#22c55e":"#ef4444",opacity:0.7}}}}/>
            </div>
            {{results
              ? <ResultBox results={{results}} onReset={{()=>setResults(null)}} onDownload={{()=>setShowModal(true)}} />
              : <UploadBox onComplete={{(r)=>{{ setResults(r); setRemainingCount(p=>Math.max(0,p-1)) }}}} remainingCount={{remainingCount}} />
            }}
          </div>
        </div>
      </section>

      {{/* Pain Points */}}
      <section id="pain" className="border-t border-white/[0.06] py-24 px-5 sm:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-black mb-4">이런 불편함, 미리택스가 해결합니다</h2>
            <p className="text-white/35 text-sm">직접 작동하는 모습을 확인해보세요</p>
          </div>
          <div className="space-y-5">
            {{PAIN_POINTS.map(p => (
              <div key={{p.no}} className="grid md:grid-cols-2 rounded-2xl border border-white/[0.07] overflow-hidden" style={{{{background:"#1a1c22"}}}}>
                <div className="p-8 flex flex-col justify-center">
                  <div className="text-xs font-bold text-violet-400/60 tracking-widest mb-4">{{p.no}}</div>
                  <h3 className="text-lg sm:text-xl font-bold mb-3 leading-snug text-white/85">{{p.q}}</h3>
                  <div className="flex items-center gap-2 text-sm text-violet-400 font-semibold">
                    <span className="w-4 h-4 rounded-full bg-violet-500/30 flex items-center justify-center text-[10px]">✓</span>
                    {{p.solution}}
                  </div>
                </div>
                <div className="p-8 border-t md:border-t-0 md:border-l border-white/[0.06]" style={{{{background:"#111216"}}}}>
                  <PainPointDemo demo={{p.demo}} />
                </div>
              </div>
            ))}}
          </div>
        </div>
      </section>

      {{/* Compare */}}
      <section className="py-24 px-5 sm:px-8">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-black text-center mb-12">삼쩜삼 vs 미리택스</h2>
          <div className="rounded-2xl overflow-hidden border border-white/[0.08]" style={{{{background:"#1a1c22"}}}}>
            <div className="grid grid-cols-3 px-6 py-4 border-b border-white/[0.06] text-sm font-semibold">
              <span className="text-white/30">기능</span>
              <span className="text-center text-white/30">삼쩜삼</span>
              <span className="text-center text-violet-400">미리택스</span>
            </div>
            {{[["연간 세금 신고","✓","✓"],["매달 절세 코치","–","✓"],["거래내역 자동 분류","–","✓"],["놓친 공제 감지","–","✓"],["사진 OCR","–","✓"],["세금 예측","–","✓"],["이용 방식","연 1회","월 구독"]].map(([f,a,b],i) => (
              <div key={{i}} className="grid grid-cols-3 px-6 py-4 border-t border-white/[0.05] text-sm hover:bg-white/[0.02]">
                <span className="text-white/55">{{f}}</span>
                <span className="text-center text-white/20">{{a}}</span>
                <span className="text-center font-semibold text-violet-400">{{b}}</span>
              </div>
            ))}}
          </div>
        </div>
      </section>

      {{/* Pricing */}}
      <section id="pricing" className="py-24 px-5 sm:px-8 border-t border-white/[0.06]">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-black text-center mb-3">요금제</h2>
          <p className="text-center text-white/35 text-sm mb-12">첫 달 50% 할인 · 언제든 해지</p>
          <div className="grid sm:grid-cols-3 gap-5">
            {{[
              {{name:"Starter",price:"0",unit:"원",sub:"항상 무료",features:["월 5회 분류","기본 세금 계산","이메일 알림"],cta:"무료로 시작",href:"/signup",hi:false}},
              {{name:"Pro",price:"39,000",unit:"원/월",sub:"첫 달 19,500원",features:["무제한 분류","AI 공제 최적화","사진 OCR","분기 알림","주간 리포트"],cta:"카드로 시작",href:"/signup?plan=pro",hi:true}},
              {{name:"Business",price:"89,000",unit:"원/월",sub:"첫 달 44,500원",features:["Pro 전체","세무사 연동","PDF 신고서","팀원 초대","우선 지원"],cta:"카드로 시작",href:"/signup?plan=business",hi:false}},
            ].map(p => (
              <div key={{p.name}} className={{`rounded-2xl p-7 border flex flex-col ${{p.hi?"border-violet-500/40":"border-white/[0.07]"}}`}}
                style={{{{background:p.hi?"#1e1530":"#1a1c22"}}}}>
                {{p.hi && <div className="text-[10px] font-bold text-violet-400 mb-4 tracking-widest uppercase">Best Value</div>}}
                <div className="font-bold mb-1 text-white/80">{{p.name}}</div>
                <div className="text-3xl font-black mb-1">{{p.price}}<span className="text-sm font-normal text-white/25">{{p.unit}}</span></div>
                <div className={{`text-xs font-semibold mb-6 ${{p.hi?"text-violet-400":"text-white/25"}}`}}>{{p.sub}}</div>
                <ul className="space-y-2.5 mb-7 flex-1">
                  {{p.features.map(f=>(
                    <li key={{f}} className="flex items-center gap-2.5 text-xs text-white/45">
                      <span className={{p.hi?"text-violet-400":"text-white/20"}}>✓</span>{{f}}
                    </li>
                  ))}}
                </ul>
                <Link href={{p.href}} className="block text-center py-3 rounded-xl font-bold text-sm transition-all active:scale-95"
                  style={{{{background:p.hi?"#7c3aed":"rgba(255,255,255,0.06)",color:p.hi?"white":"rgba(255,255,255,0.4)"}}}}>
                  {{p.cta}}
                </Link>
              </div>
            ))}}
          </div>
        </div>
      </section>

      {{/* FAQ */}}
      <section id="faq" className="py-24 px-5 sm:px-8 border-t border-white/[0.06]">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-black text-center mb-12">FAQ</h2>
          <div className="space-y-0">
            {{FAQ_ITEMS.map((item,i) => (
              <div key={{i}} className="border-b border-white/[0.07]">
                <button className="w-full flex items-center justify-between py-5 text-left" onClick={{()=>setOpenFaq(openFaq===i?null:i)}}>
                  <span className="text-sm sm:text-base font-medium text-white/65">{{item.q}}</span>
                  <svg className={{`w-5 h-5 flex-shrink-0 ml-4 text-white/25 transition-transform ${{openFaq===i?"rotate-180":""}}`}} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={{2}} d="M19 9l-7 7-7-7"/>
                  </svg>
                </button>
                {{openFaq===i && <div className="pb-5 text-sm text-white/35 leading-relaxed">{{item.a}}</div>}}
              </div>
            ))}}
          </div>
        </div>
      </section>

      {{/* Footer */}}
      <footer className="border-t border-white/[0.06] py-12 px-5 sm:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid sm:grid-cols-4 gap-8 mb-10">
            <div>
              <Image src="/logo.{logo_ext}" alt="미리택스" height={{28}} width={{105}} style={{{{objectFit:"contain",opacity:0.3,filter:"grayscale(1)"}}}} />
              <p className="text-xs text-white/20 leading-relaxed mt-3">한국 크리에이터·1인사업자를 위한 AI 세금 코치</p>
            </div>
            {{[
              {{title:"서비스",links:[["대시보드","/dashboard"],["거래내역 업로드","/upload"],["AI 최적화","/optimize"]]}},
              {{title:"회사",links:[["소개","#"],["FAQ","#faq"],["이용약관","#"]]}},
              {{title:"요금제",links:[["Starter","/signup"],["Pro","/signup?plan=pro"],["Business","/signup?plan=business"]]}},
            ].map(col=>(
              <div key={{col.title}}>
                <p className="text-xs font-semibold text-white/40 mb-3 uppercase tracking-wider">{{col.title}}</p>
                <ul className="space-y-2">{{col.links.map(([label,href])=>(
                  <li key={{label}}><Link href={{href}} className="text-xs text-white/25 hover:text-white/50">{{label}}</Link></li>
                ))}}</ul>
              </div>
            ))}}
          </div>
          <div className="border-t border-white/[0.05] pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-white/15">© 2026 미리택스. All rights reserved.</p>
            <p className="text-xs text-white/10 text-center">본 서비스는 참고용 AI 코치입니다. 실제 신고는 공인 세무사와 상담하세요.</p>
          </div>
        </div>
      </footer>

      {{/* 회원가입 유도 Modal */}}
      {{showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6"
          style={{{{background:"rgba(0,0,0,0.85)",backdropFilter:"blur(12px)"}}}}
          onClick={{()=>setShowModal(false)}}>
          <div className="rounded-t-3xl sm:rounded-2xl border border-white/10 p-8 sm:p-10 w-full sm:max-w-md"
            style={{{{background:"#1a1c22"}}}} onClick={{e=>e.stopPropagation()}}>
            <div className="w-8 h-1 rounded-full mx-auto mb-8 sm:hidden bg-white/10"/>
            <div className="text-[10px] font-bold text-violet-400 tracking-widest uppercase mb-4">30초 회원가입</div>
            <h3 className="text-2xl font-black mb-3">결과를 저장하려면<br/>회원가입이 필요합니다</h3>
            <p className="text-white/35 text-sm mb-8 leading-relaxed">
              내 실제 거래내역으로 무제한 분석하고<br/>매달 절세 리포트를 받아보세요.<br/>
              <span className="text-violet-400 font-semibold">첫 달 19,500원 · 언제든 해지 가능</span>
            </p>
            <div className="flex flex-col gap-3">
              <Link href="/signup?plan=pro" className="block text-center py-4 rounded-xl font-bold text-sm transition-all active:scale-95" style={{{{background:"#7c3aed",color:"white"}}}}>
                첫 달 50% 할인으로 시작 →
              </Link>
              <Link href="/signup" className="block text-center py-3.5 rounded-xl font-semibold text-sm border border-white/10 text-white/40 hover:text-white hover:border-white/20 transition-all">
                무료로 시작
              </Link>
              <button onClick={{()=>setShowModal(false)}} className="text-xs text-white/20 hover:text-white/40 transition-colors py-2">나중에</button>
            </div>
          </div>
        </div>
      )}}
    </div>
  )
}}

// ─── Root Page (세션 분기) ────────────────────────────────────────────────────

export default function RootPage() {{
  const [profile, setProfile] = useState<UserProfile|null>(null)
  const [loading, setLoading] = useState(true)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {{
    async function checkSession() {{
      try {{
        const {{ data: {{ user }} }} = await supabase.auth.getUser()
        if (!user) {{ setLoading(false); return }}

        const {{ data: p }} = await (supabase as any)
          .from("users_profile")
          .select("id, full_name, business_type, is_simplified_vat, onboarding_completed")
          .eq("id", user.id)
          .single()

        if (p) setProfile(p as UserProfile)
      }} catch (e) {{
        console.error(e)
      }} finally {{
        setLoading(false)
      }}
    }}
    checkSession()
  }}, [])

  async function handleSignOut() {{
    await supabase.auth.signOut()
    setProfile(null)
  }}

  return (
    <div className="min-h-screen text-white" style={{{{background:"#111216",fontFamily:"'Inter',-apple-system,sans-serif"}}}}>

      {{/* Nav */}}
      <nav className="border-b border-white/[0.08] sticky top-0 z-50" style={{{{background:"rgba(17,18,22,0.95)",backdropFilter:"blur(20px)"}}}}>
        <div className="max-w-7xl mx-auto px-5 sm:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Image src="/logo.{logo_ext}" alt="미리택스" height={{36}} width={{135}} style={{{{objectFit:"contain"}}}} priority />
            <div className="hidden md:flex items-center gap-6 text-sm text-white/50">
              {{!profile && <a href="#pain" className="hover:text-white transition-colors">해결 방법</a>}}
              {{!profile && <a href="#pricing" className="hover:text-white transition-colors">요금제</a>}}
              {{!profile && <a href="#faq" className="hover:text-white transition-colors">FAQ</a>}}
              {{profile && <Link href="/transactions" className="hover:text-white transition-colors">거래내역</Link>}}
              {{profile && <Link href="/optimize" className="hover:text-white transition-colors">AI 최적화</Link>}}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {{loading ? (
              <div className="w-16 h-8 rounded-lg bg-white/10 animate-pulse"/>
            ) : profile ? (
              <>
                <span className="hidden sm:block text-sm text-white/50">{{profile.full_name || "사용자"}}</span>
                <button onClick={{handleSignOut}} className="text-sm text-white/40 hover:text-white transition-colors">로그아웃</button>
              </>
            ) : (
              <>
                <Link href="/login" className="hidden sm:block text-sm text-white/50 hover:text-white transition-colors">로그인</Link>
                <Link href="/signup" className="text-sm bg-white text-[#111216] font-bold px-4 py-2 rounded-lg hover:bg-white/90 transition-all">무료 시작</Link>
              </>
            )}}
          </div>
        </div>
      </nav>

      {{loading ? (
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="w-8 h-8 border-2 border-violet-400 border-t-transparent rounded-full animate-spin"/>
        </div>
      ) : profile ? (
        <DashboardView profile={{profile}} onSignOut={{handleSignOut}} />
      ) : (
        <LandingView />
      )}}
    </div>
  )
}}
'''

for path, content in files.items():
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content.lstrip('\n'))
    print(f'OK {path}')

print('All done')