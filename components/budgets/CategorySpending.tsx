import { useState } from 'react'
import type { CategorySpending as CategorySpendingType } from './types'

interface CategorySpendingProps {
  data: CategorySpendingType[]
  month: string
}

function formatUsd(amount: number) {
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function CategorySpending({ data, month }: CategorySpendingProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const maxSpent = Math.max(1, ...data.map(c => c.spent))
  const total = data.reduce((sum, c) => sum + c.spent, 0)

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          Spending by Category
        </h3>
        <span className="text-sm text-slate-500 dark:text-slate-400">{month}</span>
      </div>

      {data.length === 0 || total === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400 py-6 text-center">
          No spending recorded for {month}.
        </p>
      ) : (
        <div className="space-y-1">
          {data.map(cat => {
            const hasSubs = cat.subcategories.length > 0
            const isOpen = !!expanded[cat.id]
            return (
              <div key={cat.id}>
                <button
                  onClick={() => hasSubs && setExpanded(prev => ({ ...prev, [cat.id]: !prev[cat.id] }))}
                  className={`w-full text-left py-2 rounded-lg transition-colors ${
                    hasSubs ? 'hover:bg-slate-50 dark:hover:bg-slate-700/40 cursor-pointer' : 'cursor-default'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3 px-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {hasSubs ? (
                        <svg
                          className={`w-3.5 h-3.5 text-slate-400 flex-shrink-0 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      ) : (
                        <span className="w-3.5 flex-shrink-0" />
                      )}
                      <span className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                        {cat.name}
                      </span>
                    </div>
                    <span className="text-sm font-medium text-slate-900 dark:text-slate-100 tabular-nums flex-shrink-0">
                      {formatUsd(cat.spent)}
                    </span>
                  </div>
                  <div className="mt-1.5 ml-5 mr-1 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{ width: `${(cat.spent / maxSpent) * 100}%` }}
                    />
                  </div>
                </button>

                {hasSubs && isOpen && (
                  <div className="ml-5 mt-1 mb-2 space-y-1 border-l border-slate-200 dark:border-slate-700 pl-3">
                    {cat.subcategories.map(sub => (
                      <div key={sub.id} className="flex items-center justify-between gap-3">
                        <span className="text-sm text-slate-600 dark:text-slate-400 truncate">{sub.name}</span>
                        <span className="text-sm text-slate-600 dark:text-slate-400 tabular-nums flex-shrink-0">
                          {formatUsd(sub.spent)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}

          <div className="flex items-center justify-between pt-3 mt-2 border-t border-slate-200 dark:border-slate-700 px-1">
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">Total</span>
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
              {formatUsd(total)}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
