'use client'

import type { QuickAction } from '../types'
import type { LucideIcon } from 'lucide-react'
import { Plus, MessageSquare, Wallet, Tags } from 'lucide-react'

interface QuickActionsProps {
  actions: QuickAction[]
  onAction?: (href: string) => void
}

// Map icon names to Lucide components
const iconMap: Record<string, LucideIcon> = {
  plus: Plus,
  'message-square': MessageSquare,
  wallet: Wallet,
  tags: Tags,
}

export function QuickActions({ actions, onAction }: QuickActionsProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">
        Quick Actions
      </h3>

      <div className="grid grid-cols-2 gap-3">
        {actions.map((action) => {
          const Icon = iconMap[action.icon] || Plus

          return (
            <button
              key={action.id}
              onClick={() => onAction?.(action.href)}
              className="flex flex-col items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-4 transition-colors hover:border-emerald-300 hover:bg-emerald-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-emerald-700 dark:hover:bg-emerald-950/30"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400">
                <Icon className="h-5 w-5" />
              </div>
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                {action.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
