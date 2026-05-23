'use client'

import type { ReactNode } from 'react'
import type { Summary, MonthlyTrendItem } from './types'
import { Card, Spark, MiniBars } from '@/components/ui'

interface KpiCardsProps {
  summary: Summary
  trend: MonthlyTrendItem[]
}

function bigAmount(n: number): ReactNode {
  const [int, dec] = Math.abs(n)
    .toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .split('.')
  return (
    <>
      {(n < 0 ? '−' : '') + '$' + int}
      <span style={{ color: 'var(--fg3)', fontSize: 18 }}>.{dec}</span>
    </>
  )
}

function KpiTile({
  label,
  value,
  trend,
  trendTone = 'neutral',
  sub,
  chart,
}: {
  label: string
  value: ReactNode
  trend?: string
  trendTone?: 'good' | 'warn' | 'bad' | 'neutral'
  sub?: string
  chart?: ReactNode
}) {
  const trendColor = { good: 'var(--good)', warn: 'var(--warn)', bad: 'var(--bad)', neutral: 'var(--fg2)' }[trendTone]
  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--fg3)' }}>{label}</div>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 30,
              fontWeight: 600,
              lineHeight: 1.05,
              color: 'var(--fg)',
              marginTop: 10,
              letterSpacing: '-0.015em',
            }}
          >
            {value}
          </div>
          {trend && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: trendColor, marginTop: 8 }}>{trend}</div>
          )}
          {sub && (
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--fg3)', marginTop: trend ? 4 : 8 }}>
              {sub}
            </div>
          )}
        </div>
        {chart && <div>{chart}</div>}
      </div>
    </Card>
  )
}

export function KpiCards({ summary, trend }: KpiCardsProps) {
  const { netWorth, monthlyExpenses, monthlyIncome } = summary
  const savings = monthlyIncome.amount - monthlyExpenses.amount
  const savingsRate = monthlyIncome.amount > 0 ? (savings / monthlyIncome.amount) * 100 : 0

  const incomeSeries = trend.map((t) => t.income)
  const expenseSeries = trend.map((t) => t.expenses)
  const savedSeries = trend.map((t) => t.income - t.expenses)
  const hasTrend = trend.length > 1

  const pct = (p: number) => `${p >= 0 ? '↗ +' : '↘ '}${p.toFixed(1)}% MoM`

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <KpiTile
        label="Income · this month"
        value={bigAmount(monthlyIncome.amount)}
        trend={monthlyIncome.changePercent ? pct(monthlyIncome.changePercent) : '↗ stable'}
        trendTone="neutral"
        chart={hasTrend ? <MiniBars data={incomeSeries} color="var(--accent-a)" width={100} height={48} /> : undefined}
      />
      <KpiTile
        label="Expenses · this month"
        value={bigAmount(monthlyExpenses.amount)}
        trend={monthlyExpenses.changePercent ? pct(monthlyExpenses.changePercent) : undefined}
        trendTone={monthlyExpenses.changePercent > 0 ? 'warn' : 'good'}
        chart={hasTrend ? <MiniBars data={expenseSeries} color="var(--bad)" width={100} height={48} /> : undefined}
      />
      <KpiTile
        label="Savings · this month"
        value={bigAmount(savings)}
        trend={`${savingsRate.toFixed(1)}% of income`}
        trendTone={savings >= 0 ? 'good' : 'bad'}
        chart={hasTrend ? <Spark data={savedSeries} color="var(--good)" width={100} height={48} fill /> : undefined}
      />
      <KpiTile
        label="Net worth"
        value={bigAmount(netWorth.amount)}
        trend={netWorth.changePercent ? pct(netWorth.changePercent) : '↗ stable'}
        trendTone={netWorth.trend === 'down' ? 'bad' : netWorth.trend === 'up' ? 'good' : 'neutral'}
        chart={hasTrend ? <Spark data={savedSeries.map((v, i) => v + i)} color="var(--accent-a)" width={100} height={48} /> : undefined}
      />
    </div>
  )
}
