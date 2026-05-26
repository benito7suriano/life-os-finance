'use client'

import { useId, useState } from 'react'
import { BarChart3 } from 'lucide-react'
import type { MonthlyTrendItem } from './types'
import { Card, Chip, Empty } from '@/components/ui'

type View = 'all' | 'income' | 'expenses' | 'saved'

interface StatisticChartProps {
  trend: MonthlyTrendItem[]
}

export function StatisticChart({ trend }: StatisticChartProps) {
  const [view, setView] = useState<View>('all')
  const glowId = useId().replace(/:/g, '')
  const fillId = useId().replace(/:/g, '')

  if (trend.length < 2) {
    return (
      <Card pad={24}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600, color: 'var(--fg)' }}>Statistic</div>
        <Empty icon={BarChart3} title="Not enough history yet" body="Once you have a couple of months of activity, your income, expenses, and savings trend will appear here." />
      </Card>
    )
  }

  const months = trend.map((t) => t.label)
  const incomeData = trend.map((t) => t.income)
  const expensesData = trend.map((t) => t.expenses)
  const savedData = trend.map((t) => t.income - t.expenses)

  const width = 760
  const height = 230
  const padX = 36
  const padY = 18
  const visible: number[][] =
    view === 'all' ? [incomeData, expensesData, savedData] : view === 'income' ? [incomeData] : view === 'expenses' ? [expensesData] : [savedData]
  const max = Math.max(...visible.flat()) * 1.1 || 1
  const xs = months.map((_, i) => padX + (i * (width - padX * 2)) / (months.length - 1))
  const pathOf = (data: number[]) => {
    const ys = data.map((v) => height - padY - 16 - (v / max) * (height - padY * 2 - 16))
    let p = `M ${xs[0]} ${ys[0]}`
    for (let i = 1; i < xs.length; i++) {
      const mx = (xs[i - 1] + xs[i]) / 2
      p += ` C ${mx} ${ys[i - 1]}, ${mx} ${ys[i]}, ${xs[i]} ${ys[i]}`
    }
    return { p, ys }
  }

  const series: { key: string; color: string; data: number[]; width: number; glow?: boolean }[] = []
  if (view === 'all' || view === 'income') series.push({ key: 'income', color: 'var(--accent-a)', data: incomeData, width: 2.2, glow: true })
  if (view === 'all' || view === 'expenses') series.push({ key: 'expenses', color: 'var(--bad)', data: expensesData, width: 1.6 })
  if (view === 'all' || view === 'saved') series.push({ key: 'saved', color: 'var(--good)', data: savedData, width: 1.4 })

  const tabs: { v: View; l: string }[] = [
    { v: 'all', l: 'All' },
    { v: 'income', l: 'Income' },
    { v: 'expenses', l: 'Expenses' },
    { v: 'saved', l: 'Saved' },
  ]

  return (
    <Card pad={24}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600, color: 'var(--fg)' }}>Statistic</span>
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--fg3)', marginLeft: 8 }}>· {months.length} months</span>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 6 }}>
          {tabs.map((opt) => (
            <Chip key={opt.v} active={view === opt.v} onClick={() => setView(opt.v)}>
              {opt.l}
            </Chip>
          ))}
        </div>
      </div>
      <svg viewBox={`0 0 ${width} ${height + 22}`} style={{ width: '100%', height: 'auto' }}>
        <defs>
          <filter id={glowId} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2" />
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent-a)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--accent-a)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3, 4].map((i) => {
          const y = padY + (i * (height - padY * 2 - 16)) / 4
          return <line key={i} x1={padX} x2={width - padX} y1={y} y2={y} stroke="rgba(255,255,255,0.04)" />
        })}
        {(view === 'all' || view === 'income') &&
          (() => {
            const linePath = pathOf(incomeData).p
            const area = `${linePath} L ${xs[xs.length - 1]} ${height - padY} L ${xs[0]} ${height - padY} Z`
            return <path d={area} fill={`url(#${fillId})`} />
          })()}
        {series.map((s) => {
          const { p } = pathOf(s.data)
          return <path key={s.key} d={p} stroke={s.color} strokeWidth={s.width} fill="none" strokeLinecap="round" filter={s.glow ? `url(#${glowId})` : undefined} />
        })}
        {xs.map((x, i) => (
          <text key={i} x={x} y={height + 14} fill="var(--fg3)" fontSize="10" fontFamily="var(--font-sans)" textAnchor="middle">
            {months[i]}
          </text>
        ))}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 22, marginTop: 10 }}>
        {[
          { c: 'var(--accent-a)', l: 'Income' },
          { c: 'var(--bad)', l: 'Expenses' },
          { c: 'var(--good)', l: 'Saved' },
        ].map((it) => (
          <span key={it.l} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--fg2)', fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 500 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: it.c }} />
            {it.l}
          </span>
        ))}
      </div>
    </Card>
  )
}
