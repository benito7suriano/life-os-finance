'use client'

import { Sparkles } from 'lucide-react'
import type { Summary } from './types'
import { Card, Button, formatCurrency } from '@/components/ui'

interface InsightCardProps {
  summary: Summary
  onSeeTransactions?: () => void
}

function headline(summary: Summary): { lead: string; accent: string; tail: string; body: string } {
  const { budgetProjection: b } = summary
  if (b.status === 'over_budget' || (b.status === 'warning' && b.projectedOverspend > 0)) {
    return {
      lead: "You're on pace to overspend by ",
      accent: formatCurrency(b.projectedOverspend),
      tail: ' this month.',
      body: `You've used ${b.percentUsed.toFixed(0)}% of your budget with ${b.daysRemaining} days left. Trimming a few discretionary purchases gets you back to neutral.`,
    }
  }
  if (b.status === 'on_track' && b.totalBudget > 0) {
    return {
      lead: "You're on track — projected to finish with ",
      accent: formatCurrency(b.remaining),
      tail: ' to spare.',
      body: `${b.percentUsed.toFixed(0)}% of budget used with ${b.daysRemaining} days remaining. Keep it up.`,
    }
  }
  const saved = summary.monthlyIncome.amount - summary.monthlyExpenses.amount
  return {
    lead: 'This month you saved ',
    accent: formatCurrency(saved, { sign: true }),
    tail: '.',
    body: 'Set a monthly budget to unlock pacing insights and overspend alerts.',
  }
}

export function InsightCard({ summary, onSeeTransactions }: InsightCardProps) {
  const h = headline(summary)
  const now = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
  return (
    <Card pad={24} accent style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <span
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: 'var(--accent-gradient)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#0b0d18',
          }}
        >
          <Sparkles size={15} strokeWidth={2} />
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent-a)', letterSpacing: '0.18em', textTransform: 'uppercase' }}>
          AI Insight
        </span>
        <span style={{ flex: 1 }} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg3)' }}>generated {now}</span>
      </div>
      <h3 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 500, lineHeight: 1.25, color: 'var(--fg)', letterSpacing: '-0.01em' }}>
        {h.lead}
        <span style={{ color: 'var(--accent-a)' }}>{h.accent}</span>
        {h.tail}
      </h3>
      <p style={{ margin: '12px 0 0', fontFamily: 'var(--font-sans)', fontSize: 13, lineHeight: 1.55, color: 'var(--fg2)' }}>{h.body}</p>
      <div style={{ flex: 1 }} />
      <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
        <Button variant="primary" size="sm" onClick={onSeeTransactions}>
          Show me where
        </Button>
        <Button variant="ghost" size="sm">
          Dismiss
        </Button>
      </div>
    </Card>
  )
}
