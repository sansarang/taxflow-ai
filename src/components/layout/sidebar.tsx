'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Upload,
  List,
  Sparkles,
  Download,
  Calculator,
  Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export const NAV_ITEMS = [
  { href: '/dashboard',     label: '대시보드',       icon: LayoutDashboard },
  { href: '/upload',        label: 'CSV 업로드',      icon: Upload          },
  { href: '/transactions',  label: '거래 내역',       icon: List            },
  { href: '/optimize',      label: '절세 추천',       icon: Sparkles        },
  { href: '/export',        label: '홈택스 내보내기', icon: Download        },
  { href: '/simulator',     label: '시뮬레이터',      icon: Calculator      },
  { href: '/settings',      label: '설정',            icon: Settings        },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-white lg:flex lg:flex-col">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 border-b border-slate-200 px-5">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white text-xs font-bold">
          T
        </div>
        <span className="text-[15px] font-bold text-slate-900 tracking-tight">TaxFlow AI</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 p-3">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              )}
            >
              <Icon className={cn('h-4 w-4', active ? 'text-blue-600' : 'text-slate-400')} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-slate-100 p-4">
        <p className="text-[10px] text-slate-400 leading-relaxed">
          ⚠️ AI 분류 결과는 참고용이며 법적 효력이 없습니다.
        </p>
      </div>
    </aside>
  )
}
