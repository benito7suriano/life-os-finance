// Pure month-pacing math for the budget projection shown on the dashboard
// (InsightCard branches + BudgetGlance). All amounts are USD aggregates.

import { round2 } from './history'

export interface BudgetProjection {
  totalBudget: number
  spent: number
  remaining: number
  percentUsed: number
  daysRemaining: number
  projectedOverspend: number
  status: 'on_track' | 'warning' | 'over_budget'
}

/** Straight-line projection: spend-so-far extrapolated over the whole month. */
export function computeBudgetProjection(input: {
  totalBudget: number
  spent: number
  today?: Date
}): BudgetProjection {
  const today = input.today ?? new Date()
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
  const dayOfMonth = today.getDate()
  const daysRemaining = daysInMonth - dayOfMonth

  const totalBudget = round2(input.totalBudget)
  const spent = round2(input.spent)

  if (totalBudget <= 0) {
    return {
      totalBudget: 0,
      spent,
      remaining: 0,
      percentUsed: 0,
      daysRemaining,
      projectedOverspend: 0,
      status: 'on_track',
    }
  }

  const projected = (spent / dayOfMonth) * daysInMonth
  const projectedOverspend = round2(Math.max(0, projected - totalBudget))
  const status: BudgetProjection['status'] =
    spent > totalBudget ? 'over_budget' : projected > totalBudget ? 'warning' : 'on_track'

  return {
    totalBudget,
    spent,
    remaining: round2(totalBudget - spent),
    percentUsed: round2((spent / totalBudget) * 100),
    daysRemaining,
    projectedOverspend,
    status,
  }
}
