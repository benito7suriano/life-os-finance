'use client'

import { useState } from 'react'
import { Sparkles, CheckCircle2 } from 'lucide-react'
import type { Summary } from './types'
import type { Insight, InsightHeadline } from '@/lib/insights/types'
import { Card, Button, formatCurrency } from '@/components/ui'

interface InsightCardProps {
  summary: Summary
  /** Ranked insights from /api/finance/insights. Falls back to a template off
   * `summary.budgetProjection` when absent (e.g. sample-data mode). */
  insights?: Insight[]
  /** ISO timestamp of when the insights were generated. */
  generatedAt?: string
  onSeeTransactions?: () => void
  onNavigate?: (href: string) => void
}

interface InsightView {
  headline: InsightHeadline
  body: string
  cta?: { label: string; href: string }
}

function fallbackInsight(summary: Summary): InsightView {
  const { budgetProjection: b } = summary
  if (b.status === 'over_budget' || (b.status === 'warning' && b.projectedOverspend > 0)) {
    return {
      headline: { lead: "You're on pace to overspend by ", accent: formatCurrency(b.projectedOverspend), tail: ' this month.' },
      body: `You've used ${b.percentUsed.toFixed(0)}% of your budget with ${b.daysRemaining} days left. Trimming a few discretionary purchases gets you back to neutral.`,
      cta: { label: 'Show me where', href: '/transactions' },
    }
  }
  if (b.status === 'on_track' && b.totalBudget > 0) {
    return {
      headline: { lead: "You're on track — projected to finish with ", accent: formatCurrency(b.remaining), tail: ' to spare.' },
      body: `${b.percentUsed.toFixed(0)}% of budget used with ${b.daysRemaining} days remaining. Keep it up.`,
      cta: { label: 'Show me where', href: '/transactions' },
    }
  }
  const saved = summary.monthlyIncome.amount - summary.monthlyExpenses.amount
  return {
    headline: { lead: 'This month you saved ', accent: formatCurrency(saved, { sign: true }), tail: '.' },
    body: 'Set a monthly budget to unlock pacing insights and overspend alerts.',
    cta: { label: 'Show me where', href: '/transactions' },
  }
}

export function InsightCard({ summary, insights, generatedAt, onSeeTransactions, onNavigate }: InsightCardProps) {
  const [index, setIndex] = useState(0)
  const list = insights ?? []
  const exhausted = list.length > 0 && index >= list.length
  const current: Insight | null = list.length > 0 && !exhausted ? list[index] : null
  const view: InsightView | null = current ?? (list.length === 0 ? fallbackInsight(summary) : null)

  const timeLabel = generatedAt
    ? new Date(generatedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
    : null

  const handleCta = (href: string) => {
    if (onNavigate) onNavigate(href)
    else if (href === '/transactions') onSeeTransactions?.()
  }

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
        {list.length > 1 && !exhausted && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg3)' }}>
            {index + 1}/{list.length}
          </span>
        )}
        <span style={{ flex: 1 }} />
        {timeLabel && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg3)' }}>generated {timeLabel}</span>
        )}
      </div>

      {exhausted ? (
        <>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 500, lineHeight: 1.25, color: 'var(--fg)', letterSpacing: '-0.01em' }}>
            <CheckCircle2 size={20} style={{ color: 'var(--good)', flexShrink: 0 }} />
            You&apos;re all caught up.
          </h3>
          <p style={{ margin: '12px 0 0', fontFamily: 'var(--font-sans)', fontSize: 13, lineHeight: 1.55, color: 'var(--fg2)' }}>
            No more insights right now — check back after new activity.
          </p>
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
            <Button variant="ghost" size="sm" onClick={() => setIndex(0)}>
              Show again
            </Button>
          </div>
        </>
      ) : view ? (
        <>
          <h3 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 500, lineHeight: 1.25, color: 'var(--fg)', letterSpacing: '-0.01em' }}>
            {view.headline.lead}
            <span style={{ color: 'var(--accent-a)' }}>{view.headline.accent}</span>
            {view.headline.tail}
          </h3>
          <p style={{ margin: '12px 0 0', fontFamily: 'var(--font-sans)', fontSize: 13, lineHeight: 1.55, color: 'var(--fg2)' }}>{view.body}</p>
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
            {view.cta && (
              <Button variant="primary" size="sm" onClick={() => handleCta(view.cta!.href)}>
                {view.cta.label}
              </Button>
            )}
            {current && (
              <Button variant="ghost" size="sm" onClick={() => setIndex((i) => i + 1)}>
                Dismiss
              </Button>
            )}
          </div>
        </>
      ) : null}
    </Card>
  )
}
