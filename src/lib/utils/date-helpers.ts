import { format, startOfQuarter, endOfQuarter, addDays } from 'date-fns'
import { ko } from 'date-fns/locale'

export function formatKoreanDate(date: Date | string): string {
  return format(new Date(date), 'yyyy년 MM월 dd일', { locale: ko })
}

export function getCurrentQuarter(date = new Date()): { start: Date; end: Date } {
  return {
    start: startOfQuarter(date),
    end: endOfQuarter(date),
  }
}

export function getNextTaxDeadline(): { name: string; date: Date; daysLeft: number } {
  const now = new Date()
  const year = now.getFullYear()

  const deadlines = [
    { name: '부가가치세 1기 예정신고', date: new Date(year, 3, 25) },
    { name: '부가가치세 1기 확정신고', date: new Date(year, 6, 25) },
    { name: '종합소득세 신고', date: new Date(year, 4, 31) },
    { name: '부가가치세 2기 예정신고', date: new Date(year, 9, 25) },
    { name: '부가가치세 2기 확정신고', date: new Date(year + 1, 0, 25) },
  ]

  const upcoming = deadlines
    .filter((d) => d.date >= now)
    .sort((a, b) => a.date.getTime() - b.date.getTime())

  const next = upcoming[0] ?? deadlines[deadlines.length - 1]
  const daysLeft = Math.ceil((next.date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  return { ...next, daysLeft }
}
