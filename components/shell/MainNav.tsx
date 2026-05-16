'use client'

import type { LucideIcon } from 'lucide-react'

export interface NavItem {
  label: string
  href: string
  Icon: LucideIcon
  isActive?: boolean
}

export interface MainNavProps {
  items: NavItem[]
  isCollapsed: boolean
  onNavigate?: (href: string) => void
}

export function MainNav({ items, isCollapsed, onNavigate }: MainNavProps) {
  return (
    <nav className="px-2">
      <ul className="flex flex-col gap-1">
        {items.map((item) => (
          <li key={item.href}>
            <a
              href={item.href}
              onClick={(e) => {
                e.preventDefault()
                onNavigate?.(item.href)
              }}
              title={isCollapsed ? item.label : undefined}
              className={`
                group relative flex items-center gap-3 rounded-md px-3 py-2
                text-sm font-medium transition-colors
                ${
                  item.isActive
                    ? 'bg-white text-emerald-700 shadow-sm dark:bg-slate-800 dark:text-emerald-400'
                    : 'text-slate-600 hover:bg-white hover:text-slate-900 hover:shadow-sm dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white'
                }
                ${isCollapsed ? 'justify-center px-2' : ''}
              `}
            >
              {/* Active Indicator */}
              {item.isActive && (
                <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-emerald-600 dark:bg-emerald-500" />
              )}

              <item.Icon
                className={`h-5 w-5 flex-shrink-0 ${
                  item.isActive
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-slate-500 group-hover:text-slate-700 dark:text-slate-400 dark:group-hover:text-slate-300'
                }`}
              />

              {!isCollapsed && <span>{item.label}</span>}

              {/* Tooltip for collapsed state */}
              {isCollapsed && (
                <span
                  className="
                    pointer-events-none absolute left-full ml-2 rounded-md
                    bg-slate-900 px-2 py-1 text-xs font-medium text-white
                    opacity-0 transition-opacity group-hover:opacity-100
                    dark:bg-slate-700
                    whitespace-nowrap z-50
                  "
                >
                  {item.label}
                </span>
              )}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
