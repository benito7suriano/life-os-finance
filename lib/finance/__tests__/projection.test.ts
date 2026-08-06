import { describe, it, expect } from 'vitest'
import { computeBudgetProjection } from '../projection'

// August 2026 has 31 days.
const AUG_10 = new Date(2026, 7, 10)

describe('computeBudgetProjection', () => {
  it('reports on_track when the pace stays under budget', () => {
    // $500 by day 10 → projects to $1,550 over 31 days; budget $2,000.
    const p = computeBudgetProjection({ totalBudget: 2000, spent: 500, today: AUG_10 })
    expect(p.status).toBe('on_track')
    expect(p.remaining).toBe(1500)
    expect(p.percentUsed).toBe(25)
    expect(p.daysRemaining).toBe(21)
    expect(p.projectedOverspend).toBe(0)
  })

  it('warns when the pace projects past the budget', () => {
    // $1,000 by day 10 → projects to $3,100; budget $2,000 → $1,100 overspend.
    const p = computeBudgetProjection({ totalBudget: 2000, spent: 1000, today: AUG_10 })
    expect(p.status).toBe('warning')
    expect(p.projectedOverspend).toBe(1100)
  })

  it('flags over_budget once spent exceeds the budget outright', () => {
    const p = computeBudgetProjection({ totalBudget: 2000, spent: 2100, today: AUG_10 })
    expect(p.status).toBe('over_budget')
    expect(p.remaining).toBe(-100)
  })

  it('handles day 1 without dividing by zero', () => {
    const p = computeBudgetProjection({ totalBudget: 310, spent: 20, today: new Date(2026, 7, 1) })
    // 20/1 * 31 = 620 projected → warning
    expect(p.status).toBe('warning')
    expect(p.projectedOverspend).toBe(310)
    expect(p.daysRemaining).toBe(30)
  })

  it('is neutral on the last day when exactly on budget', () => {
    const p = computeBudgetProjection({ totalBudget: 310, spent: 310, today: new Date(2026, 7, 31) })
    expect(p.status).toBe('on_track')
    expect(p.daysRemaining).toBe(0)
  })

  it('returns zeroed on_track shape when there is no budget', () => {
    const p = computeBudgetProjection({ totalBudget: 0, spent: 123, today: AUG_10 })
    expect(p).toMatchObject({ totalBudget: 0, remaining: 0, percentUsed: 0, projectedOverspend: 0, status: 'on_track' })
  })
})
