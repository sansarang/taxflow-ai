import Link from 'next/link'
import {
  Upload, Sparkles, FileDown, CheckCircle, Shield, AlertTriangle,
  ChevronRight, Star, Clock, Wallet, TrendingUp, Camera, Monitor,
  Building2, HelpCircle,
} from 'lucide-react'

// ─── Section: Hero ────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="relative overflow-hidden bg-slate-950 px-4 py-20 text-center lg:py-28">
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-blue-600/20 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 h-64 w-64 rounded-full bg-purple-600/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-3xl">
        {/* Badge */}
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-1.5 text-sm text-blue-300">
          <Sparkles className="h-3.5 w-3.5" />
          Claude AI 기반 · 크리에이터 특화
        </div>

        <h1 className="mb-5 text-4xl font-extrabold leading-tight tracking-tight text-white lg:text-5xl">
          크리에이터를 위한
          <br />
          <span className="text-blue-400">실시간 세금 AI 코치</span>
        </h1>

        <p className="mx-auto mb-8 max-w-xl text-base leading-relaxed text-slate-400 lg:text-lg">
          은행 CSV 업로드 하나로 절세 기회 발견 + 홈택스 신고 파일 자동 생성.
          <br className="hidden sm:block" />
          유튜버·프리랜서·1인사업자 맞춤 세금 분류와 공제 코칭.
        </p>

        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-900/30 transition hover:bg-blue-500"
          >
            무료로 시작하기 <ChevronRight className="h-4 w-4" />
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-6 py-3 text-sm font-medium text-slate-300 transition hover:border-slate-500 hover:text-white"
          >
            로그인
          </Link>
        </div>

        {/* Social proof */}
        <p className="mt-6 text-xs text-slate-500">
          신용카드·체크카드 거래내역도 자동 분류 · 8개 주요 은행 지원
        </p>
      </div>
    </section>
  )
}

// ─── Section: Pain points ─────────────────────────────────────────────────────

const PAINS = [
  {
    icon: Clock,
    title: '세금 신고 시즌 스트레스',
    body: '매년 5월이면 한 해 거래내역을 처음부터 정리하느라 수십 시간을 낭비합니다.',
    color: 'text-red-500',
    bg: 'bg-red-50',
  },
  {
    icon: Wallet,
    title: '공제 항목 놓침',
    body: '카메라·Adobe CC·스튜디오 비용 등 크리에이터 특화 공제를 모르면 수십만 원이 날아갑니다.',
    color: 'text-amber-500',
    bg: 'bg-amber-50',
  },
  {
    icon: Building2,
    title: '세무사 비용 부담',
    body: '세무사 기장료 월 10~20만원은 수익이 불안정한 1인 사업자에게 큰 고정비입니다.',
    color: 'text-purple-500',
    bg: 'bg-purple-50',
  },
]

function PainPoints() {
  return (
    <section className="bg-slate-50 px-4 py-16 lg:py-20">
      <div className="mx-auto max-w-4xl">
        <p className="mb-2 text-center text-sm font-semibold uppercase tracking-widest text-slate-400">
          크리에이터의 세금 고민
        </p>
        <h2 className="mb-10 text-center text-2xl font-bold text-slate-900 lg:text-3xl">
          이런 어려움을 겪고 계신가요?
        </h2>
        <div className="grid gap-5 sm:grid-cols-3">
          {PAINS.map((p) => {
            const Icon = p.icon
            return (
              <div key={p.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl ${p.bg}`}>
                  <Icon className={`h-5 w-5 ${p.color}`} />
                </div>
                <h3 className="mb-2 text-base font-semibold text-slate-800">{p.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{p.body}</p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

// ─── Section: How it works ────────────────────────────────────────────────────

const STEPS = [
  { n: '01', icon: Upload,    title: 'CSV 업로드',                   body: '은행 앱에서 거래내역을 CSV로 내보내 업로드하세요. KB국민·신한·우리·하나 등 8개 은행 지원.' },
  { n: '02', icon: Sparkles,  title: 'AI 자동 분류',                 body: 'Claude AI가 크리에이터 업종 특화 공제 규칙으로 거래를 자동 분류하고 절세 기회를 찾아냅니다.' },
  { n: '03', icon: FileDown,  title: '절세 알림 + 홈택스 파일 생성', body: '공제 누락 알림을 받고, 클릭 한 번으로 홈택스에 업로드할 CSV·XML·PDF를 생성하세요.' },
]

function HowItWorks() {
  return (
    <section className="bg-white px-4 py-16 lg:py-20">
      <div className="mx-auto max-w-4xl">
        <p className="mb-2 text-center text-sm font-semibold uppercase tracking-widest text-slate-400">
          사용 방법
        </p>
        <h2 className="mb-12 text-center text-2xl font-bold text-slate-900 lg:text-3xl">
          3단계로 끝나는 세금 관리
        </h2>
        <div className="grid gap-6 sm:grid-cols-3">
          {STEPS.map((s, i) => {
            const Icon = s.icon
            return (
              <div key={s.n} className="relative flex flex-col items-start">
                {/* Connector line */}
                {i < STEPS.length - 1 && (
                  <div className="absolute left-full top-5 hidden h-px w-6 bg-slate-200 sm:block" />
                )}
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 shadow-lg shadow-blue-200">
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <span className="mb-1 text-xs font-mono font-semibold text-slate-400">{s.n}</span>
                <h3 className="mb-2 text-base font-semibold text-slate-800">{s.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{s.body}</p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

// ─── Section: Creator features ────────────────────────────────────────────────

const FEATURES = [
  { icon: Camera,    title: '장비비 100% 공제', body: '카메라·조명·마이크·드론 등 업무용 장비 구입비 전액 경비 처리 안내' },
  { icon: Monitor,   title: '소프트웨어 구독',  body: 'Adobe CC·Final Cut·CapCut Pro 등 편집 소프트웨어 구독료 전액 공제' },
  { icon: Building2, title: '스튜디오 비용',    body: '촬영 스튜디오 임차료·소품·배경지 사업 목적 사용 시 100% 공제' },
  { icon: TrendingUp, title: '외주비 원천징수', body: '편집자·썸네일 디자이너 외주비 지급 시 원천징수 처리 자동 안내' },
]

function CreatorFeatures() {
  return (
    <section className="bg-slate-950 px-4 py-16 lg:py-20">
      <div className="mx-auto max-w-4xl">
        <p className="mb-2 text-center text-sm font-semibold uppercase tracking-widest text-blue-400">
          크리에이터 특화
        </p>
        <h2 className="mb-10 text-center text-2xl font-bold text-white lg:text-3xl">
          유튜버·크리에이터만을 위한 공제 코칭
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => {
            const Icon = f.icon
            return (
              <div key={f.title} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600/20">
                  <Icon className="h-4.5 w-4.5 text-blue-400" />
                </div>
                <h3 className="mb-1.5 text-sm font-semibold text-white">{f.title}</h3>
                <p className="text-xs text-slate-400 leading-relaxed">{f.body}</p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

// ─── Section: Pricing ─────────────────────────────────────────────────────────

const PLANS = [
  {
    name: 'Free',
    price: '무료',
    period: '',
    description: '시작하는 크리에이터',
    features: [
      'AI 거래 분류 월 5건',
      '홈택스 CSV 내보내기',
      '세금 신고 마감 알림',
      '기본 위험도 분석',
    ],
    cta: '무료로 시작',
    href: '/signup',
    highlight: false,
  },
  {
    name: 'Pro',
    price: '₩39,000',
    period: '/월',
    description: '수익이 생긴 크리에이터',
    features: [
      'AI 거래 분류 무제한',
      'XML·PDF 신고서 생성',
      '주간 최적화 리포트',
      '실시간 절세 알림 (이메일)',
      '부가세 자동 계산',
      '패턴 학습으로 정확도 향상',
    ],
    cta: 'Pro 시작하기',
    href: '/signup?plan=pro',
    highlight: true,
  },
  {
    name: 'Business',
    price: '₩79,000',
    period: '/월',
    description: '사업 규모가 큰 1인사업자',
    features: [
      'Pro 모든 기능 포함',
      '카카오 알림톡',
      '세무사 파트너 매칭',
      '종합소득세 자동 계산',
      '전용 API 접근',
      '우선 고객 지원',
    ],
    cta: 'Business 시작',
    href: '/signup?plan=business',
    highlight: false,
  },
]

function Pricing() {
  return (
    <section className="bg-slate-50 px-4 py-16 lg:py-20">
      <div className="mx-auto max-w-4xl">
        <p className="mb-2 text-center text-sm font-semibold uppercase tracking-widest text-slate-400">
          요금제
        </p>
        <h2 className="mb-2 text-center text-2xl font-bold text-slate-900 lg:text-3xl">
          규모에 맞게 시작하세요
        </h2>
        <p className="mb-10 text-center text-sm text-slate-500">언제든지 업그레이드·다운그레이드 가능</p>
        <div className="grid gap-5 sm:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-2xl border p-6 ${
                plan.highlight
                  ? 'border-blue-600 bg-blue-600 text-white shadow-xl shadow-blue-200'
                  : 'border-slate-200 bg-white'
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-amber-400 px-3 py-0.5 text-xs font-bold text-amber-900">
                  ⭐ 가장 인기
                </div>
              )}
              <p className={`mb-1 text-sm font-semibold ${plan.highlight ? 'text-blue-100' : 'text-slate-500'}`}>
                {plan.name}
              </p>
              <div className="mb-1 flex items-baseline gap-1">
                <span className={`text-3xl font-extrabold ${plan.highlight ? 'text-white' : 'text-slate-900'}`}>
                  {plan.price}
                </span>
                {plan.period && (
                  <span className={`text-sm ${plan.highlight ? 'text-blue-200' : 'text-slate-400'}`}>
                    {plan.period}
                  </span>
                )}
              </div>
              <p className={`mb-5 text-xs ${plan.highlight ? 'text-blue-200' : 'text-slate-400'}`}>
                {plan.description}
              </p>
              <ul className="mb-6 space-y-2">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <CheckCircle className={`mt-0.5 h-3.5 w-3.5 flex-shrink-0 ${
                      plan.highlight ? 'text-blue-200' : 'text-green-500'
                    }`} />
                    <span className={plan.highlight ? 'text-blue-50' : 'text-slate-600'}>{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                href={plan.href}
                className={`block w-full rounded-xl py-2.5 text-center text-sm font-semibold transition ${
                  plan.highlight
                    ? 'bg-white text-blue-700 hover:bg-blue-50'
                    : 'bg-slate-900 text-white hover:bg-slate-800'
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Section: FAQ ─────────────────────────────────────────────────────────────

const FAQS = [
  {
    q: '유튜버 수익에 부가가치세를 내야 하나요?',
    a: '유튜브 광고 수익(구글로부터 받는 수익)은 영세율 또는 면세 적용 대상이 많아 부가세 납부 의무가 다를 수 있습니다. 다만 국내 기업 협찬·PPL 수익은 과세 대상입니다. 정확한 판단은 세무사 확인이 필요합니다.',
  },
  {
    q: '크리에이터 장비 구입비(카메라, 조명 등)는 전액 경비 처리 가능한가요?',
    a: '업무 목적 사용을 입증할 수 있다면 원칙적으로 전액 경비 처리가 가능합니다. 단, 사적 용도와 혼용 시 실제 업무 사용 비율만큼만 인정되므로 구매 목적 증빙(영수증, 사업 연관성)을 잘 보관하세요.',
  },
  {
    q: '간이과세자와 일반과세자는 어떻게 다른가요?',
    a: '연 매출 1억 400만 원 미만이면 간이과세자를 선택할 수 있으며, 부가세율이 4%로 낮아집니다. 대신 매입세액 공제가 제한됩니다. 매입 비용이 많은 경우 일반과세자가 유리할 수 있으니 세무사와 상담하세요.',
  },
  {
    q: '종합소득세 신고 기간은 언제인가요?',
    a: '매년 5월 1일~5월 31일이 종합소득세 확정신고 기간입니다. 성실신고확인 대상 사업자는 6월 30일까지 신고해야 합니다. TaxFlow AI는 신고 마감 7일 전 이메일로 알림을 발송합니다.',
  },
  {
    q: 'AI 분류 결과를 그대로 홈택스에 신고해도 되나요?',
    a: 'TaxFlow AI는 참고용 AI 코치로, 분류 결과에 오류가 있을 수 있습니다. 반드시 사용자가 직접 검토하거나 세무사와 확인한 후 신고하세요. AI 분류 결과는 법적 효력이 없습니다.',
  },
]

function FAQ() {
  return (
    <section className="bg-white px-4 py-16 lg:py-20">
      <div className="mx-auto max-w-2xl">
        <p className="mb-2 text-center text-sm font-semibold uppercase tracking-widest text-slate-400">
          자주 묻는 질문
        </p>
        <h2 className="mb-10 text-center text-2xl font-bold text-slate-900 lg:text-3xl">FAQ</h2>
        <div className="space-y-3">
          {FAQS.map((faq) => (
            <details
              key={faq.q}
              className="group rounded-xl border border-slate-200 bg-slate-50 open:bg-white"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm font-semibold text-slate-800 hover:text-slate-900">
                <span className="flex items-center gap-2">
                  <HelpCircle className="h-4 w-4 flex-shrink-0 text-blue-400" />
                  {faq.q}
                </span>
                <span className="flex-shrink-0 text-slate-400 transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="border-t border-slate-100 px-5 py-4 text-sm text-slate-600 leading-relaxed">
                {faq.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="bg-slate-950 px-4 py-12">
      <div className="mx-auto max-w-4xl">
        {/* Disclaimer — prominent */}
        <div className="mb-8 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-400" />
            <div>
              <p className="mb-1 text-sm font-semibold text-amber-300">법적 고지</p>
              <p className="text-xs text-amber-200/80 leading-relaxed">
                TaxFlow AI는 참고용 AI 코치 서비스입니다. 제공되는 세금 분류, 계산, 최적화 추천
                결과는 교육 및 참고 목적으로만 사용하십시오. 실제 세금 신고는 반드시 사용자 본인이
                홈택스를 통해 직접 하거나 공인 세무사와 상담 후 처리하세요.{' '}
                <strong className="text-amber-300">AI 분류 결과는 법적 효력이 없습니다.</strong>
              </p>
            </div>
          </div>
        </div>

        {/* Links */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-600 text-[10px] font-bold text-white">T</div>
            <span className="text-sm font-semibold text-white">TaxFlow AI</span>
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-slate-500">
            <Link href="/login"   className="hover:text-slate-300">로그인</Link>
            <Link href="/signup"  className="hover:text-slate-300">회원가입</Link>
            <a href="mailto:support@taxflow.ai" className="hover:text-slate-300">문의하기</a>
          </div>
        </div>
        <p className="mt-4 text-xs text-slate-600">
          © {new Date().getFullYear()} TaxFlow AI. 1인 개발자가 Claude Code로 만든 크리에이터 세금 AI 코치.
        </p>
      </div>
    </footer>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <main>
      <Hero />
      <PainPoints />
      <HowItWorks />
      <CreatorFeatures />
      <Pricing />
      <FAQ />
      <Footer />
    </main>
  )
}
