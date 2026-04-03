import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar, AlertCircle, Clock } from 'lucide-react'

interface TaxDeadline {
  name:        string
  date:        string   // 'YYYY-MM-DD'
  description: string
}

const DEADLINES_2026: TaxDeadline[] = [
  { name: '부가세 1기 예정신고',   date: '2026-04-25', description: '1월~3월 거래내역' },
  { name: '종합소득세 확정신고',   date: '2026-05-31', description: '2025년 귀속 소득' },
  { name: '부가세 1기 확정신고',   date: '2026-07-25', description: '1월~6월 거래내역' },
  { name: '부가세 2기 예정신고',   date: '2026-10-25', description: '7월~9월 거래내역' },
]

type DeadlineStatus = 'overdue' | 'urgent' | 'upcoming' | 'future'

function getStatus(dateStr: string): DeadlineStatus {
  const now   = Date.now()
  const due   = new Date(dateStr).getTime()
  const diff  = due - now
  const days  = Math.ceil(diff / 86_400_000)

  if (days < 0)   return 'overdue'
  if (days <= 7)  return 'urgent'
  if (days <= 30) return 'upcoming'
  return 'future'
}

function daysLeftLabel(dateStr: string): string {
  const diff = new Date(dateStr).getTime() - Date.now()
  const days = Math.ceil(diff / 86_400_000)
  if (days < 0)  return `D+${Math.abs(days)}`
  if (days === 0) return 'D-Day'
  return `D-${days}`
}

function formatDisplayDate(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`
}

const STATUS_STYLES: Record<DeadlineStatus, {
  bar:   string
  badge: string
  text:  string
  icon:  string
}> = {
  overdue:  { bar: 'bg-red-500',    badge: 'bg-red-100 text-red-700',     text: 'text-red-700',    icon: 'text-red-500'    },
  urgent:   { bar: 'bg-red-400',    badge: 'bg-red-100 text-red-600',     text: 'text-red-600',    icon: 'text-red-400'    },
  upcoming: { bar: 'bg-amber-400',  badge: 'bg-amber-100 text-amber-700', text: 'text-amber-700',  icon: 'text-amber-400'  },
  future:   { bar: 'bg-slate-300',  badge: 'bg-slate-100 text-slate-500', text: 'text-slate-600',  icon: 'text-slate-400'  },
}

export function DeadlineCalendar() {
  const now = Date.now()

  // Show the next 4 deadlines from today, or latest 4 if all passed
  const sorted = [...DEADLINES_2026].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  )
  const upcoming = sorted.filter((d) => new Date(d.date).getTime() >= now)
  const display  = upcoming.length > 0 ? upcoming.slice(0, 4) : sorted.slice(-4)

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-slate-500" />
          <CardTitle className="text-sm font-semibold text-slate-800">세금 신고 일정</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {display.map((dl) => {
          const status = getStatus(dl.date)
          const styles = STATUS_STYLES[status]
          const label  = daysLeftLabel(dl.date)

          return (
            <div key={dl.date} className="flex items-start gap-3">
              {/* Timeline dot + line */}
              <div className="flex flex-col items-center">
                <div className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${styles.bar}`} />
                <div className="mt-1 h-8 w-px bg-slate-100" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 -mt-0.5">
                <div className="flex items-center justify-between gap-2">
                  <p className={`text-sm font-medium truncate ${
                    status === 'overdue' ? 'text-red-700 line-through' : 'text-slate-800'
                  }`}>
                    {dl.name}
                  </p>
                  <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${styles.badge}`}>
                    {label}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {status === 'overdue' ? (
                    <AlertCircle className={`h-3 w-3 ${styles.icon}`} />
                  ) : (
                    <Clock className={`h-3 w-3 ${styles.icon}`} />
                  )}
                  <p className="text-xs text-slate-500">
                    {formatDisplayDate(dl.date)} · {dl.description}
                  </p>
                </div>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
