import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Toaster } from 'sonner'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'TaxFlow AI — 크리에이터를 위한 실시간 세금 AI 코치',
  description:
    '은행 CSV 업로드 하나로 절세 기회 발견 + 홈택스 신고 파일 자동 생성. 유튜버·프리랜서·1인사업자 특화 세금 AI.',
  keywords: ['세금', '절세', '크리에이터', '유튜버', '프리랜서', '부가세', '종합소득세'],
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster
          position="top-right"
          richColors
          closeButton
          toastOptions={{
            style: { fontFamily: 'inherit' },
          }}
        />
      </body>
    </html>
  )
}
