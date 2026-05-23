import type { Budget, Goal } from './types'

interface BudgetCardProps {
  budget?: Budget
  goal?: Goal
  isCategory?: boolean
  onClick?: () => void
}

export function BudgetCard({ budget, goal, isCategory = false, onClick }: BudgetCardProps) {
  const isSinkingFund = !!goal
  const name = budget?.name ?? goal?.name ?? ''

  // Calculate progress
  let progress = 0
  let spent = 0
  let total = 0
  let displayLabel = ''
  let secondaryLabel = ''

  const budgetUnknown = !!budget && budget.budgetKnown === false

  if (budget && budgetUnknown) {
    // Viewing a past month before this budget existed — show spend only.
    spent = budget.spent
    total = 0
    progress = 0
    displayLabel = `$${spent.toLocaleString('en-US', { minimumFractionDigits: 2 })} spent`
    secondaryLabel = 'No budget set'
  } else if (budget) {
    spent = budget.spent
    total = budget.budgeted
    progress = total > 0 ? (spent / total) * 100 : 0
    displayLabel = `$${spent.toLocaleString('en-US', { minimumFractionDigits: 2 })} / $${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
    secondaryLabel = progress > 100 ? `${(progress - 100).toFixed(0)}% over` : `${(100 - progress).toFixed(0)}% left`
  } else if (goal) {
    spent = goal.currentBalance
    total = goal.targetAmount
    progress = total > 0 ? (spent / total) * 100 : 0
    displayLabel = `$${spent.toLocaleString('en-US', { minimumFractionDigits: 2 })} saved`
    secondaryLabel = progress >= 100 ? 'Goal reached!' : `$${(total - spent).toLocaleString('en-US', { minimumFractionDigits: 2 })} to go`
  }

  const isOverBudget = budget && progress > 100
  const isComplete = goal && progress >= 100

  return (
    <button
      onClick={onClick}
      className={`
        w-full text-left p-4 rounded-xl border transition-all duration-200
        hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600
        focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2
        dark:focus:ring-offset-slate-900
        ${isCategory
          ? 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700'
          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
        }
      `}
    >
      <div className="flex items-start gap-4">
        {/* Progress Ring */}
        <div className="relative flex-shrink-0">
          <svg className="w-12 h-12 -rotate-90" viewBox="0 0 48 48">
            <circle
              cx="24"
              cy="24"
              r="20"
              fill="none"
              className="stroke-slate-200 dark:stroke-slate-700"
              strokeWidth="4"
            />
            <circle
              cx="24"
              cy="24"
              r="20"
              fill="none"
              className={`
                transition-all duration-500
                ${isOverBudget
                  ? 'stroke-amber-500'
                  : isComplete
                    ? 'stroke-emerald-500'
                    : 'stroke-emerald-500'
                }
              `}
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={`${Math.min(progress, 100) * 1.256} 125.6`}
            />
            {isOverBudget && (
              <circle
                cx="24"
                cy="24"
                r="20"
                fill="none"
                className="stroke-amber-400/40"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={`${Math.min(progress - 100, 100) * 1.256} 125.6`}
                strokeDashoffset="-125.6"
              />
            )}
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`text-xs font-semibold ${isOverBudget ? 'text-amber-600 dark:text-amber-400' : 'text-slate-700 dark:text-slate-300'}`}>
              {Math.round(Math.min(progress, 999))}%
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className={`font-medium truncate ${isCategory ? 'text-slate-900 dark:text-slate-100' : 'text-slate-800 dark:text-slate-200'}`}>
              {name}
            </h3>
            {isSinkingFund && (
              <span className="flex-shrink-0 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                Fund
              </span>
            )}
            {isCategory && (
              <span className="flex-shrink-0 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider rounded bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400">
                Category
              </span>
            )}
          </div>

          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
            {displayLabel}
          </p>

          <p className={`text-xs mt-0.5 ${isOverBudget ? 'text-amber-600 dark:text-amber-400' : isComplete ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}>
            {secondaryLabel}
          </p>
        </div>

        {/* Arrow indicator */}
        <svg className="w-5 h-5 text-slate-400 dark:text-slate-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </button>
  )
}
