"use client"
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
