# TaxFlow AI — 1인 개발자가 Claude Code로 만든 크리에이터 특화 세금 AI 코치

한국 크리에이터, 유튜버, 프리랜서를 위한 실시간 AI 세금 최적화 Micro-SaaS

## 주요 기능

- **CSV 자동 파싱** — 국민, 신한, 하나, 우리, 카카오뱅크 등 8개 은행 형식 자동 감지
- **AI 거래 분류** — Claude AI가 거래 내역을 세금 목적에 맞게 자동 분류
- **실시간 절세 추천** — 크리에이터 특화 공제 항목 분석 및 절세 전략 추천
- **세금 시뮬레이터** — 소득/지출 변화에 따른 세금 영향 실시간 시뮬레이션
- **홈택스 내보내기** — CSV, XML, PDF 형식으로 세금 신고 자료 내보내기
- **마감일 알림** — 이메일/카카오톡으로 세금 신고 마감일 자동 알림

## 기술 스택

- **Frontend**: Next.js 15, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Supabase (Auth + DB + Realtime), Upstash Redis
- **AI**: Anthropic Claude API (claude-opus-4-5)
- **결제**: Paddle Billing v2 (Merchant of Record — 한국 VAT 및 KRW 자동 처리)
- **알림**: Resend (이메일), 카카오 알림톡

## 요금제

| 기능 | Free | Pro | Business |
|------|------|-----|----------|
| 거래 분류 | 100건/월 | 5,000건/월 | 무제한 |
| AI 최적화 | 3회/월 | 30회/월 | 무제한 |
| 내보내기 | 1회/월 | 10회/월 | 무제한 |

## 시작하기

```bash
# 의존성 설치
pnpm install

# 환경 변수 설정
cp .env.local.example .env.local
# .env.local 파일에 각 서비스 키 입력

# 개발 서버 실행
pnpm dev
```

## 환경 변수 설정

`.env.local.example`을 복사하여 `.env.local`을 생성하고 아래 서비스에서 키를 발급받으세요:

- [Supabase](https://supabase.com) — 데이터베이스 및 인증
- [Anthropic](https://console.anthropic.com) — Claude AI API
- [Paddle](https://vendors.paddle.com) — 결제 처리 (Merchant of Record, 한국 VAT 및 KRW 자동 처리)
- [Upstash](https://console.upstash.com) — Redis 캐시 및 레이트 리밋
- [Resend](https://resend.com) — 이메일 발송
- [Kakao Developers](https://developers.kakao.com) — 카카오 알림톡

## 면책 조항

TaxFlow AI는 세금 관련 일반 정보를 제공하며 공인 세무사의 자문을 대체하지 않습니다. 정확한 세금 신고는 공인 세무사와 상담하시기 바랍니다.
