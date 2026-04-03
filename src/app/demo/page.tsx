/**
 * @file src/app/demo/page.tsx
 * @description TaxFlow AI — 체험 페이지 (인증 불필요)
 */
'use client'
import { useState, useRef } from 'react'
import Link from 'next/link'

type Step = 'upload'|'analyzing'|'result'
const SAMPLE = {
  classified:23, deductibleCount:14, missedCount:5, missedAmount:872000, riskScore:62,
  items:[
    { description:'Adobe Creative Cloud', amount:68000,  category:'소프트웨어 구독',    deductible:true  },
    { description:'스타벅스 강남점',        amount:15000,  category:'접대비 (한도 검토)',  deductible:true  },
    { description:'쿠팡 로켓배송',          amount:125000, category:'소모품비 (검토 필요)', deductible:false },
    { description:'YouTube Premium',      amount:14900,  category:'콘텐츠 제작비',       deductible:true  },
    { description:'이마트24',             amount:8500,   category:'식비 (사적 용도)',     deductible:false },
  ],
}

export default function DemoPage() {
  const [step, setStep] = useState<Step>('upload')
  const [result, setResult] = useState<typeof SAMPLE|null>(null)
  const [modal, setModal] = useState(false)
  const [drag, setDrag] = useState(false)
  const [label, setLabel] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function start(lbl: string) {
    setLabel(lbl); setStep('analyzing')
    await new Promise(r => setTimeout(r, 1400))
    setResult(SAMPLE); setStep('result')
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 px-4 py-4 flex items-center justify-between sticky top-0 bg-gray-950/95 backdrop-blur z-20">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-sm">T</div>
          <span className="font-bold text-sm">TaxFlow AI</span>
        </Link>
        <div className="flex items-center gap-2">
          <Link href="/login" className="text-sm text-gray-400 hover:text-white">로그인</Link>
          <Link href="/signup" className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold hover:bg-blue-500 transition-colors">무료 가입</Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 sm:py-14">
        {step === 'upload' && (
          <>
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs text-blue-400 mb-4">회원가입 없이 무료 체험</div>
              <h1 className="text-2xl sm:text-3xl font-bold mb-3">30초 만에 공제 항목 확인</h1>
              <p className="text-gray-400 text-sm">은행 거래내역 CSV 또는 영수증 사진을 올리면 AI가 즉시 분석합니다.</p>
            </div>
            <div onDrop={e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) start(f.name) }}
              onDragOver={e => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)}
              onClick={() => fileRef.current?.click()}
              className={`rounded-2xl border-2 border-dashed p-10 text-center cursor-pointer transition-all ${drag ? 'border-blue-500 bg-blue-950/40' : 'border-gray-700 hover:border-gray-500'}`}>
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.jpg,.jpeg,.png,.heic,.webp" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) start(f.name) }} />
              <div className="text-5xl mb-4">📤</div>
              <p className="font-semibold mb-1">파일을 드래그하거나 클릭하세요</p>
              <p className="text-gray-500 text-sm">CSV, Excel, 영수증 사진 지원</p>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-4">
              {[{ icon:'📊', t:'은행 CSV', d:'거래내역 파일' }, { icon:'📷', t:'영수증 사진', d:'OCR 자동 분석' }].map(b => (
                <button key={b.t} onClick={() => fileRef.current?.click()}
                  className="rounded-xl border border-gray-700 bg-gray-900 p-4 text-left hover:border-gray-500 transition-colors">
                  <div className="text-2xl mb-1.5">{b.icon}</div>
                  <p className="font-semibold text-sm">{b.t}</p>
                  <p className="text-gray-500 text-xs mt-0.5">{b.d}</p>
                </button>
              ))}
            </div>
            <div className="mt-6 text-center">
              <p className="text-gray-500 text-sm mb-3">파일이 없으신가요?</p>
              <button onClick={() => start('sample_data.csv')}
                className="rounded-lg bg-gray-800 border border-gray-700 px-6 py-2.5 text-sm font-semibold hover:bg-gray-700 transition-colors">
                샘플 데이터로 체험하기
              </button>
            </div>
          </>
        )}

        {step === 'analyzing' && (
          <div className="text-center py-20">
            <div className="text-6xl mb-6 animate-pulse">🤖</div>
            <h2 className="text-xl font-bold mb-3">AI가 분석 중입니다...</h2>
            <p className="text-gray-400 text-sm mb-6">{label}</p>
            <div className="flex justify-center gap-1.5">
              {[0,1,2].map(i => <div key={i} className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay:`${i*0.15}s` }} />)}
            </div>
          </div>
        )}

        {step === 'result' && result && (
          <div>
            <div className="rounded-2xl bg-gradient-to-r from-red-950/80 to-orange-950/60 border border-red-800/50 p-5 mb-5">
              <p className="text-lg font-bold text-white mb-1">⚠️ 이번 달 놓친 공제 약 <span className="text-yellow-300">{result.missedAmount.toLocaleString()}원</span></p>
              <p className="text-red-200 text-sm mb-3">{result.missedCount}건의 거래에서 공제 항목을 놓치고 있을 가능성이 있습니다. (참고용)</p>
              <button onClick={() => setModal(true)} className="rounded-lg bg-blue-600 hover:bg-blue-500 px-4 py-2 text-sm font-bold text-white transition-colors">
                Pro에서 실시간 알림 받기 (첫 달 19,500원) →
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-5">
              {[{ l:'분류 완료', v:`${result.classified}건`, c:'text-blue-400' },
                { l:'공제 가능', v:`${result.deductibleCount}건`, c:'text-green-400' },
                { l:'위험도',    v:`${result.riskScore}점`, c:result.riskScore>=60?'text-red-400':'text-yellow-400' }].map(s => (
                <div key={s.l} className="rounded-xl border border-gray-700 bg-gray-900 p-4 text-center">
                  <p className={`text-2xl font-bold ${s.c}`}>{s.v}</p>
                  <p className="text-xs text-gray-400 mt-1">{s.l}</p>
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-gray-700 bg-gray-900 p-5 mb-5">
              <h3 className="font-bold text-sm text-gray-300 mb-4">분석 결과 미리보기</h3>
              <div className="space-y-3">
                {result.items.map((item, i) => (
                  <div key={i} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{item.description}</p>
                      <p className="text-xs text-gray-500">{item.category}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold">{item.amount.toLocaleString()}원</p>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${item.deductible ? 'bg-green-900/50 text-green-400' : 'bg-gray-800 text-gray-500'}`}>
                        {item.deductible ? '공제 가능' : '검토 필요'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 relative">
                <div className="opacity-30 blur-sm space-y-3 select-none pointer-events-none">
                  {['네이버 광고비','Adobe Stock','노션 구독'].map(t => (
                    <div key={t} className="flex justify-between text-xs"><span>{t}</span><span>●●,●●●원</span></div>
                  ))}
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <button onClick={() => setModal(true)} className="rounded-lg bg-blue-600 hover:bg-blue-500 px-4 py-2 text-sm font-bold text-white shadow-lg">
                    🔓 전체 결과 보기 (회원가입 필요)
                  </button>
                </div>
              </div>
            </div>
            <button onClick={() => setModal(true)} className="w-full rounded-xl bg-blue-600 hover:bg-blue-500 py-4 font-bold text-lg text-white transition-colors mb-2">
              📥 분석 결과 저장하기
            </button>
            <p className="text-center text-xs text-gray-500 mb-4">저장하려면 무료 회원가입이 필요합니다</p>
            <p className="text-center text-xs text-gray-600">※ 샘플 데이터 기반 참고용. 실제 금액은 다를 수 있습니다.</p>
          </div>
        )}
      </main>

      {modal && (
        <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 px-4 pb-4 sm:pb-0"
          onClick={e => { if (e.target === e.currentTarget) setModal(false) }}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md p-6 sm:p-8">
            <div className="text-center mb-5">
              <div className="text-4xl mb-3">⚠️</div>
              <h3 className="text-xl font-bold text-white mb-2">공제 기회를 놓치고 계십니다</h3>
              <p className="text-gray-400 text-sm leading-relaxed">Pro 사용자들은 실시간으로 놓친 공제를 카카오톡으로 받고 있습니다. 지금 업그레이드하면 <strong className="text-white">첫 달 19,500원</strong>에 이용 가능합니다.</p>
            </div>
            <ul className="space-y-2 mb-5">
              {['무제한 AI 거래 분류','실시간 카카오 절세 알림','홈택스 신고 파일 자동 생성','영수증 OCR + 증빙 저장소'].map(f => (
                <li key={f} className="flex items-center gap-2 text-sm text-gray-200"><span className="text-blue-400">⚡</span>{f}</li>
              ))}
            </ul>
            <Link href="/signup?plan=pro&ref=demo" className="block w-full rounded-xl bg-blue-600 hover:bg-blue-500 py-3.5 text-center font-bold text-white transition-colors mb-3">
              Pro 19,500원으로 시작하기 (첫 달)
            </Link>
            <Link href="/signup?ref=demo" className="block w-full rounded-xl border border-gray-600 py-3 text-center text-sm text-gray-300 hover:bg-gray-800 transition-colors mb-3">
              무료로 가입하기 (월 5회 제한)
            </Link>
            <button onClick={() => setModal(false)} className="block w-full text-xs text-gray-500 hover:text-gray-400 text-center py-2">나중에 하기</button>
          </div>
        </div>
      )}
    </div>
  )
}
