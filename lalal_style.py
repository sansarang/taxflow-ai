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

const FAQ_ITEMS = [
  { q: "어떤 파일을 올리면 되나요?", a: "은행 앱에서 내려받은 거래내역 CSV 파일 또는 영수증 사진(JPG, PNG)을 올리시면 됩니다." },
  { q: "내 거래내역이 저장되나요?", a: "데모 분석 결과는 서버에 저장되지 않습니다. 회원가입 후에는 암호화하여 안전하게 보관됩니다." },
  { q: "삼쩜삼과 무엇이 다른가요?", a: "삼쩜삼은 연 1회 신고 대행 서비스입니다. 세금비서는 매달 실시간으로 절세를 도와드리는 AI 코치입니다." },
  { q: "얼마나 절세할 수 있나요?", a: "평균적으로 월 34만원의 공제 항목을 추가로 발견합니다. 세율 15% 기준 약 5만원 절세 효과입니다." },
  { q: "언제든 해지할 수 있나요?", a: "네, 언제든지 마이페이지에서 즉시 해지할 수 있습니다. 위약금이나 추가 비용은 없습니다." },
]

export default function LandingPage() {
  const [step, setStep] = useState<"idle" | "analyzing" | "result">("idle")
  const [fileName, setFileName] = useState<string | null>(null)
  const [results, setResults] = useState<TxResult[]>([])
  const [showModal, setShowModal] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const deductTotal = results.filter(r => r.deductible).reduce((s, r) => s + Math.abs(r.amount), 0)
  const missedSaving = Math.round(deductTotal * 0.15)

  function handleFile(file: File) {
    setFileName(file.name)
    setStep("analyzing")
    setTimeout(() => { setResults(SAMPLE); setStep("result") }, 2200)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) handleFile(f)
  }

  function runSample() {
    setFileName("sample_transactions.csv")
    setStep("analyzing")
    setTimeout(() => { setResults(SAMPLE); setStep("result") }, 2200)
  }

  return (
    <div className="min-h-screen text-white" style={{background:"#111216", fontFamily:"'Inter', -apple-system, sans-serif"}}>

      {/* Top Banner */}
      <div className="bg-violet-600 text-white text-center py-2.5 px-4 text-xs sm:text-sm font-semibold">
        첫 달 50% 할인 이벤트 진행 중 &nbsp;·&nbsp;
        <Link href="/signup?plan=pro" className="underline underline-offset-2 hover:no-underline">지금 시작하기 →</Link>
      </div>

      {/* Nav */}
      <nav className="border-b border-white/[0.08] bg-[#111216]/95 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <span className="text-base font-bold">세금비서</span>
            <div className="hidden md:flex items-center gap-6 text-sm text-white/55">
              <a href="#what" className="hover:text-white transition-colors">서비스 소개</a>
              <a href="#pricing" className="hover:text-white transition-colors">요금제</a>
              <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="hidden sm:block text-sm text-white/50 hover:text-white transition-colors">로그인</Link>
            <Link href="/signup" className="text-sm bg-white text-[#111216] font-bold px-4 py-2 rounded-lg hover:bg-white/90 transition-all">
              무료 시작
            </Link>
          </div>
        </div>
      </nav>

      {/* ── HERO: 2-column layout like lalal.ai ── */}
      <section className="max-w-7xl mx-auto px-5 sm:px-8 pt-16 pb-20">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-start">

          {/* Left */}
          <div className="pt-4">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.05] tracking-tight mb-6">
              거래내역 올리면<br />AI가 세금을<br />정리해드립니다
            </h1>
            <p className="text-base sm:text-lg text-white/50 leading-relaxed mb-8 max-w-md">
              한국 크리에이터·1인사업자를 위한 실시간 세금 AI 코치.
              놓친 공제를 찾고 매달 절세하세요.
            </p>
            <div className="flex flex-wrap gap-3 text-sm text-white/40">
              <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />회원가입 불필요</span>
              <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />CSV + 사진 지원</span>
              <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />97% 분류 정확도</span>
            </div>
          </div>

          {/* Right: Upload Box */}
          <div className="rounded-2xl border border-white/[0.1] overflow-hidden" style={{background:"#1a1c22"}}>
            {/* Box Header */}
            <div className="px-6 py-5 border-b border-white/[0.07] flex items-center justify-between">
              <div>
                <h2 className="font-bold text-base">거래내역 분석하기</h2>
                <p className="text-xs text-white/35 mt-0.5">CSV 또는 영수증 사진을 올리세요</p>
              </div>
              <div className="w-3 h-3 rounded-full bg-red-500/70" />
            </div>

            {/* Upload area */}
            {step === "idle" && (
              <div className="p-6">
                <div
                  className={`rounded-xl border-2 border-dashed p-10 text-center cursor-pointer transition-all ${dragOver ? "border-violet-400 bg-violet-500/10" : "border-white/10 hover:border-white/20 hover:bg-white/[0.02]"}`}
                  onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileRef.current?.click()}
                >
                  <input ref={fileRef} type="file" accept=".csv,image/*" className="hidden" onChange={handleInput} />
                  <div className="text-4xl mb-4">📂</div>
                  <p className="font-semibold text-sm mb-1">파일을 드래그하거나 클릭</p>
                  <p className="text-xs text-white/30">거래내역 CSV · 영수증 JPG/PNG</p>
                </div>

                {/* Type selector (lalal.ai style) */}
                <div className="mt-4 rounded-xl border border-white/[0.08] px-4 py-3 flex items-center justify-between" style={{background:"#111216"}}>
                  <span className="text-sm text-white/60">분석 유형</span>
                  <span className="text-sm font-semibold text-white flex items-center gap-2">
                    전체 공제 최적화
                    <svg className="w-4 h-4 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </span>
                </div>

                <button
                  onClick={() => fileRef.current?.click()}
                  className="mt-4 w-full py-4 rounded-xl font-bold text-base transition-all active:scale-95"
                  style={{background:"#7c3aed", color:"white"}}
                  onMouseEnter={e => (e.currentTarget.style.background="#6d28d9")}
                  onMouseLeave={e => (e.currentTarget.style.background="#7c3aed")}
                >
                  파일 선택하기
                </button>

                <button onClick={runSample} className="mt-3 w-full text-xs text-white/25 hover:text-white/50 transition-colors py-2">
                  파일 없이 샘플로 체험하기
                </button>
                <p className="text-center text-[11px] text-white/20 mt-2">파일을 올리면 이용약관에 동의하는 것으로 간주됩니다</p>
              </div>
            )}

            {/* Analyzing */}
            {step === "analyzing" && (
              <div className="p-10 text-center">
                <div className="w-12 h-12 border-2 border-violet-400 border-t-transparent rounded-full animate-spin mx-auto mb-6" />
                <p className="font-bold mb-2">AI 분석 중...</p>
                <p className="text-sm text-white/30">{fileName}</p>
                <div className="mt-6 space-y-2 text-xs text-white/20 text-left max-w-xs mx-auto">
                  <p>✓ 파일 파싱 완료</p>
                  <p>✓ 세금 코드 분류 중...</p>
                  <p className="animate-pulse text-violet-400">◎ 공제 항목 탐색 중...</p>
                </div>
              </div>
            )}

            {/* Result */}
            {step === "result" && (
              <div className="p-5">
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="rounded-xl p-4" style={{background:"#111216"}}>
                    <p className="text-[11px] text-white/35 mb-1">공제 가능</p>
                    <p className="text-xl font-black text-violet-400">{deductTotal.toLocaleString()}원</p>
                  </div>
                  <div className="rounded-xl p-4" style={{background:"#1e1530"}}>
                    <p className="text-[11px] text-white/35 mb-1">예상 절세</p>
                    <p className="text-xl font-black text-violet-300">{missedSaving.toLocaleString()}원</p>
                  </div>
                </div>

                <div className="rounded-xl overflow-hidden border border-white/[0.07] mb-4" style={{background:"#111216"}}>
                  <div className="px-4 py-2.5 border-b border-white/[0.06] flex justify-between">
                    <span className="text-[11px] text-white/40">분류 결과 {results.length}건</span>
                    <span className="text-[11px] text-green-400">{results.filter(r=>r.deductible).length}건 공제가능</span>
                  </div>
                  <div className="max-h-52 overflow-y-auto divide-y divide-white/[0.04]">
                    {results.map((r, i) => (
                      <div key={i} className="px-4 py-3 flex items-center justify-between">
                        <div className="min-w-0 flex-1 pr-3">
                          <p className="text-xs font-medium truncate">{r.desc}</p>
                          <p className="text-[10px] text-white/25">{r.category}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-xs font-semibold">{r.amount.toLocaleString()}원</p>
                          <span className={`text-[10px] font-bold ${r.deductible ? "text-violet-400" : "text-white/20"}`}>
                            {r.deductible ? "공제가능" : "공제불가"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => setShowModal(true)}
                  className="w-full py-3.5 rounded-xl font-bold text-sm transition-all active:scale-95 mb-2"
                  style={{background:"#7c3aed"}}
                  onMouseEnter={e => (e.currentTarget.style.background="#6d28d9")}
                  onMouseLeave={e => (e.currentTarget.style.background="#7c3aed")}
                >
                  결과 저장 및 PDF 다운로드
                </button>
                <button onClick={() => { setStep("idle"); setResults([]); setFileName(null) }}
                  className="w-full text-xs text-white/25 hover:text-white/50 py-2 transition-colors">
                  다시 분석하기
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* What is */}
      <section id="what" className="border-t border-white/[0.06] py-20 px-5 sm:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-black mb-5">세금비서란?</h2>
          <p className="text-white/45 text-base sm:text-lg leading-relaxed mb-16 max-w-2xl mx-auto">
            한국 크리에이터와 1인사업자를 위한 실시간 AI 세금 코치입니다.
            거래내역을 자동 분류하고 놓친 공제를 찾아 매달 절세를 도와드립니다.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { v: "94%", l: "공제 발견율" },
              { v: "97%", l: "분류 정확도" },
              { v: "34만원", l: "월 평균 절세" },
              { v: "30초", l: "분석 소요시간" },
            ].map(s => (
              <div key={s.l} className="rounded-2xl border border-white/[0.07] p-6" style={{background:"#1a1c22"}}>
                <div className="text-3xl font-black text-violet-400 mb-1">{s.v}</div>
                <div className="text-sm text-white/40">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Compare */}
      <section className="py-20 px-5 sm:px-8">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-black text-center mb-12">삼쩜삼 vs 세금비서</h2>
          <div className="rounded-2xl overflow-hidden border border-white/[0.08]" style={{background:"#1a1c22"}}>
            <div className="grid grid-cols-3 px-6 py-4 border-b border-white/[0.06] text-sm font-semibold">
              <span className="text-white/35">기능</span>
              <span className="text-center text-white/35">삼쩜삼</span>
              <span className="text-center text-violet-400">세금비서</span>
            </div>
            {[
              ["연간 세금 신고", "✓", "✓"],
              ["매달 절세 코치", "–", "✓"],
              ["거래내역 자동 분류", "–", "✓"],
              ["놓친 공제 감지", "–", "✓"],
              ["사진 OCR", "–", "✓"],
              ["세금 예측", "–", "✓"],
              ["이용 방식", "연 1회", "월 구독"],
            ].map(([f, a, b], i) => (
              <div key={i} className="grid grid-cols-3 px-6 py-4 border-t border-white/[0.05] text-sm">
                <span className="text-white/55">{f}</span>
                <span className="text-center text-white/20">{a}</span>
                <span className="text-center font-semibold text-violet-400">{b}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-5 sm:px-8 border-t border-white/[0.06]">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-black text-center mb-3">요금제</h2>
          <p className="text-center text-white/35 text-sm mb-12">첫 달 50% 할인 · 언제든 해지</p>
          <div className="grid sm:grid-cols-3 gap-5">
            {[
              { name:"Starter", price:"0", unit:"원", sub:"항상 무료", features:["월 5회 분류","기본 세금 계산","이메일 알림"], cta:"무료로 시작", href:"/signup", hi:false },
              { name:"Pro", price:"39,000", unit:"원/월", sub:"첫 달 19,500원", features:["무제한 분류","AI 공제 최적화","사진 OCR","분기 알림","주간 리포트"], cta:"카드로 시작", href:"/signup?plan=pro", hi:true },
              { name:"Business", price:"89,000", unit:"원/월", sub:"첫 달 44,500원", features:["Pro 전체","세무사 연동","PDF 신고서","팀원 초대","우선 지원"], cta:"카드로 시작", href:"/signup?plan=business", hi:false },
            ].map(p => (
              <div key={p.name} className={`rounded-2xl p-7 border flex flex-col ${p.hi ? "border-violet-500/50" : "border-white/[0.07]"}`}
                style={{background: p.hi ? "#1e1530" : "#1a1c22"}}>
                {p.hi && <div className="text-[10px] font-bold text-violet-400 mb-4 tracking-widest uppercase">Best Value</div>}
                <div className="font-bold mb-1 text-white/80">{p.name}</div>
                <div className="text-3xl font-black mb-1">{p.price}<span className="text-sm font-normal text-white/25">{p.unit}</span></div>
                <div className={`text-xs font-semibold mb-6 ${p.hi ? "text-violet-400" : "text-white/25"}`}>{p.sub}</div>
                <ul className="space-y-2.5 mb-7 flex-1">
                  {p.features.map(f => (
                    <li key={f} className="flex items-center gap-2.5 text-xs text-white/45">
                      <span className={p.hi ? "text-violet-400" : "text-white/20"}>✓</span>{f}
                    </li>
                  ))}
                </ul>
                <Link href={p.href}
                  className="block text-center py-3 rounded-xl font-bold text-sm transition-all active:scale-95"
                  style={{background: p.hi ? "#7c3aed" : "rgba(255,255,255,0.06)", color: p.hi ? "white" : "rgba(255,255,255,0.45)"}}>
                  {p.cta}
                </Link>
                {!p.hi && <p className="text-center text-[11px] text-white/20 mt-2">신용카드 필요 없음</p>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20 px-5 sm:px-8 border-t border-white/[0.06]">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-black text-center mb-12">FAQ</h2>
          <div className="space-y-0">
            {FAQ_ITEMS.map((item, i) => (
              <div key={i} className="border-b border-white/[0.07]">
                <button
                  className="w-full flex items-center justify-between py-5 text-left hover:text-white/80 transition-colors"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  <span className="text-sm sm:text-base font-medium text-white/70">{item.q}</span>
                  <svg className={`w-5 h-5 flex-shrink-0 ml-4 text-white/30 transition-transform ${openFaq === i ? "rotate-180" : ""}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {openFaq === i && (
                  <div className="pb-5 text-sm text-white/40 leading-relaxed">{item.a}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA (lalal.ai style repeat) */}
      <section className="py-20 px-5 sm:px-8 border-t border-white/[0.06]">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-3xl sm:text-4xl font-black mb-4">지금 바로 분석해보세요</h2>
            <p className="text-white/40 text-base leading-relaxed">
              거래내역을 올리고 AI가 찾아주는<br />놓친 공제를 직접 확인하세요.
            </p>
          </div>
          <div className="rounded-2xl border border-white/[0.08] p-6" style={{background:"#1a1c22"}}>
            <p className="font-bold mb-4 text-sm">거래내역 분석하기</p>
            <button
              onClick={() => { window.scrollTo({top:0,behavior:"smooth"}); setStep("idle") }}
              className="w-full py-4 rounded-xl font-bold text-base transition-all active:scale-95"
              style={{background:"#7c3aed"}}
              onMouseEnter={e => (e.currentTarget.style.background="#6d28d9")}
              onMouseLeave={e => (e.currentTarget.style.background="#7c3aed")}
            >
              파일 선택하기
            </button>
            <p className="text-center text-xs text-white/20 mt-3">회원가입 불필요 · 무료 체험</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] py-12 px-5 sm:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid sm:grid-cols-4 gap-8 mb-10">
            <div>
              <span className="font-bold text-base block mb-3">세금비서</span>
              <p className="text-xs text-white/30 leading-relaxed">한국 크리에이터·1인사업자를 위한 AI 세금 코치</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-white/50 mb-3 uppercase tracking-wider">서비스</p>
              <ul className="space-y-2 text-xs text-white/30">
                <li><Link href="/dashboard" className="hover:text-white/60">대시보드</Link></li>
                <li><Link href="/upload" className="hover:text-white/60">거래내역 업로드</Link></li>
                <li><Link href="/optimize" className="hover:text-white/60">AI 최적화</Link></li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold text-white/50 mb-3 uppercase tracking-wider">회사</p>
              <ul className="space-y-2 text-xs text-white/30">
                <li><a href="#" className="hover:text-white/60">소개</a></li>
                <li><a href="#faq" className="hover:text-white/60">FAQ</a></li>
                <li><a href="#" className="hover:text-white/60">이용약관</a></li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold text-white/50 mb-3 uppercase tracking-wider">요금제</p>
              <ul className="space-y-2 text-xs text-white/30">
                <li><Link href="/signup" className="hover:text-white/60">Free</Link></li>
                <li><Link href="/signup?plan=pro" className="hover:text-white/60">Pro</Link></li>
                <li><Link href="/signup?plan=business" className="hover:text-white/60">Business</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/[0.06] pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-white/20">© 2026 세금비서. All rights reserved.</p>
            <p className="text-xs text-white/15 text-center">본 서비스는 참고용 AI 코치입니다. 실제 신고는 공인 세무사와 상담하세요.</p>
          </div>
        </div>
      </footer>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6"
          style={{background:"rgba(0,0,0,0.75)", backdropFilter:"blur(8px)"}}
          onClick={() => setShowModal(false)}>
          <div className="rounded-t-3xl sm:rounded-2xl border border-white/10 p-8 sm:p-10 w-full sm:max-w-md"
            style={{background:"#1a1c22"}}
            onClick={e => e.stopPropagation()}>
            <div className="w-8 h-1 rounded-full mx-auto mb-8 sm:hidden" style={{background:"rgba(255,255,255,0.1)"}} />
            <div className="text-[10px] font-bold text-violet-400 tracking-widest uppercase mb-4">30초 회원가입</div>
            <h3 className="text-2xl font-black mb-3">결과를 저장하려면<br />회원가입이 필요합니다</h3>
            <p className="text-white/40 text-sm mb-8 leading-relaxed">
              내 실제 거래내역으로 무제한 분석하고<br />
              매달 절세 리포트를 받아보세요.<br />
              <span className="text-violet-400 font-semibold">첫 달 19,500원 · 언제든 해지 가능</span>
            </p>
            <div className="flex flex-col gap-3">
              <Link href="/signup?plan=pro"
                className="block text-center py-4 rounded-xl font-bold text-sm transition-all active:scale-95"
                style={{background:"#7c3aed", color:"white"}}>
                첫 달 50% 할인으로 시작 →
              </Link>
              <Link href="/signup"
                className="block text-center py-3.5 rounded-xl font-semibold text-sm border border-white/10 text-white/45 hover:text-white hover:border-white/20 transition-all">
                무료로 시작
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