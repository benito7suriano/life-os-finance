'use client'

import type { SpendingByCategory, SpendingPeriod } from './types'

interface SpendingChartProps {
  data: SpendingByCategory
  selectedPeriod: SpendingPeriod
  onPeriodChange: (period: SpendingPeriod) => void
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount)
}

const periods: { value: SpendingPeriod; label: string }[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
  { value: 'total', label: 'Total' },
]

export function SpendingChart({ data, selectedPeriod, onPeriodChange }: SpendingChartProps) {
  const { categories, total } = data

  // Calculate the donut chart segments
  const size = 180
  const strokeWidth = 32
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const center = size / 2

  // Sort categories by amount for the legend (top 3)
  const topCategories = [...categories].sort((a, b) => b.amount - a.amount).slice(0, 3)

  // Calculate stroke dash offsets for each segment
  let cumulativePercent = 0
  const segments = categories.map((category) => {
    const segmentLength = (category.percent / 100) * circumference
    const offset = cumulativePercent
    cumulativePercent += segmentLength
    return {
      ...category,
      strokeDasharray: `${segmentLength} ${circumference - segmentLength}`,
      strokeDashoffset: -offset,
    }
  })

  if (categories.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h3 className="mb-5 text-sm font-semibold text-slate-900 dark:text-white">
          Spending by Category
        </h3>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400">No spending data yet</p>
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
            Add transactions to see your spending breakdown
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      {/* Header with filter tabs */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
          Spending by Category
        </h3>
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
          {periods.map((period) => (
            <button
              key={period.value}
              onClick={() => onPeriodChange(period.value)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                selectedPeriod === period.value
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              {period.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart and summary */}
      <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-center">
        {/* Donut Chart */}
        <div className="relative flex-shrink-0">
          <svg width={size} height={size} className="-rotate-90">
            {/* Background circle */}
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth={strokeWidth}
              className="text-slate-100 dark:text-slate-800"
            />
            {/* Segments */}
            {segments.map((segment) => (
              <circle
                key={segment.id}
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke={segment.color}
                strokeWidth={strokeWidth}
                strokeDasharray={segment.strokeDasharray}
                strokeDashoffset={segment.strokeDashoffset}
                strokeLinecap="butt"
                className="transition-all duration-300"
              />
            ))}
          </svg>
        </div>

        {/* Total and top categories */}
        <div className="flex flex-col items-center sm:items-start">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Spent</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white font-[JetBrains_Mono,monospace]">
            {formatCurrency(total)}
          </p>

          {/* Top 3 categories */}
          <div className="mt-4 space-y-2">
            {topCategories.map((category) => (
              <div key={category.id} className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: category.color }}
                />
                <span className="text-xs text-slate-600 dark:text-slate-400">
                  {category.name}
                </span>
                <span className="text-xs font-medium text-slate-900 dark:text-white font-[JetBrains_Mono,monospace]">
                  {formatCurrency(category.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
