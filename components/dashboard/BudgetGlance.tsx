'use client'

import type { Summary } from './types'
import { Card, Badge, Progress, formatCurrency } from '@/components/ui'

interface BudgetGlanceProps {
  summary: Summary
  onGo?: () => void
}

export function BudgetGlance({ summary, onGo }: BudgetGlanceProps) {
  const b = summary.budgetProjection
  const tone = b.status === 'over_budget' ? 'bad' : b.status === 'warning' ? 'warn' : 'good'
  const label = b.status === 'over_budget' ? 'over budget' : b.status === 'warning' ? 'on warning' : 'on track'
  const month = new Date().toLocaleDateString('en-US', { month: 'long' })

  return (
    <Card hoverable onClick={onGo}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 600, color: 'var(--fg)' }}>Budget · {month}</span>
        <span style={{ flex: 1 }} />
        <Badge tone={tone} dot>
          {label}
        </Badge>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 600, color: 'var(--fg)', letterSpacing: '-0.015em' }}>
          {formatCurrency(b.spent)}
        </span>
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--fg3)' }}>of {formatCurrency(b.totalBudget)}</span>
      </div>
      <div style={{ marginTop: 10 }}>
        <Progress
          value={Math.min(b.percentUsed, 100)}
          color={tone === 'good' ? undefined : 'linear-gradient(90deg, var(--warn), var(--bad))'}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg3)' }}>
          <span>
            {b.percentUsed.toFixed(1)}% used · {b.daysRemaining} days left
          </span>
          {b.projectedOverspend > 0 && <span style={{ color: 'var(--warn)' }}>+{formatCurrency(b.projectedOverspend)} proj.</span>}
        </div>
      </div>
    </Card>
  )
}
