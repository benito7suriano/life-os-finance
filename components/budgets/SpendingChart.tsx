import type { MonthlyHistoryEntry, TimeRange } from './types'

interface SpendingChartProps {
  data: MonthlyHistoryEntry[]
  timeRange: TimeRange
  onTimeRangeChange?: (range: TimeRange) => void
}

export function SpendingChart({ data, timeRange, onTimeRangeChange }: SpendingChartProps) {
  // Filter data based on time range
  const visibleData =
    timeRange === '6months' ? data.slice(-6)
    : timeRange === '12months' ? data.slice(-12)
    : data

  // Calculate chart dimensions
  const chartWidth = 600
  const chartHeight = 200
  const chartPadding = { top: 20, right: 40, bottom: 40, left: 50 }

  // Find max value for scaling. Floor at 1 so an all-zero window (fresh user,
  // or a range with no snapshots/transactions yet) doesn't divide by zero in
  // getY and emit NaN into SVG coordinates.
  const allValues = visibleData.flatMap(d => [d.budgeted, d.spent])
  const maxValue = Math.max(...allValues, 1) * 1.1

  // Calculate positions
  const getX = (index: number) => {
    const usableWidth = chartWidth - chartPadding.left - chartPadding.right
    return chartPadding.left + (index / Math.max(visibleData.length - 1, 1)) * usableWidth
  }

  const getY = (value: number) => {
    const usableHeight = chartHeight - chartPadding.top - chartPadding.bottom
    return chartPadding.top + usableHeight - (value / maxValue) * usableHeight
  }

  // Generate path for the spent line (continuous across all months)
  const generateSpentPath = () => {
    return visibleData
      .map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(d.spent)}`)
      .join(' ')
  }

  // Generate path for the budgeted line, breaking into segments wherever the
  // budget is unknown (0) so old pre-budget months render as honest gaps.
  const generateBudgetPath = () => {
    const segments: string[] = []
    let prevKnown = false
    visibleData.forEach((d, i) => {
      if (d.budgeted > 0) {
        segments.push(`${prevKnown ? 'L' : 'M'} ${getX(i)} ${getY(d.budgeted)}`)
        prevKnown = true
      } else {
        prevKnown = false
      }
    })
    return segments.join(' ')
  }

  // Generate area path for spent (filled area under curve)
  const generateAreaPath = () => {
    const linePath = visibleData
      .map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(d.spent)}`)
      .join(' ')
    const bottomRight = `L ${getX(visibleData.length - 1)} ${chartHeight - chartPadding.bottom}`
    const bottomLeft = `L ${getX(0)} ${chartHeight - chartPadding.bottom}`
    return `${linePath} ${bottomRight} ${bottomLeft} Z`
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
      {/* Header with time range toggle */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Spending vs Budget
          </h3>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-700 rounded-lg">
          <button
            onClick={() => onTimeRangeChange?.('6months')}
            className={`
              px-3 py-1.5 text-sm font-medium rounded-md transition-all
              ${timeRange === '6months'
                ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }
            `}
          >
            6 months
          </button>
          <button
            onClick={() => onTimeRangeChange?.('12months')}
            className={`
              px-3 py-1.5 text-sm font-medium rounded-md transition-all
              ${timeRange === '12months'
                ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }
            `}
          >
            12 months
          </button>
          <button
            onClick={() => onTimeRangeChange?.('all')}
            className={`
              px-3 py-1.5 text-sm font-medium rounded-md transition-all
              ${timeRange === 'all'
                ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }
            `}
          >
            All
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-emerald-500" />
          <span className="text-sm text-slate-600 dark:text-slate-400">Spent</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-0.5 bg-slate-400 dark:bg-slate-500" />
          <span className="text-sm text-slate-600 dark:text-slate-400">Budgeted</span>
        </div>
      </div>

      {/* Chart */}
      <div className="relative">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="w-full h-auto"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = chartPadding.top + (chartHeight - chartPadding.top - chartPadding.bottom) * (1 - ratio)
            return (
              <g key={ratio}>
                <line
                  x1={chartPadding.left}
                  y1={y}
                  x2={chartWidth - chartPadding.right}
                  y2={y}
                  className="stroke-slate-100 dark:stroke-slate-700"
                  strokeWidth="1"
                />
                <text
                  x={chartPadding.left - 8}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-slate-500 dark:fill-slate-400 text-[10px] font-mono"
                >
                  ${((maxValue * ratio) / 1000).toFixed(1)}k
                </text>
              </g>
            )
          })}

          {/* Spent area gradient */}
          <defs>
            <linearGradient id="spentGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgb(16 185 129)" stopOpacity="0.3" />
              <stop offset="100%" stopColor="rgb(16 185 129)" stopOpacity="0.05" />
            </linearGradient>
          </defs>

          {/* Spent area fill */}
          <path
            d={generateAreaPath()}
            fill="url(#spentGradient)"
          />

          {/* Budget line (dashed, broken across unknown months) */}
          <path
            d={generateBudgetPath()}
            fill="none"
            className="stroke-slate-400 dark:stroke-slate-500"
            strokeWidth="2"
            strokeDasharray="8 4"
          />

          {/* Spent line */}
          <path
            d={generateSpentPath()}
            fill="none"
            className="stroke-emerald-500"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Data points for spent */}
          {visibleData.map((d, i) => (
            <circle
              key={i}
              cx={getX(i)}
              cy={getY(d.spent)}
              r="5"
              className="fill-emerald-500"
            />
          ))}

          {/* X-axis labels (thinned so dense ranges stay legible) */}
          {visibleData.map((d, i) => {
            const labelStep = Math.ceil(visibleData.length / 12)
            const showLabel = i % labelStep === 0 || i === visibleData.length - 1
            if (!showLabel) return null
            return (
              <text
                key={i}
                x={getX(i)}
                y={chartHeight - 10}
                textAnchor="middle"
                className="fill-slate-500 dark:fill-slate-400 text-[10px]"
              >
                {d.month.split(' ')[0].slice(0, 3)}
              </text>
            )
          })}
        </svg>
      </div>
    </div>
  )
}
