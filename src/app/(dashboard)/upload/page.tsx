import { Metadata } from 'next'
import { CsvDropzone } from '@/components/upload/csv-dropzone'
import { DisclaimerBanner } from '@/components/shared/disclaimer-banner'
import {
  ExternalLink,
  ChevronRight,
  MonitorDown,
  Globe,
  Smartphone,
} from 'lucide-react'

export const metadata: Metadata = {
  title: '거래 내역 업로드 — TaxFlow AI',
  description: '은행 CSV 파일을 업로드하면 AI가 자동으로 세금 분류합니다',
}

// ─── Per-bank export guide ────────────────────────────────────────────────────

interface BankGuide {
  name: string
  shortName: string
  color: string
  encoding: 'EUC-KR' | 'UTF-8'
  channel: 'PC' | 'Mobile' | 'PC/Mobile'
  steps: string[]
  url: string
  note?: string
}

const BANK_GUIDES: BankGuide[] = [
  {
    name: 'KB국민은행',
    shortName: 'KB국민',
    color: 'bg-yellow-400',
    encoding: 'EUC-KR',
    channel: 'PC',
    steps: [
      'KB스타뱅킹 PC 접속 → 로그인',
      '조회 → 거래내역 조회',
      '조회 기간 설정 후 검색',
      '엑셀저장 버튼 클릭 → CSV 선택',
    ],
    url: 'https://obank.kbstar.com',
  },
  {
    name: '신한은행',
    shortName: '신한',
    color: 'bg-blue-500',
    encoding: 'UTF-8',
    channel: 'PC/Mobile',
    steps: [
      '신한 SOL뱅크 앱 또는 PC 접속',
      '계좌 선택 → 거래내역',
      '기간 설정 → 내보내기(CSV)',
      '파일 저장 후 업로드',
    ],
    url: 'https://www.shinhan.com',
  },
  {
    name: '우리은행',
    shortName: '우리',
    color: 'bg-sky-500',
    encoding: 'EUC-KR',
    channel: 'PC',
    steps: [
      '우리WON뱅킹 PC 접속',
      '조회/이체 → 입출금내역',
      '기간 선택 후 조회',
      '다운로드 → CSV 저장',
    ],
    url: 'https://www.wooribank.com',
  },
  {
    name: '하나은행',
    shortName: '하나',
    color: 'bg-green-500',
    encoding: 'UTF-8',
    channel: 'PC',
    steps: [
      '하나원큐 PC 뱅킹 접속',
      '계좌 → 거래내역 조회',
      '날짜 범위 설정',
      'CSV 다운로드',
    ],
    url: 'https://www.kebhana.com',
  },
  {
    name: 'IBK기업은행',
    shortName: 'IBK기업',
    color: 'bg-slate-600',
    encoding: 'EUC-KR',
    channel: 'PC',
    steps: [
      'IBK기업은행 인터넷뱅킹 접속',
      '조회 → 입출금내역',
      '기간 조회 후 엑셀/CSV 저장',
    ],
    url: 'https://www.ibk.co.kr',
  },
  {
    name: 'NH농협은행',
    shortName: 'NH농협',
    color: 'bg-emerald-500',
    encoding: 'EUC-KR',
    channel: 'PC',
    steps: [
      'NH스마트뱅킹 PC 접속',
      '조회 → 입출금거래내역',
      '기간 설정 후 엑셀 저장',
    ],
    url: 'https://banking.nonghyup.com',
  },
  {
    name: '카카오뱅크',
    shortName: '카카오뱅크',
    color: 'bg-yellow-300',
    encoding: 'UTF-8',
    channel: 'Mobile',
    steps: [
      '카카오뱅크 앱 실행',
      '계좌 탭 → 거래내역',
      '우측 상단 다운로드 아이콘',
      'CSV 파일로 저장',
    ],
    url: 'https://www.kakaobank.com',
    note: '앱에서만 CSV 내보내기 가능',
  },
  {
    name: '토스뱅크',
    shortName: '토스뱅크',
    color: 'bg-blue-400',
    encoding: 'UTF-8',
    channel: 'Mobile',
    steps: [
      '토스 앱 실행',
      '토스뱅크 계좌 선택',
      '거래내역 → 내보내기',
      'CSV로 내보내기',
    ],
    url: 'https://www.tossbank.com',
    note: '앱에서만 CSV 내보내기 가능',
  },
]

const CHANNEL_ICONS = {
  PC: MonitorDown,
  Mobile: Smartphone,
  'PC/Mobile': Globe,
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function UploadPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">거래 내역 업로드</h1>
        <p className="mt-1 text-sm text-slate-500">
          은행 CSV 파일을 업로드하면 Claude AI가 세금 항목을 자동 분류합니다
        </p>
      </div>

      {/* ── Dropzone ───────────────────────────────────────────────────────── */}
      <CsvDropzone />

      {/* ── Disclaimer ─────────────────────────────────────────────────────── */}
      <DisclaimerBanner />

      {/* ── Bank export guide ──────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-4 text-base font-semibold text-slate-800">
          은행별 CSV 내보내기 방법
        </h2>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {BANK_GUIDES.map((bank) => {
            const ChannelIcon = CHANNEL_ICONS[bank.channel]
            return (
              <div
                key={bank.name}
                className="group rounded-xl border border-slate-200 bg-white p-4 transition-shadow hover:shadow-sm"
              >
                {/* Bank header */}
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className={`h-2.5 w-2.5 rounded-full ${bank.color}`} />
                    <span className="text-sm font-semibold text-slate-800">
                      {bank.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        bank.encoding === 'EUC-KR'
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {bank.encoding}
                    </span>
                    <span className="flex items-center gap-0.5 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                      <ChannelIcon className="h-2.5 w-2.5" />
                      {bank.channel}
                    </span>
                  </div>
                </div>

                {/* Steps */}
                <ol className="space-y-1">
                  {bank.steps.map((step, i) => (
                    <li key={i} className="flex gap-2 text-xs text-slate-600">
                      <span className="shrink-0 font-medium text-slate-400">
                        {i + 1}.
                      </span>
                      {step}
                    </li>
                  ))}
                </ol>

                {bank.note && (
                  <p className="mt-2 text-[11px] text-amber-600">
                    ⚠ {bank.note}
                  </p>
                )}

                {/* Link */}
                <a
                  href={bank.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 flex items-center gap-1 text-[11px] text-blue-500 opacity-0 transition-opacity group-hover:opacity-100"
                >
                  {bank.shortName} 바로가기
                  <ExternalLink className="h-2.5 w-2.5" />
                </a>
              </div>
            )
          })}
        </div>
      </section>

      {/* ── Tips ───────────────────────────────────────────────────────────── */}
      <section className="rounded-xl border border-blue-100 bg-blue-50 p-5">
        <h3 className="mb-3 text-sm font-semibold text-blue-800">업로드 팁</h3>
        <ul className="space-y-2">
          {[
            '최소 1개월 이상의 거래 내역을 업로드하면 더 정확한 세금 분석이 가능합니다',
            'KB국민, 우리, 농협, 기업은행은 EUC-KR 인코딩으로 자동 변환됩니다',
            '같은 거래 내역을 다시 업로드해도 중복 처리되지 않습니다 (SHA-256 해시 비교)',
            '최대 10MB까지 업로드 가능합니다 (약 50,000건)',
          ].map((tip, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-blue-700">
              <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-400" />
              {tip}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
