'use client'

import type { MonthlyTrendItem, TrendPeriod } from './types'

interface TrendChartProps {
  data: MonthlyTrendItem[]
  selectedPeriod: TrendPeriod
  onPeriodChange: (period: TrendPeriod) => void
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

const periods: { value: TrendPeriod; label: string }[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
]

export function TrendChart({ data, selectedPeriod, onPeriodChange }: TrendChartProps) {
  // Find the maximum value for scaling
  const maxValue = Math.max(...data.flatMap((item) => [item.income, item.expenses]))
  const chartHeight = 160

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      {/* Header with filter tabs */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
          Income vs Expenses
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

      {/* Legend */}
      <div className="mb-4 flex gap-4">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
          <span className="text-xs text-slate-600 dark:text-slate-400">Income</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
          <span className="text-xs text-slate-600 dark:text-slate-400">Expenses</span>
        </div>
      </div>

      {/* Bar Chart */}
      <div className="relative" style={{ height: chartHeight }}>
        {/* Y-axis grid lines */}
        <div className="absolute inset-0 flex flex-col justify-between">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-12 text-right text-[10px] text-slate-400 font-[JetBrains_Mono,monospace]">
                {formatCurrency(maxValue - (maxValue / 3) * i)}
              </span>
              <div className="flex-1 border-t border-slate-100 dark:border-slate-800" />
            </div>
          ))}
        </div>

        {/* Bars container */}
        <div className="absolute inset-0 ml-14 flex items-end justify-around gap-2 pb-6">
          {data.map((item) => {
            const incomeHeight = (item.income / maxValue) * (chartHeight - 24)
            const expensesHeight = (item.expenses / maxValue) * (chartHeight - 24)

            return (
              <div key={item.period} className="flex flex-1 flex-col items-center gap-1">
                {/* Bars */}
                <div className="flex w-full items-end justify-center gap-1" style={{ height: chartHeight - 24 }}>
                  {/* Income bar */}
                  <div
                    className="w-3 rounded-t bg-emerald-500 transition-all duration-300 hover:bg-emerald-600 sm:w-4"
                    style={{ height: incomeHeight }}
                    title={`Income: ${formatCurrency(item.income)}`}
                  />
                  {/* Expenses bar */}
                  <div
                    className="w-3 rounded-t bg-red-500 transition-all duration-300 hover:bg-red-600 sm:w-4"
                    style={{ height: expensesHeight }}
                    title={`Expenses: ${formatCurrency(item.expenses)}`}
                  />
                </div>
                {/* Label */}
                <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                  {item.label}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
