"use client"
import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"

interface TxResult {
  desc: string; amount: number; category: string; deductible: boolean; confidence: number
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

const PAIN_POINTS = [
  { no:"01", q:"매달 거래내역 정리하는 게 너무 귀찮고 시간 많이 드시나요?", solution:"CSV 한 번 올리면 AI가 자동 분류", demo:"auto_classify" },
  { no:"02", q:"뭐가 공제되는지 몰라서 나중에 후회하시나요?", solution:"놓친 공제 항목 즉시 감지 & 알림", demo:"deduction" },
  { no:"03", q:"신고 기간에 급하게 하다 실수할까봐 불안하시나요?", solution:"분기별 예정신고 자동 알림", demo:"alert" },
  { no:"04", q:"증빙 자료 찾는 게 번거로우시나요?", solution:"사진 OCR로 영수증 즉시 등록", demo:"ocr" },
  { no:"05", q:"이번 달 세금 얼마나 나올지 모르시죠?", solution:"실시간 세금 예측 대시보드", demo:"forecast" },
]

const FAQ_ITEMS = [
  { q:"어떤 파일을 올리면 되나요?", a:"은행 앱에서 내려받은 거래내역 CSV 또는 영수증 사진(JPG, PNG)을 올리시면 됩니다." },
  { q:"내 거래내역이 저장되나요?", a:"데모 분석은 서버에 저장되지 않습니다. 회원가입 후에는 암호화하여 안전하게 보관됩니다." },
  { q:"삼쩜삼과 무엇이 다른가요?", a:"삼쩜삼은 연 1회 신고 대행입니다. 미리택스는 매달 실시간으로 절세를 도와드리는 AI 코치입니다." },
  { q:"얼마나 절세할 수 있나요?", a:"평균 월 34만원의 추가 공제 항목을 발견합니다. 세율 15% 기준 약 5만원 절세 효과입니다." },
  { q:"언제든 해지할 수 있나요?", a:"네, 마이페이지에서 즉시 해지 가능합니다. 위약금이나 추가 비용은 없습니다." },
]

function Logo({ size="md", gray=false, spin=false }: { size?: "sm"|"md"|"lg"; gray?: boolean; spin?: boolean }) {
  const h = size==="lg" ? 48 : size==="sm" ? 28 : 36
  const w = Math.round(h * 3.75)
  return (
    <Image src="/logo.png" alt="미리택스" height={h} width={w}
      className={`h-auto w-auto ${gray?"opacity-30 grayscale":""} ${spin?"animate-spin":""}`}
      style={{ maxHeight:h, objectFit:"contain" }} priority />
  )
}

function PainPointDemo({ demo }: { demo: string }) {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setTick(p => p+1), 1200)
    return () => clearInterval(t)
  }, [])

  if (demo === "auto_classify") {
    const items = ["어도비 구독 → 소프트웨어 ✓","카카오택시 → 교통비 ✓","AWS 서버 → 통신비 ✓","쿠팡 조명 → 장비구입 ✓"]
    return <div className="space-y-2">{items.map((item,i) => (
      <div key={item} className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg transition-all duration-500 ${tick%4>=i?"bg-violet-500/20 text-violet-300":"bg-white/[0.04] text-white/25"}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${tick%4>=i?"bg-violet-400":"bg-white/20"}`} />{item}
      </div>
    ))}</div>
  }
  if (demo === "deduction") {
    const found = tick%3
    return <div className="space-y-2">
      <div className="text-xs text-white/30 mb-3">AI 공제 감지 중...</div>
      {["장비구입 89,000원 → 공제가능!","소프트웨어 65,000원 → 공제가능!","교통비 12,000원 → 공제가능!"].map((t,i) => (
        <div key={t} className={`text-xs px-3 py-2 rounded-lg transition-all duration-700 ${found>i?"bg-green-500/15 text-green-400":"bg-white/[0.03] text-white/20"}`}>
          {found>i?"✓ ":"◎ "}{t}
        </div>
      ))}
      <div className="text-xs text-violet-400 font-bold mt-3 animate-pulse">이번 달 놓친 공제 34만원 발견!</div>
    </div>
  }
  if (demo === "alert") {
    return <div className="space-y-3">{[
      { label:"1분기 부가세 신고", date:"4월 25일", done:true },
      { label:"종합소득세 신고", date:"5월 31일", done:false },
      { label:"2분기 예정신고", date:"7월 25일", done:false },
    ].map(a => (
      <div key={a.label} className={`flex items-center justify-between text-xs px-3 py-2.5 rounded-lg ${a.done?"bg-white/[0.04] text-white/30":"bg-violet-500/15 text-violet-300"}`}>
        <span>{a.done?"✓ ":"🔔 "}{a.label}</span>
        <span className={a.done?"text-white/20":"text-violet-400 font-bold"}>{a.date}</span>
      </div>
    ))}</div>
  }
  if (demo === "ocr") {
    const ocrStep = tick%4
    return <div className="text-center space-y-3">
      <div className="w-16 h-20 rounded-lg border border-white/10 bg-white/[0.03] mx-auto flex items-center justify-center text-3xl">🧾</div>
      <div className="space-y-1.5">{["사진 인식 중...","텍스트 추출 중...","거래내역 등록 완료!","공제 항목 확인됨!"].map((s,i) => (
        <div key={s} className={`text-xs transition-all duration-500 ${ocrStep===i?"text-violet-400 font-bold":ocrStep>i?"text-white/30":"text-white/10"}`}>
          {ocrStep>i?"✓ ":ocrStep===i?"◎ ":""}{s}
        </div>
      ))}</div>
    </div>
  }
  if (demo === "forecast") {
    const progress = ((tick%10)+1)*10
    return <div className="space-y-3">
      <div className="flex justify-between text-xs text-white/40 mb-1"><span>이번 달 예상 세금</span><span className="text-violet-400 font-bold animate-pulse">계산 중...</span></div>
      <div className="text-2xl font-black">{(progress*3200).toLocaleString()}원</div>
      <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
        <div className="h-full rounded-full bg-violet-500 transition-all duration-700" style={{width:`${progress}%`}} />
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">{[["소득세","18만"],["4대보험","9만"],["부가세","5만"]].map(([l,v]) => (
        <div key={l} className="rounded-lg bg-white/[0.04] p-2"><div className="text-[10px] text-white/30">{l}</div><div className="text-xs font-bold text-white/70">{v}</div></div>
      ))}</div>
    </div>
  }
  return null
}

// ─── Upload Box States ────────────────────────────────────────────────────────

function UploadBox({ onComplete }: { onComplete: (results: TxResult[]) => void }) {
  const [phase, setPhase] = useState<"idle"|"uploading"|"analyzing">("idle")
  const [uploadPct, setUploadPct] = useState(0)
  const [analyzePct, setAnalyzePct] = useState(0)
  const [fileName, setFileName] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function startProcess(file: File) {
    setFileName(file.name)
    setPhase("uploading")
    setUploadPct(0)
    // 파일 읽기
    let transactions = []
    if (file.type.startsWith("image/")) {
      transactions = [{ description: file.name, amount: 0, date: new Date().toISOString().slice(0,10) }]
    } else {
      const text = await file.text()
      transactions = parseCSV(text)
      if (transactions.length === 0) {
        setError("거래내역을 찾을 수 없습니다.")
        setPhase("idle")
        return
      }
    }
    // 업로드 진행률
    let up = 0
    await new Promise(function(resolve) {
      const t = setInterval(function() {
        up += Math.floor(Math.random()*12)+5
        if (up >= 100) { setUploadPct(100); clearInterval(t); resolve(undefined) }
        else setUploadPct(up)
      }, 60)
    })
    await new Promise(function(r){ setTimeout(r, 400) })
    setPhase("analyzing")
    setAnalyzePct(0)
    let ap = 0
    const apTimer = setInterval(function() {
      ap += Math.floor(Math.random()*6)+2
      if (ap >= 90) { ap = 90; clearInterval(apTimer) }
      setAnalyzePct(ap)
    }, 100)
    try {
      const res = await fetch("/api/demo-classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactions }),
      })
      const data = await res.json()
      clearInterval(apTimer)
      setAnalyzePct(100)
      await new Promise(function(r){ setTimeout(r, 300) })
      if (data.upgradeRequired) { setError(data.message); setPhase("idle"); return }
      if (!data.success || !data.results || data.results.length === 0) {
        setError(data.message || "분석 결과가 없습니다.")
        setPhase("idle")
        return
      }
      onComplete(data.results)
    } catch(e) {
      clearInterval(apTimer)
      set했습니다.")
      setPhase("idle")
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) startProcess(f)
  }
  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) startProcess(f)
  }

  // ── Phase: idle ──
  if (phase === "idle") return (
    <div className="p-6">
      <div
        className={`rounded-xl border-2 border-dashed p-10 text-center cursor-pointer transition-all ${dragOver?"border-violet-400 bg-violet-500/10":"border-white/10 hover:border-white/20 hover:bg-white/[0.02]"}`}
        onDragOver={e=>{e.preventDefault();setDragOver(true)}}
        onDragLeave={()=>setDragOver(false)}
        onDrop={handleDrop}
        onClick={()=>fileRef.current?.click()}
      >
        <input ref={fileRef} type="file" accept=".csv,.xlsx,image/*" className="hidden" onChange={handleInput} />
        <div className="text-4xl mb-4">📂</div>
        <p className="font-semibold text-sm mb-1">파일을 드래그하거나 클릭</p>
        <p className="text-xs text-white/25">거래내역 CSV · 엑셀 · 영수증 사진</p>
      </div>
      <div className="mt-4 rounded-xl border border-white/[0.08] px-4 py-3 flex items-center justify-between" style={{background:"#111216"}}>
        <span className="text-sm text-white/50">분석 유형</span>
        <span className="text-sm font-semibold flex items-center gap-2">
          전체 공제 최적화
          <svg className="w-4 h-4 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
        </span>
      </div>
      <button onClick={()=>fileRef.current?.click()}
        className="mt-4 w-full py-4 rounded-xl font-bold text-base transition-all active:scale-95"
        style={{background:"#7c3aed"}}
        onMouseEnter={e=>(e.currentTarget.style.background="#6d28d9")}
        onMouseLeave={e=>(e.currentTarget.style.background="#7c3aed")}>
        파일 선택하기
      </button>
      <button onClick={()=>startProcess(new File([""],"sample_transactions.csv"))}
        className="mt-3 w-full text-xs text-white/25 hover:text-white/50 transition-colors py-2">
        파일 없이 샘플로 체험하기
      </button>
      <p className="text-center text-[11px] text-white/15 mt-2">파일을 올리면 이용약관에 동의하는 것으로 간주됩니다</p>
    </div>
  )

  // ── Phase: uploading ── (lalal.ai 스타일 진행률 바)
  if (phase === "uploading") return (
    <div className="p-8">
      <div className="mb-8">
        <p className="text-lg font-bold mb-1">업로드 중...</p>
        <p className="text-xs text-white/35">{fileName}</p>
      </div>
      <div className="relative h-12 rounded-xl overflow-hidden" style={{background:"#e5e7eb"}}>
        <div
          className="absolute inset-y-0 left-0 flex items-center justify-center transition-all duration-150"
          style={{width:`${uploadPct}%`, background:"#7c3aed", minWidth: uploadPct > 5 ? undefined : 0}}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold" style={{color: uploadPct > 50 ? "white" : "#111216"}}>{uploadPct}%</span>
        </div>
      </div>
      <button onClick={()=>{setPhase("idle");setUploadPct(0)}}
        className="mt-6 w-full text-sm text-white/30 hover:text-white/60 transition-colors py-2">
        취소
      </button>
      <p className="text-center text-[11px] text-white/15 mt-2">AI 처리 안내: 이 기능은 AI 기술을 사용합니다</p>
    </div>
  )

  // ── Phase: analyzing ── (로고 회전 + %)
  if (phase === "analyzing") return (
    <div className="p-8 text-center">
      <p className="text-lg font-bold mb-8">분석 중...</p>
      <div className="relative w-32 h-32 mx-auto mb-8">
        {/* 회전하는 로고 */}
        <div className="absolute inset-0 flex items-center justify-center"
          style={{animation:"spin 1.5s linear infinite"}}>
          <Image src="/logo.png" alt="미리택스" height={60} width={150}
            style={{objectFit:"contain", opacity:0.85}} />
        </div>
        {/* % 텍스트 */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-black text-white" style={{textShadow:"0 0 20px rgba(124,58,237,0.8)"}}>
            {analyzePct}%
          </span>
        </div>
        {/* 원형 테두리 */}
        <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 128 128">
          <circle cx="64" cy="64" r="58" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4"/>
          <circle cx="64" cy="64" r="58" fill="none" stroke="#7c3aed" strokeWidth="4"
            strokeDasharray={`${(analyzePct/100)*364.4} 364.4`}
            strokeLinecap="round" style={{transition:"stroke-dasharray 0.15s"}}/>
        </svg>
      </div>
      <button onClick={()=>{setPhase("idle");setAnalyzePct(0)}}
        className="text-sm text-white/30 hover:text-white/60 transition-colors py-2">
        취소
      </button>
      <p className="text-center text-[11px] text-white/15 mt-2">AI 처리 안내: 이 기능은 AI 기술을 사용합니다</p>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  return null
}

function ResultBox({ results, onReset, onDownload }: { results: TxResult[]; onReset: () => void; onDownload: () => void }) {
  const deductTotal = results.filter(r=>r.deductible).reduce((s,r)=>s+Math.abs(r.amount),0)
  const missedSaving = Math.round(deductTotal * 0.15)

  return (
    <div className="p-5">
      {/* 헤더 */}
      <div className="px-1 py-3 mb-4">
        <p className="text-lg font-black mb-1">분석 결과가 준비됐습니다!</p>
        <p className="text-xs text-white/35">총 {results.length}건 분류 완료</p>
      </div>

      {/* 요약 */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="rounded-xl p-4" style={{background:"#111216"}}>
          <p className="text-[11px] text-white/30 mb-1">공제 가능</p>
          <p className="text-xl font-black text-violet-400">{deductTotal.toLocaleString()}원</p>
        </div>
        <div className="rounded-xl p-4" style={{background:"#1e1530"}}>
          <p className="text-[11px] text-white/30 mb-1">예상 절세</p>
          <p className="text-xl font-black text-violet-300">{missedSaving.toLocaleString()}원</p>
        </div>
      </div>

      {/* 결과 리스트 */}
      <div className="rounded-xl overflow-hidden border border-white/[0.06] mb-4" style={{background:"#111216"}}>
        <div className="px-4 py-2 border-b border-white/[0.05] flex justify-between">
          <span className="text-[11px] text-white/35">분류 결과 {results.length}건</span>
          <span className="text-[11px] text-green-400">{results.filter(r=>r.deductible).length}건 공제가능</span>
        </div>
        <div className="max-h-52 overflow-y-auto divide-y divide-white/[0.04]">
          {results.map((r,i) => (
            <div key={i} className="px-4 py-3 flex items-center justify-between hover:bg-white/[0.02]">
              <div className="min-w-0 flex-1 pr-3">
                <p className="text-xs font-medium truncate">{r.desc}</p>
                <p className="text-[10px] text-white/25">{r.category} · {Math.round(r.confidence*100)}%</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xs font-semibold">{r.amount.toLocaleString()}원</p>
                <span className={`text-[10px] font-bold ${r.deductible?"text-violet-400":"text-white/20"}`}>
                  {r.deductible?"공제가능":"공제불가"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 전체 분석 버튼 (lalal.ai "Split in Full" 스타일) */}
      <button onClick={onDownload}
        className="w-full py-4 rounded-xl font-black text-base transition-all active:scale-95 mb-3"
        style={{background:"#7c3aed"}}
        onMouseEnter={e=>(e.currentTarget.style.background="#6d28d9")}
        onMouseLeave={e=>(e.currentTarget.style.background="#7c3aed")}>
        전체 결과 저장 및 다운로드 →
      </button>
      <button onClick={onReset} className="w-full text-xs text-white/25 hover:text-white/50 py-2 transition-colors">
        ← 다시 분석하기
      </button>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const [results, setResults] = useState<TxResult[] | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  return (
    <div className="min-h-screen text-white" style={{background:"#111216",fontFamily:"'Inter',-apple-system,sans-serif"}}>

      {/* Banner */}
      <div style={{background:"#7c3aed"}} className="text-white text-center py-2.5 px-4 text-xs sm:text-sm font-semibold">
        첫 달 50% 할인 이벤트 진행 중 &nbsp;·&nbsp;
        <Link href="/signup?plan=pro" className="underline underline-offset-2">지금 시작하기 →</Link>
      </div>

      {/* Nav */}
      <nav className="border-b border-white/[0.08] sticky top-0 z-50" style={{background:"rgba(17,18,22,0.95)",backdropFilter:"blur(20px)"}}>
        <div className="max-w-7xl mx-auto px-5 sm:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Logo size="md" />
            <div className="hidden md:flex items-center gap-6 text-sm text-white/50">
              <a href="#pain" className="hover:text-white transition-colors">해결 방법</a>
              <a href="#pricing" className="hover:text-white transition-colors">요금제</a>
              <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="hidden sm:block text-sm text-white/50 hover:text-white transition-colors">로그인</Link>
            <Link href="/signup" className="text-sm bg-white text-[#111216] font-bold px-4 py-2 rounded-lg hover:bg-white/90 transition-all">무료 시작</Link>
          </div>
        </div>
      </nav>

      {/* ── HERO 2-column ── */}
      <section className="max-w-7xl mx-auto px-5 sm:px-8 pt-16 pb-20">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-start">

          {/* Left */}
          <div className="pt-2">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.05] tracking-tight mb-6">
              거래내역 올리면<br />AI가 세금을<br />
              <span style={{background:"linear-gradient(90deg,#a78bfa,#60a5fa)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
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
              <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block"/>97% 정확도</span>
            </div>
          </div>

          {/* Right: Upload / Analyzing / Result Box */}
          <div className="rounded-2xl border border-white/[0.1] overflow-hidden" style={{background:"#1a1c22"}}>
            {/* Box header */}
            <div className="px-6 py-4 border-b border-white/[0.07] flex items-center justify-between">
              <div>
                <h2 className="font-bold text-base">
                  {results ? "분석 완료!" : "거래내역 분석하기"}
                </h2>
                <p className="text-xs text-white/30 mt-0.5">
                  {results ? `총 ${results.length}건 · 공제가능 ${results.filter(r=>r.deductible).length}건` : "CSV · 엑셀 · 영수증 사진 지원"}
                </p>
              </div>
              <div className="w-3 h-3 rounded-full" style={{background: results ? "#22c55e" : "#ef4444", opacity:0.7}} />
            </div>

            {results
              ? <ResultBox results={results} onReset={()=>setResults(null)} onDownload={()=>setShowModal(true)} />
              : <UploadBox onComplete={(r)=>setResults(r)} />
            }
          </div>
        </div>
      </section>

      {/* Pain Points */}
      <section id="pain" className="border-t border-white/[0.06] py-24 px-5 sm:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-black mb-4">이런 불편함, 미리택스가 해결합니다</h2>
            <p className="text-white/35 text-sm">직접 작동하는 모습을 확인해보세요</p>
          </div>
          <div className="space-y-5">
            {PAIN_POINTS.map(p => (
              <div key={p.no} className="grid md:grid-cols-2 gap-0 rounded-2xl border border-white/[0.07] overflow-hidden" style={{background:"#1a1c22"}}>
                <div className="p-8 flex flex-col justify-center">
                  <div className="text-xs font-bold text-violet-400/60 tracking-widest mb-4">{p.no}</div>
                  <h3 className="text-lg sm:text-xl font-bold mb-3 leading-snug text-white/85">{p.q}</h3>
                  <div className="flex items-center gap-2 text-sm text-violet-400 font-semibold">
                    <span className="w-4 h-4 rounded-full bg-violet-500/30 flex items-center justify-center text-[10px]">✓</span>
                    {p.solution}
                  </div>
                </div>
                <div className="p-8 border-t md:border-t-0 md:border-l border-white/[0.06]" style={{background:"#111216"}}>
                  <PainPointDemo demo={p.demo} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Compare */}
      <section className="py-24 px-5 sm:px-8">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-black text-center mb-12">삼쩜삼 vs 미리택스</h2>
          <div className="rounded-2xl overflow-hidden border border-white/[0.08]" style={{background:"#1a1c22"}}>
            <div className="grid grid-cols-3 px-6 py-4 border-b border-white/[0.06] text-sm font-semibold">
              <span className="text-white/30">기능</span>
              <span className="text-center text-white/30">삼쩜삼</span>
              <span className="text-center text-violet-400">미리택스</span>
            </div>
            {[["연간 세금 신고","✓","✓"],["매달 절세 코치","–","✓"],["거래내역 자동 분류","–","✓"],["놓친 공제 감지","–","✓"],["사진 OCR","–","✓"],["세금 예측","–","✓"],["이용 방식","연 1회","월 구독"]].map(([f,a,b],i) => (
              <div key={i} className="grid grid-cols-3 px-6 py-4 border-t border-white/[0.05] text-sm hover:bg-white/[0.02]">
                <span className="text-white/55">{f}</span>
                <span className="text-center text-white/20">{a}</span>
                <span className="text-center font-semibold text-violet-400">{b}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 px-5 sm:px-8 border-t border-white/[0.06]">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-black text-center mb-3">요금제</h2>
          <p className="text-center text-white/35 text-sm mb-12">첫 달 50% 할인 · 언제든 해지</p>
          <div className="grid sm:grid-cols-3 gap-5">
            {[
              {name:"Starter",price:"0",unit:"원",sub:"항상 무료",features:["월 5회 분류","기본 세금 계산","이메일 알림"],cta:"무료로 시작",href:"/signup",hi:false},
              {name:"Pro",price:"39,000",unit:"원/월",sub:"첫 달 19,500원",features:["무제한 분류","AI 공제 최적화","사진 OCR","분기 알림","주간 리포트"],cta:"카드로 시작",href:"/signup?plan=pro",hi:true},
              {name:"Business",price:"89,000",unit:"원/월",sub:"첫 달 44,500원",features:["Pro 전체","세무사 연동","PDF 신고서","팀원 초대","우선 지원"],cta:"카드로 시작",href:"/signup?plan=business",hi:false},
            ].map(p => (
              <div key={p.name} className={`rounded-2xl p-7 border flex flex-col ${p.hi?"border-violet-500/40":"border-white/[0.07]"}`}
                style={{background:p.hi?"#1e1530":"#1a1c22"}}>
                {p.hi && <div className="text-[10px] font-bold text-violet-400 mb-4 tracking-widest uppercase">Best Value</div>}
                <div className="font-bold mb-1 text-white/80">{p.name}</div>
                <div className="text-3xl font-black mb-1">{p.price}<span className="text-sm font-normal text-white/25">{p.unit}</span></div>
                <div className={`text-xs font-semibold mb-6 ${p.hi?"text-violet-400":"text-white/25"}`}>{p.sub}</div>
                <ul className="space-y-2.5 mb-7 flex-1">
                  {p.features.map(f => (
                    <li key={f} className="flex items-center gap-2.5 text-xs text-white/45">
                      <span className={p.hi?"text-violet-400":"text-white/20"}>✓</span>{f}
                    </li>
                  ))}
                </ul>
                <Link href={p.href} className="block text-center py-3 rounded-xl font-bold text-sm transition-all active:scale-95"
                  style={{background:p.hi?"#7c3aed":"rgba(255,255,255,0.06)",color:p.hi?"white":"rgba(255,255,255,0.4)"}}>
                  {p.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-24 px-5 sm:px-8 border-t border-white/[0.06]">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-black text-center mb-12">FAQ</h2>
          <div className="space-y-0">
            {FAQ_ITEMS.map((item,i) => (
              <div key={i} className="border-b border-white/[0.07]">
                <button className="w-full flex items-center justify-between py-5 text-left" onClick={()=>setOpenFaq(openFaq===i?null:i)}>
                  <span className="text-sm sm:text-base font-medium text-white/65">{item.q}</span>
                  <svg className={`w-5 h-5 flex-shrink-0 ml-4 text-white/25 transition-transform ${openFaq===i?"rotate-180":""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
                  </svg>
                </button>
                {openFaq===i && <div className="pb-5 text-sm text-white/35 leading-relaxed">{item.a}</div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-24 px-5 sm:px-8 border-t border-white/[0.06]">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-3xl sm:text-4xl font-black mb-4">지금 바로 분석해보세요</h2>
            <p className="text-white/35 leading-relaxed">거래내역을 올리고 AI가 찾아주는<br/>놓친 공제를 직접 확인하세요.</p>
          </div>
          <div className="rounded-2xl border border-white/[0.08] p-6" style={{background:"#1a1c22"}}>
            <p className="font-bold mb-4 text-sm">거래내역 분석하기</p>
            <button onClick={()=>window.scrollTo({top:0,behavior:"smooth"})}
              className="w-full py-4 rounded-xl font-bold text-base transition-all active:scale-95"
              style={{background:"#7c3aed"}}
              onMouseEnter={e=>(e.currentTarget.style.background="#6d28d9")}
              onMouseLeave={e=>(e.currentTarget.style.background="#7c3aed")}>
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
              <Logo size="sm" gray />
              <p className="text-xs text-white/20 leading-relaxed mt-3">한국 크리에이터·1인사업자를 위한 AI 세금 코치</p>
            </div>
            {[
              {title:"서비스", links:[["대시보드","/dashboard"],["거래내역 업로드","/upload"],["AI 최적화","/optimize"]]},
              {title:"회사", links:[["소개","#"],["FAQ","#faq"],["이용약관","#"]]},
              {title:"요금제", links:[["Starter","/signup"],["Pro","/signup?plan=pro"],["Business","/signup?plan=business"]]},
            ].map(col => (
              <div key={col.title}>
                <p className="text-xs font-semibold text-white/40 mb-3 uppercase tracking-wider">{col.title}</p>
                <ul className="space-y-2">{col.links.map(([label,href]) => (
                  <li key={label}><Link href={href} className="text-xs text-white/25 hover:text-white/50">{label}</Link></li>
                ))}</ul>
              </div>
            ))}
          </div>
          <div className="border-t border-white/[0.05] pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-white/15">© 2026 미리택스. All rights reserved.</p>
            <p className="text-xs text-white/10 text-center">본 서비스는 참고용 AI 코치입니다. 실제 신고는 공인 세무사와 상담하세요.</p>
          </div>
        </div>
      </footer>

      {/* 회원가입 유도 Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6"
          style={{background:"rgba(0,0,0,0.85)",backdropFilter:"blur(12px)"}}
          onClick={()=>setShowModal(false)}>
          <div className="rounded-t-3xl sm:rounded-2xl border border-white/10 p-8 sm:p-10 w-full sm:max-w-md"
            style={{background:"#1a1c22"}}
            onClick={e=>e.stopPropagation()}>
            <div className="w-8 h-1 rounded-full mx-auto mb-8 sm:hidden bg-white/10" />
            <div className="text-[10px] font-bold text-violet-400 tracking-widest uppercase mb-4">30초 회원가입</div>
            <h3 className="text-2xl font-black mb-3">결과를 저장하려면<br/>회원가입이 필요합니다</h3>
            <p className="text-white/35 text-sm mb-8 leading-relaxed">
              내 실제 거래내역으로 무제한 분석하고<br/>매달 절세 리포트를 받아보세요.<br/>
              <span className="text-violet-400 font-semibold">첫 달 19,500원 · 언제든 해지 가능</span>
            </p>
            <div className="flex flex-col gap-3">
              <Link href="/signup?plan=pro"
                className="block text-center py-4 rounded-xl font-bold text-sm transition-all active:scale-95"
                style={{background:"#7c3aed",color:"white"}}>
                첫 달 50% 할인으로 시작 →
              </Link>
              <Link href="/signup"
                className="block text-center py-3.5 rounded-xl font-semibold text-sm border border-white/10 text-white/40 hover:text-white hover:border-white/20 transition-all">
                무료로 시작
              </Link>
              <button onClick={()=>setShowModal(false)} className="text-xs text-white/20 hover:text-white/40 transition-colors py-2">나중에</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
