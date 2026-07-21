'use client'

import type { Summary, Account, MonthlyTrendItem } from './types'
import { Card, Badge, Spark, formatCurrency, formatPercent } from '@/components/ui'

interface NetWorthHeroProps {
  summary: Summary
  accounts: Account[]
  trend: MonthlyTrendItem[]
}

export function NetWorthHero({ summary, accounts, trend }: NetWorthHeroProps) {
  const { netWorth, monthlyIncome, monthlyExpenses } = summary
  // Aggregate in USD — accounts may be in different currencies.
  const assets = accounts.filter((a) => a.balanceUsd > 0).reduce((s, a) => s + a.balanceUsd, 0)
  const debts = accounts.filter((a) => a.balanceUsd < 0).reduce((s, a) => s + a.balanceUsd, 0)
  const saved = monthlyIncome.amount - monthlyExpenses.amount

  // net cumulative series for the sparkline
  const series = trend.map((t) => t.income - t.expenses)
  const hasTrend = series.length > 1
  const up = netWorth.trend !== 'down'

  const breakdown = [
    { k: 'Assets', v: formatCurrency(assets), sub: `${accounts.filter((a) => a.balanceUsd > 0).length} accounts`, color: 'var(--fg)' },
    { k: 'Debts', v: debts === 0 ? '$0.00' : formatCurrency(debts), sub: `${accounts.filter((a) => a.balanceUsd < 0).length} accounts`, color: 'var(--bad)' },
    { k: 'Saved · mo', v: formatCurrency(saved, { sign: true }), sub: 'income − expenses', color: saved >= 0 ? 'var(--good)' : 'var(--bad)' },
  ]

  return (
    <Card pad={28} style={{ overflow: 'hidden' }}>
      <div
        aria-hidden
        style={{
          position: 'absolute',
          right: -80,
          top: -80,
          width: 280,
          height: 280,
          borderRadius: '50%',
          background: 'radial-gradient(circle, var(--accent-soft), transparent 60%)',
          pointerEvents: 'none',
        }}
      />
      <div className="relative grid grid-cols-1 items-start gap-6 lg:grid-cols-[1fr_auto]">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg3)', letterSpacing: '0.18em', textTransform: 'uppercase' }}>
              Net worth
            </span>
            {!!netWorth.changePercent && (
              <Badge tone={up ? 'good' : 'bad'} dot>
                {formatPercent(netWorth.changePercent)} MoM
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap" style={{ alignItems: 'baseline', gap: 14 }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 64, fontWeight: 600, lineHeight: 1, color: 'var(--fg)', letterSpacing: '-0.025em' }}>
              {formatCurrency(netWorth.amount, { decimals: 0 })}
            </span>
            {!!netWorth.change && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 16, color: up ? 'var(--good)' : 'var(--bad)' }}>
                {formatCurrency(netWorth.change, { sign: true })}
              </span>
            )}
          </div>
          <div className="flex flex-wrap" style={{ gap: 20, marginTop: 18 }}>
            {breakdown.map((row, i) => (
              <div key={row.k} style={{ paddingLeft: i ? 28 : 0, borderLeft: i ? '1px solid var(--card-border)' : 'none' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg3)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>{row.k}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 18, color: row.color, marginTop: 6 }}>{row.v}</div>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--fg3)', marginTop: 4 }}>{row.sub}</div>
              </div>
            ))}
          </div>
        </div>
        {hasTrend && (
          <div className="hidden lg:block" style={{ width: 360, paddingTop: 6 }}>
            <Spark data={series} width={360} height={140} color="var(--accent-a)" fill />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg3)', marginTop: 6 }}>
              <span>{trend[0].label}</span>
              <span style={{ color: 'var(--fg2)' }}>now</span>
              <span>{trend[trend.length - 1].label}</span>
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}
