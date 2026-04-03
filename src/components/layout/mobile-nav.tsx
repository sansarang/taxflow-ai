'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { NAV_ITEMS } from './sidebar'

// ─── Hamburger drawer (shown in Header on mobile) ────────────────────────────

export function MobileNav() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden">
          <Menu className="h-5 w-5" />
          <span className="sr-only">메뉴 열기</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-60 p-0">
        <div className="flex h-16 items-center gap-2 border-b border-slate-200 px-5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white text-xs font-bold">
            T
          </div>
          <span className="text-[15px] font-bold text-slate-900">TaxFlow AI</span>
        </div>
        <nav className="flex-1 space-y-0.5 p-3">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
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
      </SheetContent>
    </Sheet>
  )
}

// ─── Bottom tab bar (shown on mobile only) ────────────────────────────────────
// Shows first 5 nav items as a fixed bottom bar.

const BOTTOM_ITEMS = NAV_ITEMS.slice(0, 5)

export function MobileBottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex h-14 items-center justify-around border-t border-slate-200 bg-white lg:hidden">
      {BOTTOM_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + '/')
        return (
          <Link
            key={href}
            href={href}
            className="flex flex-1 flex-col items-center gap-0.5 py-1.5"
          >
            <Icon
              className={cn(
                'h-5 w-5 transition-colors',
                active ? 'text-blue-600' : 'text-slate-400'
              )}
            />
            <span
              className={cn(
                'text-[9px] font-medium leading-none transition-colors',
                active ? 'text-blue-600' : 'text-slate-400'
              )}
            >
              {label.length > 5 ? label.slice(0, 5) : label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
