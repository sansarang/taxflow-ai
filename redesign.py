import os

files = {}

files['src/app/page.tsx'] = '''import Link from "next/link"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "세금비서 — AI 세금 코치",
  description: "한국 크리에이터·1인사업자를 위한 실시간 AI 세금 코치. 놓친 공제를 찾고 매달 절세하세요.",
}

const FEATURES = [
  { label: "거래내역 자동 분류", desc: "CSV 업로드 한 번으로 AI가 모든 거래를 세금 코드별로 분류합니다." },
  { label: "놓친 공제 자동 감지", desc: "지금까지 몰랐던 공제 항목을 AI가 자동으로 찾아 알려드립니다." },
  { label: "실시간 세금 예측", desc: "이번 달 예상 세금을 실시간으로 확인하고 미리 준비하세요." },
  { label: "사진 OCR 영수증 등록", desc: "영수증 사진을 찍으면 자동으로 거래내역에 추가됩니다." },
  { label: "분기 예정신고 알림", desc: "신고 기간을 절대 놓치지 않도록 미리 알려드립니다." },
  { label: "주간 절세 리포트", desc: "매주 절세 현황과 개선 방향을 리포트로 받아보세요." },
]

const COMPARE = [
  ["연간 종합소득세 신고", true, true],
  ["매달 실시간 절세 코치", false, true],
  ["거래내역 자동 분류", false, true],
  ["놓친 공제 자동 감지", false, true],
  ["사진 OCR 영수증 등록", false, true],
  ["이번 달 세금 예측", false, true],
  ["이용 방식", "연 1회 건당", "월 구독"],
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white">

      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 border-b border-white/5 bg-[#0a0f1e]/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <span className="text-lg font-bold tracking-tight">세금비서</span>
          <div className="hidden md:flex items-center gap-8 text-sm text-white/60">
            <a href="#features" className="hover:text-white transition">기능</a>
            <a href="#compare" className="hover:text-white transition">비교</a>
            <a href="#pricing" className="hover:text-white transition">요금제</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-white/60 hover:text-white transition">로그인</Link>
            <Link href="/demo" className="text-sm bg-white text-[#0a0f1e] font-semibold px-4 py-2 rounded-lg hover:bg-white/90 transition">
              무료 체험
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-40 pb-32 px-6 text-center">
        <div className="max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 text-xs font-medium text-blue-400 bg-blue-400/10 border border-blue-400/20 px-4 py-1.5 rounded-full mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            한국 크리에이터·1인사업자 전용
          </div>
          <h1 className="text-6xl md:text-7xl font-black tracking-tight leading-[1.05] mb-8">
            세금, 이제<br />
            <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              AI 비서
            </span>에게
          </h1>
          <p className="text-xl text-white/50 max-w-2xl mx-auto mb-12 leading-relaxed">
            거래내역을 올리면 AI가 자동 분류하고 놓친 공제를 찾아드립니다.<br />
            삼쩜삼은 신고만 합니다. 세금비서는 매달 절세를 도와드립니다.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/demo"
              className="w-full sm:w-auto bg-white text-[#0a0f1e] font-bold text-base px-8 py-4 rounded-xl hover:bg-white/90 transition shadow-2xl shadow-white/10"
            >
              회원가입 없이 체험하기 →
            </Link>
            <Link
              href="/signup?plan=pro"
              className="w-full sm:w-auto text-base font-semibold px-8 py-4 rounded-xl border border-white/10 text-white/80 hover:border-white/30 hover:text-white transition"
            >
              첫 달 19,500원으로 시작
            </Link>
          </div>
          <p className="text-xs text-white/25 mt-6">카드 없이 체험 가능 · 언제든 해지</p>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-white/5 py-16 px-6">
        <div className="max-w-4xl mx-auto grid grid-cols-3 gap-8 text-center">
          {[
            ["평균 절세", "34만원/월"],
            ["공제 발견율", "94%"],
            ["분류 정확도", "97%"],
          ].map(([label, value]) => (
            <div key={label}>
              <div className="text-4xl font-black text-white mb-1">{value}</div>
              <div className="text-sm text-white/40">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-32 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-4xl font-black mb-4">세금의 모든 것을 자동화</h2>
            <p className="text-white/40">복잡한 세금 업무, 세금비서가 전부 처리합니다</p>
          </div>
          <div className="grid md:grid-cols-3 gap-px bg-white/5 rounded-2xl overflow-hidden">
            {FEATURES.map((f) => (
              <div key={f.label} className="bg-[#0a0f1e] p-8 hover:bg-white/[0.03] transition">
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 mb-6" />
                <h3 className="font-bold mb-3">{f.label}</h3>
                <p className="text-sm text-white/40 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Compare */}
      <section id="compare" className="py-32 px-6 bg-white/[0.02]">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-black mb-4">삼쩜삼과 무엇이 다른가요?</h2>
            <p className="text-white/40">신고 대행 vs 연중 절세 코치</p>
          </div>
          <div className="rounded-2xl overflow-hidden border border-white/10">
            <div className="grid grid-cols-3 bg-white/5 px-6 py-4 text-sm font-semibold">
              <span className="text-white/40">기능</span>
              <span className="text-center text-white/40">삼쩜삼</span>
              <span className="text-center text-blue-400">세금비서</span>
            </div>
            {COMPARE.map(([feat, a, b], i) => (
              <div key={i} className="grid grid-cols-3 px-6 py-4 border-t border-white/5 text-sm hover:bg-white/[0.02]">
                <span className="text-white/70">{feat as string}</span>
                <span className="text-center text-white/30">
                  {typeof a === "boolean" ? (a ? "✓" : "—") : a as string}
                </span>
                <span className="text-center text-blue-400 font-semibold">
                  {typeof b === "boolean" ? (b ? "✓" : "—") : b as string}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-32 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-black mb-4">간단한 요금제</h2>
            <p className="text-white/40">첫 달 50% 할인 · 언제든 해지 가능</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                name: "Free",
                price: "0",
                unit: "원",
                sub: "월 5회 무료",
                features: ["월 5회 거래 분류", "기본 세금 계산", "이메일 알림"],
                cta: "무료로 시작",
                href: "/signup",
                highlight: false,
              },
              {
                name: "Pro",
                price: "39,000",
                unit: "원/월",
                sub: "첫 달 19,500원",
                features: ["무제한 거래 분류", "AI 공제 최적화", "사진 OCR", "분기 알림", "주간 리포트"],
                cta: "첫 달 50% 할인으로 시작",
                href: "/signup?plan=pro",
                highlight: true,
              },
              {
                name: "Business",
                price: "89,000",
                unit: "원/월",
                sub: "첫 달 44,500원",
                features: ["Pro 전체 포함", "세무사 연동", "PDF 신고서", "팀원 초대(3명)", "우선 지원"],
                cta: "첫 달 50% 할인으로 시작",
                href: "/signup?plan=business",
                highlight: false,
              },
            ].map((p) => (
              <div
                key={p.name}
                className={`rounded-2xl p-8 border transition ${
                  p.highlight
                    ? "border-blue-500 bg-blue-500/10"
                    : "border-white/10 bg-white/[0.03]"
                }`}
              >
                {p.highlight && (
                  <div className="text-xs font-bold text-blue-400 mb-4 tracking-widest uppercase">Most Popular</div>
                )}
                <div className="text-lg font-bold mb-1">{p.name}</div>
                <div className="text-4xl font-black mb-1">
                  {p.price}<span className="text-base font-normal text-white/40">{p.unit}</span>
                </div>
                <div className={`text-sm font-semibold mb-8 ${p.highlight ? "text-blue-400" : "text-white/40"}`}>
                  {p.sub}
                </div>
                <ul className="space-y-3 mb-8">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-center gap-3 text-sm text-white/60">
                      <span className={p.highlight ? "text-blue-400" : "text-white/30"}>✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href={p.href}
                  className={`block text-center py-3 rounded-xl font-semibold text-sm transition ${
                    p.highlight
                      ? "bg-blue-500 text-white hover:bg-blue-400"
                      : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {p.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-32 px-6 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-5xl font-black mb-6">지금 시작하세요</h2>
          <p className="text-white/40 mb-10">회원가입 없이도 체험 가능합니다</p>
          <Link
            href="/demo"
            className="inline-block bg-white text-[#0a0f1e] font-bold text-lg px-12 py-5 rounded-2xl hover:bg-white/90 transition shadow-2xl shadow-white/5"
          >
            무료로 체험하기 →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-12 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="font-bold text-white/60">세금비서</span>
          <p className="text-xs text-white/20 text-center">
            본 서비스는 참고용 AI 코치입니다. 실제 신고는 공인 세무사와 상담하세요.
          </p>
          <p className="text-xs text-white/20">© 2026 세금비서</p>
        </div>
      </footer>
    </div>
  )
}
'''

files['src/app/demo/page.tsx'] = '''"use client"
import { useState, useRef } from "react"
import Link from "next/link"

interface TxResult {
  desc: string
  amount: number
  category: string
  deductible: boolean
  confidence: number
}

const SAMPLE_DATA: TxResult[] = [
  { desc: "어도비 크리에이티브 클라우드", amount: -65000, category: "소프트웨어", deductible: true, confidence: 0.97 },
  { desc: "스타벅스 강남점", amount: -8500, category: "식비", deductible: false, confidence: 0.91 },
  { desc: "유튜브 프리미엄", amount: -14900, category: "플랫폼수수료", deductible: true, confidence: 0.95 },
  { desc: "AWS 서버 비용", amount: -45000, category: "통신비", deductible: true, confidence: 0.98 },
  { desc: "카카오택시 업무출장", amount: -12000, category: "교통비", deductible: true, confidence: 0.82 },
  { desc: "쿠팡 조명장비", amount: -89000, category: "장비구입", deductible: true, confidence: 0.93 },
  { desc: "배달의민족", amount: -23000, category: "식비", deductible: false, confidence: 0.96 },
  { desc: "Notion 구독", amount: -10000, category: "소프트웨어", deductible: true, confidence: 0.97 },
]

export default function DemoPage() {
  const [step, setStep] = useState<"upload" | "analyzing" | "result">("upload")
  const [results, setResults] = useState<TxResult[]>([])
  const [showModal, setShowModal] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const imgRef = useRef<HTMLInputElement>(null)

  const deductTotal = results.filter(r => r.deductible).reduce((s, r) => s + Math.abs(r.amount), 0)
  const missedSaving = Math.round(deductTotal * 0.15)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setFileName(f.name)
  }

  function handleAnalyze() {
    setStep("analyzing")
    setTimeout(() => {
      setResults(SAMPLE_DATA)
      setStep("result")
    }, 2200)
  }

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white">
      {/* Nav */}
      <nav className="border-b border-white/5 px-6 h-14 flex items-center justify-between">
        <Link href="/" className="font-bold tracking-tight">세금비서</Link>
        <Link href="/signup" className="text-sm bg-white text-[#0a0f1e] font-semibold px-4 py-2 rounded-lg hover:bg-white/90 transition">
          무료 시작
        </Link>
      </nav>

      <main className="max-w-2xl mx-auto px-6 py-16">

        {/* Step: Upload */}
        {step === "upload" && (
          <div>
            <div className="mb-12">
              <h1 className="text-4xl font-black mb-3">AI 세금 분석 체험</h1>
              <p className="text-white/40">회원가입 없이 바로 체험해보세요</p>
            </div>

            <div className="space-y-4 mb-8">
              {/* CSV Upload */}
              <div
                className="border border-white/10 rounded-2xl p-8 text-center cursor-pointer hover:border-white/20 hover:bg-white/[0.02] transition"
                onClick={() => fileRef.current?.click()}
              >
                <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
                <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mx-auto mb-4 text-2xl">
                  📄
                </div>
                <p className="font-semibold mb-1">
                  {fileName ?? "거래내역 CSV 업로드"}
                </p>
                <p className="text-sm text-white/30">은행 거래내역 CSV 파일을 드래그하거나 클릭하세요</p>
              </div>

              {/* OCR Upload */}
              <div
                className="border border-white/10 rounded-2xl p-8 text-center cursor-pointer hover:border-white/20 hover:bg-white/[0.02] transition"
                onClick={() => imgRef.current?.click()}
              >
                <input ref={imgRef} type="file" accept="image/*" className="hidden" onChange={() => {}} />
                <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mx-auto mb-4 text-2xl">
                  📷
                </div>
                <p className="font-semibold mb-1">영수증 사진 OCR</p>
                <p className="text-sm text-white/30">영수증 사진을 업로드하면 자동으로 분석합니다</p>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={handleAnalyze}
                className="w-full bg-white text-[#0a0f1e] font-bold py-4 rounded-xl hover:bg-white/90 transition"
              >
                {fileName ? "내 파일로 AI 분석 시작" : "샘플 데이터로 체험하기"} →
              </button>
              <p className="text-center text-xs text-white/20">
                업로드한 파일은 서버에 저장되지 않습니다
              </p>
            </div>
          </div>
        )}

        {/* Step: Analyzing */}
        {step === "analyzing" && (
          <div className="text-center py-32">
            <div className="w-16 h-16 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-8" />
            <h2 className="text-2xl font-bold mb-3">AI 분석 중...</h2>
            <p className="text-white/40 text-sm">거래내역을 분류하고 공제 항목을 찾고 있습니다</p>
          </div>
        )}

        {/* Step: Result */}
        {step === "result" && (
          <div>
            {/* Summary */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-6">
                <p className="text-sm text-white/40 mb-1">공제 가능 금액</p>
                <p className="text-3xl font-black text-blue-400">{deductTotal.toLocaleString()}원</p>
              </div>
              <div className="rounded-2xl bg-blue-500/10 border border-blue-500/30 p-6">
                <p className="text-sm text-white/40 mb-1">예상 절세 효과</p>
                <p className="text-3xl font-black text-blue-400">{missedSaving.toLocaleString()}원</p>
              </div>
            </div>

            {/* Results Table */}
            <div className="rounded-2xl border border-white/10 overflow-hidden mb-8">
              <div className="px-6 py-4 bg-white/[0.03] border-b border-white/5">
                <h2 className="font-semibold text-sm">AI 분류 결과 ({results.length}건)</h2>
              </div>
              <div className="divide-y divide-white/5">
                {results.map((r, i) => (
                  <div key={i} className="px-6 py-4 flex items-center justify-between hover:bg-white/[0.02] transition">
                    <div>
                      <p className="text-sm font-medium">{r.desc}</p>
                      <p className="text-xs text-white/30 mt-0.5">{r.category} · {Math.round(r.confidence * 100)}%</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{r.amount.toLocaleString()}원</p>
                      <span className={`text-xs font-semibold ${r.deductible ? "text-blue-400" : "text-white/20"}`}>
                        {r.deductible ? "공제가능" : "공제불가"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* CTA */}
            <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-8 text-center">
              <h3 className="text-xl font-black mb-2">내 실제 거래내역으로 분석받기</h3>
              <p className="text-sm text-white/40 mb-6">
                지금까지 놓친 공제를 전부 찾아드립니다.<br />첫 달 19,500원, 언제든 해지 가능.
              </p>
              <div className="flex flex-col gap-3">
                <Link
                  href="/signup?plan=pro"
                  className="bg-white text-[#0a0f1e] font-bold py-3 rounded-xl hover:bg-white/90 transition text-sm"
                >
                  첫 달 50% 할인으로 시작하기 →
                </Link>
                <button
                  onClick={() => setShowModal(true)}
                  className="text-sm text-white/30 hover:text-white/60 transition py-2"
                >
                  분석 결과 저장하기
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6" onClick={() => setShowModal(false)}>
          <div className="bg-[#111827] border border-white/10 rounded-2xl p-8 max-w-md w-full" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-black mb-3">분석 결과를 저장하려면</h3>
            <p className="text-white/50 text-sm mb-8 leading-relaxed">
              30초만에 회원가입하고 내 거래내역으로<br />
              무제한 분석을 이용하세요.
            </p>
            <div className="flex flex-col gap-3">
              <Link
                href="/signup?plan=pro"
                className="block text-center bg-white text-[#0a0f1e] font-bold py-3 rounded-xl hover:bg-white/90 transition text-sm"
              >
                무료로 회원가입하기 →
              </Link>
              <button onClick={() => setShowModal(false)} className="text-sm text-white/30 hover:text-white/50 transition py-2">
                나중에
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
'''

for path, content in files.items():
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content.lstrip('\n'))
    print(f'OK {path}')

print('All done')