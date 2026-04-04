import os

os.makedirs('src/app', exist_ok=True)

content = '''"use client"
import { useState, useRef } from "react"
import Link from "next/link"

interface TxResult {
  desc: string
  amount: number
  category: string
  deductible: boolean
  confidence: number
}

const SAMPLE: TxResult[] = [
  { desc: "어도비 크리에이티브 클라우드", amount: -65000, category: "소프트웨어", deductible: true, confidence: 0.97 },
  { desc: "스타벅스 강남점", amount: -8500, category: "식비", deductible: false, confidence: 0.91 },
  { desc: "유튜브 프리미엄", amount: -14900, category: "플랫폼수수료", deductible: true, confidence: 0.95 },
  { desc: "AWS 서버 비용", amount: -45000, category: "통신비", deductible: true, confidence: 0.98 },
  { desc: "카카오택시 업무출장", amount: -12000, category: "교통비", deductible: true, confidence: 0.82 },
  { desc: "쿠팡 조명장비", amount: -89000, category: "장비구입", deductible: true, confidence: 0.93 },
  { desc: "배달의민족", amount: -23000, category: "식비", deductible: false, confidence: 0.96 },
  { desc: "Notion 구독", amount: -10000, category: "소프트웨어", deductible: true, confidence: 0.97 },
]

export default function LandingPage() {
  const [step, setStep] = useState<"hero" | "analyzing" | "result">("hero")
  const [fileName, setFileName] = useState<string | null>(null)
  const [results, setResults] = useState<TxResult[]>([])
  const [showModal, setShowModal] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const deductTotal = results.filter(r => r.deductible).reduce((s, r) => s + Math.abs(r.amount), 0)
  const missedSaving = Math.round(deductTotal * 0.15)
  const nonDeductTotal = results.filter(r => !r.deductible).reduce((s, r) => s + Math.abs(r.amount), 0)

  function handleFile(file: File) {
    setFileName(file.name)
    setStep("analyzing")
    setTimeout(() => {
      setResults(SAMPLE)
      setStep("result")
    }, 2000)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  function scrollToUpload() {
    document.getElementById("upload-section")?.scrollIntoView({ behavior: "smooth" })
  }

  return (
    <div className="min-h-screen bg-[#080c18] text-white font-sans">

      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 border-b border-white/[0.06] bg-[#080c18]/80 backdrop-blur-2xl">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
          <span className="text-base font-bold tracking-tight">세금비서</span>
          <div className="hidden md:flex items-center gap-8 text-sm text-white/50">
            <a href="#upload-section" className="hover:text-white transition-colors">바로 분석</a>
            <a href="#compare" className="hover:text-white transition-colors">비교</a>
            <a href="#pricing" className="hover:text-white transition-colors">요금제</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="hidden sm:block text-sm text-white/50 hover:text-white transition-colors">로그인</Link>
            <Link href="/signup" className="text-sm bg-white text-[#080c18] font-semibold px-4 py-2 rounded-lg hover:bg-white/90 transition-all">
              무료 시작
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-36 pb-20 px-5 sm:px-8 text-center overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] bg-blue-600/[0.08] blur-[140px] rounded-full pointer-events-none" />
        <div className="relative max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 text-xs font-medium text-blue-400/80 bg-blue-500/10 border border-blue-500/20 px-4 py-1.5 rounded-full mb-10">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse inline-block" />
            한국 크리에이터 · 1인사업자 전용
          </div>
          <h1 className="text-5xl sm:text-6xl md:text-7xl font-black tracking-tight leading-[1.02] mb-7">
            세금, 이제<br />
            <span className="bg-gradient-to-r from-blue-400 via-cyan-300 to-blue-500 bg-clip-text text-transparent">
              AI 비서
            </span>에게
          </h1>
          <p className="text-base sm:text-lg text-white/40 max-w-xl mx-auto mb-10 leading-relaxed">
            거래내역을 올리면 AI가 자동 분류하고 놓친 공제를 찾아드립니다.<br className="hidden sm:block" />
            지금 바로 아래에서 무료로 체험해보세요.
          </p>
          <button
            onClick={scrollToUpload}
            className="bg-white text-[#080c18] font-bold text-base sm:text-lg px-10 py-4 sm:py-5 rounded-2xl hover:bg-white/90 transition-all shadow-2xl shadow-white/5 active:scale-95"
          >
            지금 무료로 분석받기 →
          </button>
          <p className="text-xs text-white/20 mt-4">회원가입 불필요 · 카드 없이 체험</p>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-white/[0.06] py-12 px-5">
        <div className="max-w-3xl mx-auto grid grid-cols-3 gap-4 text-center">
          {[["34만원/월", "평균 절세"], ["94%", "공제 발견율"], ["97%", "분류 정확도"]].map(([v, l]) => (
            <div key={l}>
              <div className="text-2xl sm:text-4xl font-black mb-1">{v}</div>
              <div className="text-xs sm:text-sm text-white/30">{l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── UPLOAD SECTION ── */}
      <section id="upload-section" className="py-24 px-5 sm:px-8">
        <div className="max-w-2xl mx-auto">

          {/* Step: Hero Upload */}
          {step === "hero" && (
            <>
              <div className="text-center mb-10">
                <h2 className="text-3xl sm:text-4xl font-black mb-3">지금 바로 분석해보세요</h2>
                <p className="text-white/35 text-sm sm:text-base">CSV 또는 영수증 사진을 올리면 AI가 즉시 분석합니다</p>
              </div>

              <div
                className={`relative rounded-2xl border-2 border-dashed p-10 sm:p-14 text-center cursor-pointer transition-all ${
                  dragOver
                    ? "border-blue-400 bg-blue-500/10"
                    : "border-white/10 hover:border-white/20 hover:bg-white/[0.02]"
                }`}
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,image/*"
                  className="hidden"
                  onChange={handleInputChange}
                />
                <div className="w-14 h-14 rounded-2xl bg-white/[0.05] border border-white/10 flex items-center justify-center mx-auto mb-6 text-3xl">
                  📂
                </div>
                <p className="font-bold text-base sm:text-lg mb-2">파일을 드래그하거나 클릭하세요</p>
                <p className="text-sm text-white/30 mb-6">거래내역 CSV · 영수증 사진 (JPG, PNG)</p>
                <div className="inline-flex bg-white/[0.06] border border-white/10 rounded-xl px-5 py-2.5 text-sm font-semibold text-white/60">
                  파일 선택
                </div>
              </div>

              <div className="mt-4 text-center">
                <button
                  onClick={() => { setFileName("sample_transactions.csv"); setStep("analyzing"); setTimeout(() => { setResults(SAMPLE); setStep("result") }, 2000) }}
                  className="text-xs text-white/25 hover:text-white/50 transition-colors underline underline-offset-2"
                >
                  파일 없이 샘플 데이터로 체험하기
                </button>
              </div>
            </>
          )}

          {/* Step: Analyzing */}
          {step === "analyzing" && (
            <div className="text-center py-24">
              <div className="w-14 h-14 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-8" />
              <h2 className="text-2xl font-bold mb-3">AI 분석 중...</h2>
              <p className="text-white/30 text-sm">
                {fileName ? `"${fileName}"` : "샘플 데이터"} 분석 중입니다
              </p>
              <div className="mt-8 space-y-2 text-xs text-white/20 max-w-xs mx-auto text-left">
                <p>✓ 거래내역 파싱 완료</p>
                <p>✓ 세금 코드 분류 중...</p>
                <p className="animate-pulse">◎ 공제 항목 탐색 중...</p>
              </div>
            </div>
          )}

          {/* Step: Result */}
          {step === "result" && (
            <div>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="rounded-2xl bg-white/[0.03] border border-white/[0.08] p-5 sm:p-6">
                  <p className="text-xs text-white/35 mb-2">공제 가능 금액</p>
                  <p className="text-2xl sm:text-3xl font-black text-blue-400">{deductTotal.toLocaleString()}원</p>
                </div>
                <div className="rounded-2xl bg-blue-500/[0.08] border border-blue-500/25 p-5 sm:p-6">
                  <p className="text-xs text-white/35 mb-2">예상 절세 효과</p>
                  <p className="text-2xl sm:text-3xl font-black text-blue-400">{missedSaving.toLocaleString()}원</p>
                </div>
              </div>

              {/* Result Table */}
              <div className="rounded-2xl border border-white/[0.08] overflow-hidden mb-6">
                <div className="px-5 py-3.5 bg-white/[0.03] border-b border-white/[0.06] flex items-center justify-between">
                  <span className="text-xs font-semibold text-white/50">AI 분류 결과 {results.length}건</span>
                  <span className="text-xs text-green-400 font-semibold">{results.filter(r=>r.deductible).length}건 공제가능</span>
                </div>
                <div className="divide-y divide-white/[0.05]">
                  {results.map((r, i) => (
                    <div key={i} className="px-5 py-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                      <div className="min-w-0 flex-1 pr-4">
                        <p className="text-sm font-medium truncate">{r.desc}</p>
                        <p className="text-xs text-white/25 mt-0.5">{r.category} · {Math.round(r.confidence * 100)}%</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-semibold">{r.amount.toLocaleString()}원</p>
                        <span className={`text-[11px] font-bold ${r.deductible ? "text-blue-400" : "text-white/20"}`}>
                          {r.deductible ? "공제가능" : "공제불가"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => setShowModal(true)}
                  className="w-full bg-white text-[#080c18] font-bold py-4 rounded-xl hover:bg-white/90 transition-all active:scale-95 text-sm sm:text-base"
                >
                  분석 결과 PDF 다운로드 →
                </button>
                <button
                  onClick={() => setShowModal(true)}
                  className="w-full bg-white/[0.04] border border-white/[0.08] text-white/50 font-semibold py-3.5 rounded-xl hover:bg-white/[0.07] hover:text-white transition-all text-sm"
                >
                  내 거래내역으로 무제한 분석하기
                </button>
                <button
                  onClick={() => { setStep("hero"); setResults([]); setFileName(null) }}
                  className="text-xs text-white/20 hover:text-white/40 transition-colors py-2"
                >
                  다시 업로드하기
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Compare */}
      <section id="compare" className="py-24 px-5 sm:px-8 bg-white/[0.015]">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-black mb-3">삼쩜삼과 무엇이 다른가요?</h2>
            <p className="text-white/35 text-sm">신고 대행 vs 연중 절세 코치</p>
          </div>
          <div className="rounded-2xl overflow-hidden border border-white/[0.08]">
            <div className="grid grid-cols-3 bg-white/[0.04] px-5 sm:px-7 py-4 text-xs sm:text-sm font-semibold">
              <span className="text-white/35">기능</span>
              <span className="text-center text-white/35">삼쩜삼</span>
              <span className="text-center text-blue-400">세금비서</span>
            </div>
            {[
              ["연간 세금 신고", true, true],
              ["매달 절세 코치", false, true],
              ["거래내역 자동 분류", false, true],
              ["놓친 공제 감지", false, true],
              ["사진 OCR", false, true],
              ["세금 예측", false, true],
              ["이용 방식", "연 1회", "월 구독"],
            ].map(([feat, a, b], i) => (
              <div key={i} className="grid grid-cols-3 px-5 sm:px-7 py-4 border-t border-white/[0.05] text-xs sm:text-sm hover:bg-white/[0.02]">
                <span className="text-white/55 pr-2">{feat as string}</span>
                <span className="text-center text-white/20">{typeof a === "boolean" ? (a ? "✓" : "—") : a as string}</span>
                <span className="text-center font-semibold text-blue-400">{typeof b === "boolean" ? (b ? "✓" : "—") : b as string}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 px-5 sm:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-black mb-3">간단한 요금제</h2>
            <p className="text-white/35 text-sm">첫 달 50% 할인 · 언제든 해지</p>
          </div>
          <div className="grid sm:grid-cols-3 gap-4 sm:gap-5">
            {[
              { name:"Free", price:"0", unit:"원", sub:"월 5회 무료", features:["월 5회 분류","기본 세금 계산","이메일 알림"], cta:"무료로 시작", href:"/signup", hi:false },
              { name:"Pro", price:"39,000", unit:"원/월", sub:"첫 달 19,500원", features:["무제한 분류","AI 공제 최적화","사진 OCR","분기 알림","주간 리포트"], cta:"첫 달 50% 할인", href:"/signup?plan=pro", hi:true },
              { name:"Business", price:"89,000", unit:"원/월", sub:"첫 달 44,500원", features:["Pro 전체","세무사 연동","PDF 신고서","팀원 초대","우선 지원"], cta:"첫 달 50% 할인", href:"/signup?plan=business", hi:false },
            ].map((p) => (
              <div key={p.name} className={`rounded-2xl p-7 border flex flex-col ${p.hi ? "border-blue-500/40 bg-blue-500/[0.06]" : "border-white/[0.07] bg-white/[0.02]"}`}>
                {p.hi && <div className="text-[10px] font-bold text-blue-400 mb-4 tracking-widest uppercase">Most Popular</div>}
                <div className="font-bold mb-1">{p.name}</div>
                <div className="text-3xl font-black mb-1">{p.price}<span className="text-sm font-normal text-white/25">{p.unit}</span></div>
                <div className={`text-xs font-semibold mb-6 ${p.hi ? "text-blue-400" : "text-white/25"}`}>{p.sub}</div>
                <ul className="space-y-2.5 mb-7 flex-1">
                  {p.features.map(f => (
                    <li key={f} className="flex items-center gap-2.5 text-xs sm:text-sm text-white/45">
                      <span className={p.hi ? "text-blue-400" : "text-white/20"}>✓</span>{f}
                    </li>
                  ))}
                </ul>
                <Link href={p.href} className={`block text-center py-3 rounded-xl font-semibold text-sm transition-all active:scale-95 ${p.hi ? "bg-blue-500 text-white hover:bg-blue-400" : "bg-white/[0.05] text-white/45 hover:bg-white/10 hover:text-white"}`}>
                  {p.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] py-10 px-5 sm:px-8">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="font-bold text-white/35 text-sm">세금비서</span>
          <p className="text-xs text-white/15 text-center">본 서비스는 참고용 AI 코치입니다. 실제 신고는 공인 세무사와 상담하세요.</p>
          <p className="text-xs text-white/15">© 2026 세금비서</p>
        </div>
      </footer>

      {/* Signup Modal */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-6"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-[#111827] border border-white/10 rounded-t-3xl sm:rounded-2xl p-8 sm:p-10 w-full sm:max-w-md"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-white/10 rounded-full mx-auto mb-8 sm:hidden" />
            <div className="text-xs font-bold text-blue-400 tracking-widest uppercase mb-4">30초 회원가입</div>
            <h3 className="text-2xl font-black mb-3">결과를 저장하려면<br />회원가입이 필요합니다</h3>
            <p className="text-white/40 text-sm mb-8 leading-relaxed">
              내 실제 거래내역으로 무제한 분석하고<br />
              매달 절세 리포트를 받아보세요.<br />
              <span className="text-blue-400 font-semibold">첫 달 19,500원, 언제든 해지 가능.</span>
            </p>
            <div className="flex flex-col gap-3">
              <Link
                href="/signup?plan=pro"
                className="block text-center bg-white text-[#080c18] font-bold py-4 rounded-xl hover:bg-white/90 transition-all text-sm active:scale-95"
              >
                첫 달 50% 할인으로 시작하기 →
              </Link>
              <Link
                href="/signup"
                className="block text-center bg-white/[0.05] border border-white/10 text-white/50 font-semibold py-3.5 rounded-xl hover:bg-white/10 hover:text-white transition-all text-sm"
              >
                무료로 시작하기
              </Link>
              <button onClick={() => setShowModal(false)} className="text-xs text-white/20 hover:text-white/40 transition-colors py-2">
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

with open('src/app/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content.lstrip('\n'))
print('OK src/app/page.tsx')