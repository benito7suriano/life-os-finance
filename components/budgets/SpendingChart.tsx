'use client'

import { useId } from 'react'
import type { MonthlyHistoryEntry, TimeRange } from './types'
import { Card } from '@/components/ui'

interface SpendingChartProps {
  data: MonthlyHistoryEntry[]
  timeRange: TimeRange
  onTimeRangeChange?: (range: TimeRange) => void
}

const RANGES: { value: TimeRange; label: string }[] = [
  { value: '6months', label: '6 months' },
  { value: '12months', label: '12 months' },
  { value: 'all', label: 'All' },
]

export function SpendingChart({ data, timeRange, onTimeRangeChange }: SpendingChartProps) {
  const fillId = useId().replace(/:/g, '')
  const glowId = useId().replace(/:/g, '')

  const visibleData = timeRange === '6months' ? data.slice(-6) : timeRange === '12months' ? data.slice(-12) : data

  const chartWidth = 600
  const chartHeight = 200
  const chartPadding = { top: 20, right: 40, bottom: 40, left: 50 }

  const allValues = visibleData.flatMap((d) => [d.budgeted, d.spent])
  const maxValue = Math.max(...allValues, 1) * 1.1

  const getX = (index: number) => {
    const usableWidth = chartWidth - chartPadding.left - chartPadding.right
    return chartPadding.left + (index / Math.max(visibleData.length - 1, 1)) * usableWidth
  }
  const getY = (value: number) => {
    const usableHeight = chartHeight - chartPadding.top - chartPadding.bottom
    return chartPadding.top + usableHeight - (value / maxValue) * usableHeight
  }

  const generateSpentPath = () => visibleData.map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(d.spent)}`).join(' ')

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

  const generateAreaPath = () => {
    const linePath = visibleData.map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(d.spent)}`).join(' ')
    const bottomRight = `L ${getX(visibleData.length - 1)} ${chartHeight - chartPadding.bottom}`
    const bottomLeft = `L ${getX(0)} ${chartHeight - chartPadding.bottom}`
    return `${linePath} ${bottomRight} ${bottomLeft} Z`
  }

  return (
    <Card pad={24}>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--fg3)' }}>Spending vs Budget</h3>
        <div className="flex items-center gap-1">
          {RANGES.map((r) => {
            const active = timeRange === r.value
            return (
              <button
                key={r.value}
                onClick={() => onTimeRangeChange?.(r.value)}
                className="rounded-md px-3 py-1.5"
                style={
                  active
                    ? { background: 'var(--accent-soft)', color: 'var(--accent-a)', fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500 }
                    : { background: 'transparent', color: 'var(--fg3)', fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500 }
                }
              >
                {r.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="mb-4 flex items-center gap-6">
        <div className="flex items-center gap-2">
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--accent-a)' }} />
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--fg2)' }}>Spent</span>
        </div>
        <div className="flex items-center gap-2">
          <div style={{ width: 12, height: 2, background: 'var(--fg4)' }} />
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--fg2)' }}>Budgeted</span>
        </div>
      </div>

      {/* Chart */}
      <div className="relative">
        <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="h-auto w-full" preserveAspectRatio="xMidYMid meet">
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = chartPadding.top + (chartHeight - chartPadding.top - chartPadding.bottom) * (1 - ratio)
            return (
              <g key={ratio}>
                <line x1={chartPadding.left} y1={y} x2={chartWidth - chartPadding.right} y2={y} stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
                <text x={chartPadding.left - 8} y={y + 4} textAnchor="end" fill="var(--fg3)" fontSize="10" fontFamily="var(--font-mono)">
                  ${((maxValue * ratio) / 1000).toFixed(1)}k
                </text>
              </g>
            )
          })}

          <defs>
            <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent-a)" stopOpacity="0.18" />
              <stop offset="100%" stopColor="var(--accent-a)" stopOpacity="0" />
            </linearGradient>
            <filter id={glowId} x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="2" />
              <feMerge>
                <feMergeNode />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <path d={generateAreaPath()} fill={`url(#${fillId})`} />
          <path d={generateBudgetPath()} fill="none" stroke="var(--fg4)" strokeWidth="2" strokeDasharray="8 4" />
          <path d={generateSpentPath()} fill="none" stroke="var(--accent-a)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" filter={`url(#${glowId})`} />

          {visibleData.map((d, i) => (
            <circle key={i} cx={getX(i)} cy={getY(d.spent)} r="4" fill="var(--bg)" stroke="var(--accent-a)" strokeWidth="2" />
          ))}

          {visibleData.map((d, i) => {
            const labelStep = Math.ceil(visibleData.length / 12)
            const showLabel = i % labelStep === 0 || i === visibleData.length - 1
            if (!showLabel) return null
            return (
              <text key={i} x={getX(i)} y={chartHeight - 10} textAnchor="middle" fill="var(--fg3)" fontSize="10" fontFamily="var(--font-sans)">
                {d.month.split(' ')[0].slice(0, 3)}
              </text>
            )
          })}
        </svg>
      </div>
    </Card>
  )
}
