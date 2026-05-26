'use client'

import { useState, type CSSProperties } from 'react'
import type { Budget, Goal } from './types'
import { Badge, Progress } from '@/components/ui'
import { Star } from 'lucide-react'

interface BudgetCardProps {
  budget?: Budget
  goal?: Goal
  isCategory?: boolean
  onClick?: () => void
}

// Budgets/goals don't carry a stored color, so derive a stable tile tint from
// the name out of a small Vault-friendly palette.
const PALETTE = ['#10b981', '#14b8a6', '#f59e0b', '#f97316', '#7dd3fc', '#8b5cf6', '#ec4899', '#6366f1']
function tintFor(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return PALETTE[h % PALETTE.length]
}

export function BudgetCard({ budget, goal, isCategory = false, onClick }: BudgetCardProps) {
  const [hover, setHover] = useState(false)
  const isSinkingFund = !!goal
  const name = budget?.name ?? goal?.name ?? ''

  let progress = 0
  let displayLabel = ''
  let secondaryLabel = ''
  const budgetUnknown = !!budget && budget.budgetKnown === false

  if (budget && budgetUnknown) {
    progress = 0
    displayLabel = `$${budget.spent.toLocaleString('en-US', { minimumFractionDigits: 2 })} spent`
    secondaryLabel = 'No budget set'
  } else if (budget) {
    const total = budget.budgeted
    progress = total > 0 ? (budget.spent / total) * 100 : 0
    displayLabel = `$${budget.spent.toLocaleString('en-US', { minimumFractionDigits: 2 })} / $${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
    secondaryLabel = progress > 100 ? `${(progress - 100).toFixed(0)}% over` : `${(100 - progress).toFixed(0)}% left`
  } else if (goal) {
    const total = goal.targetAmount
    progress = total > 0 ? (goal.currentBalance / total) * 100 : 0
    displayLabel = `$${goal.currentBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })} saved`
    secondaryLabel = progress >= 100 ? 'Goal reached!' : `$${(total - goal.currentBalance).toLocaleString('en-US', { minimumFractionDigits: 2 })} to go`
  }

  const isOverBudget = !!budget && progress > 100
  const isComplete = !!goal && progress >= 100
  const tint = isSinkingFund ? 'var(--accent-a)' : tintFor(name)
  const tintBg = isSinkingFund ? 'var(--accent-soft)' : `${tint}22`

  // status badge
  let badge: { tone: 'good' | 'warn' | 'bad'; label: string }
  if (isSinkingFund) {
    badge = isComplete ? { tone: 'good', label: 'complete' } : { tone: 'good', label: 'on track' }
  } else if (isOverBudget) {
    badge = { tone: 'bad', label: 'over' }
  } else if (progress >= 85) {
    badge = { tone: 'warn', label: 'near limit' }
  } else {
    badge = { tone: 'good', label: 'on track' }
  }

  const barColor = isSinkingFund ? 'var(--accent-gradient)' : isOverBudget ? 'var(--bad)' : progress >= 85 ? 'var(--warn)' : tint

  const cardStyle: CSSProperties = {
    width: '100%',
    textAlign: 'left',
    background: 'var(--card-bg)',
    border: `1px solid ${hover ? 'var(--card-border-hi)' : 'var(--card-border)'}`,
    borderRadius: 'var(--card-radius)',
    padding: 18,
    boxShadow: 'var(--card-shadow)',
    cursor: 'pointer',
    transition: 'border-color .15s, transform .15s',
    transform: hover ? 'translateY(-1px)' : undefined,
  }

  return (
    <button onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} style={cardStyle}>
      {/* Header */}
      <div className="mb-3.5 flex items-center gap-3">
        <span
          className="flex flex-shrink-0 items-center justify-center"
          style={{ width: 36, height: 36, borderRadius: 10, background: tintBg, color: tint, fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 13 }}
        >
          {isSinkingFund ? <Star size={18} /> : name.slice(0, 2).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate" style={{ fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 500, color: 'var(--fg)' }}>
              {name}
            </span>
            {isSinkingFund && (
              <span className="flex-shrink-0 rounded px-1.5 py-0.5" style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', background: 'var(--accent-soft)', color: 'var(--accent-a)' }}>
                Fund
              </span>
            )}
            {isCategory && (
              <span className="flex-shrink-0 rounded px-1.5 py-0.5" style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', background: 'rgba(255,255,255,0.06)', color: 'var(--fg3)' }}>
                Category
              </span>
            )}
          </div>
        </div>
        <Badge tone={badge.tone} dot>
          {badge.label}
        </Badge>
      </div>

      {/* Amount */}
      <div className="mb-2" style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600, color: 'var(--fg)', letterSpacing: '-0.015em' }}>
        {displayLabel}
      </div>

      {/* Progress (with over-budget hatch) */}
      <div style={{ position: 'relative' }}>
        <Progress value={Math.min(progress, 100)} height={8} color={barColor} />
        {isOverBudget && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: 4,
              background: 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(251,113,133,0.18) 4px, rgba(251,113,133,0.18) 8px)',
            }}
          />
        )}
      </div>

      {/* Footer */}
      <div className="mt-2.5 flex justify-between" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg3)' }}>
        <span>{Math.round(Math.min(progress, 999))}% {isSinkingFund ? 'complete' : 'used'}</span>
        <span style={{ color: isOverBudget ? 'var(--bad)' : 'var(--fg2)' }}>{secondaryLabel}</span>
      </div>
    </button>
  )
}
