// Deterministic insight rules — v1 of the "AI Insights" engine. Pure functions
// over InsightInput so every rule is unit-testable with fixtures. Each rule
// returns zero or more scored insights; buildInsights ranks them. An LLM
// phrasing/generation layer can slot in on top later without touching these.

import { computeBudgetProjection } from '@/lib/finance/projection'
import type { Insight, InsightInput } from './types'

/** USD formatter for insight copy (magnitudes only — direction is in the words). */
function usd(n: number): string {
  return (
    '$' +
    Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  )
}

function periodIdOf(today: Date): string {
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
}

export function budgetPacingRule(input: InsightInput): Insight | null {
  if (!input.budget || input.budget.totalBudget <= 0) return null
  const p = computeBudgetProjection({ ...input.budget, today: input.today })
  const period = periodIdOf(input.today)
  const base = { id: `budget_pacing:${period}`, kind: 'budget_pacing' as const }

  if (p.status === 'over_budget') {
    return {
      ...base,
      score: 100,
      headline: { lead: "You're over budget by ", accent: usd(p.spent - p.totalBudget), tail: ' this month.' },
      body: `You've used ${p.percentUsed.toFixed(0)}% of your ${usd(p.totalBudget)} budget with ${p.daysRemaining} days left.`,
      cta: { label: 'Review budgets', href: '/budgets' },
    }
  }
  if (p.status === 'warning') {
    return {
      ...base,
      score: 65,
      headline: { lead: "You're on pace to overspend by ", accent: usd(p.projectedOverspend), tail: ' this month.' },
      body: `You've used ${p.percentUsed.toFixed(0)}% of your budget with ${p.daysRemaining} days left. Trimming a few discretionary purchases gets you back to neutral.`,
      cta: { label: 'Review budgets', href: '/budgets' },
    }
  }
  return {
    ...base,
    score: 15,
    headline: { lead: "You're on track — ", accent: usd(p.remaining), tail: ' of budget to spare.' },
    body: `${p.percentUsed.toFixed(0)}% of budget used with ${p.daysRemaining} days remaining. Keep it up.`,
    cta: { label: 'View budgets', href: '/budgets' },
  }
}

/** Fires when a category runs ≥40% above its trailing average AND the excess is
 * at least $75 — both gates, so small categories don't produce noise. Cap 2. */
export function categoryAnomalyRules(input: InsightInput): Insight[] {
  const period = periodIdOf(input.today)
  return input.categories
    .filter(
      (c) =>
        c.avgMonthlyUsd > 0 &&
        c.spentThisMonthUsd >= 1.4 * c.avgMonthlyUsd &&
        c.spentThisMonthUsd - c.avgMonthlyUsd >= 75
    )
    .map((c) => {
      const over = c.spentThisMonthUsd - c.avgMonthlyUsd
      const pctAbove = Math.round((c.spentThisMonthUsd / c.avgMonthlyUsd - 1) * 100)
      return {
        id: `category_anomaly:${c.id}:${period}`,
        kind: 'category_anomaly' as const,
        score: 60 + Math.min(20, over / 50),
        headline: {
          lead: `${c.name} is at `,
          accent: usd(c.spentThisMonthUsd),
          tail: ` — ${pctAbove}% above your typical month.`,
        },
        body: `You usually spend about ${usd(c.avgMonthlyUsd)} on ${c.name} in a full month (12-month average).`,
        cta: { label: 'See transactions', href: '/transactions' },
      }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
}

export function ccPaymentDueRules(input: InsightInput): Insight[] {
  const daysInMonth = new Date(input.today.getFullYear(), input.today.getMonth() + 1, 0).getDate()
  const day = input.today.getDate()
  const period = periodIdOf(input.today)

  return input.creditCards
    .filter((c) => c.paymentDay != null && c.paymentDay >= 1 && c.balanceUsd < 0)
    .map((c) => {
      const paymentDay = c.paymentDay as number
      // Month-wrap: a payment day earlier than today means next month.
      const daysUntil = paymentDay >= day ? paymentDay - day : daysInMonth - day + paymentDay
      return { c, daysUntil }
    })
    .filter(({ daysUntil }) => daysUntil <= 5)
    .map(({ c, daysUntil }) => ({
      id: `cc_payment_due:${c.id}:${period}`,
      kind: 'cc_payment_due' as const,
      score: daysUntil <= 3 ? 90 : 70,
      headline: {
        lead: 'Payment for ',
        accent: c.name,
        tail: ` is due ${
          daysUntil === 0 ? 'today' : daysUntil === 1 ? 'tomorrow' : `in ${daysUntil} days`
        } — you owe ${usd(c.balanceUsd)}.`,
      },
      body: 'Schedule the transfer now to avoid interest and late fees.',
      cta: { label: 'View accounts', href: '/accounts' },
    }))
}

export function lowCashBufferRule(input: InsightInput): Insight | null {
  if (input.avgMonthlyExpensesUsd <= 0) return null
  if (input.liquidUsd >= input.avgMonthlyExpensesUsd) return null
  return {
    id: `low_cash_buffer:${periodIdOf(input.today)}`,
    kind: 'low_cash_buffer',
    score: 80,
    headline: { lead: 'Cash buffer is low — ', accent: usd(input.liquidUsd), tail: ' across cash accounts.' },
    body: `That's below one month of typical spending (${usd(input.avgMonthlyExpensesUsd)}). Consider topping up from savings or trimming discretionary spend.`,
    cta: { label: 'View accounts', href: '/accounts' },
  }
}

/** Always returns an insight, so the card is never empty. */
export function savingsRateRule(input: InsightInput): Insight {
  const period = periodIdOf(input.today)
  const saved = input.monthlyIncomeUsd - input.monthlyExpensesUsd
  const base = { id: `savings_rate:${period}`, kind: 'savings_rate' as const }

  if (saved < 0) {
    return {
      ...base,
      score: 55,
      headline: { lead: 'Spending exceeds income by ', accent: usd(saved), tail: ' this month.' },
      body:
        input.monthlyIncomeUsd > 0
          ? `You've spent ${usd(input.monthlyExpensesUsd)} against ${usd(input.monthlyIncomeUsd)} of income.`
          : 'No income logged yet this month — spending is running against savings.',
      cta: { label: 'See transactions', href: '/transactions' },
    }
  }

  const rate = input.monthlyIncomeUsd > 0 ? Math.round((saved / input.monthlyIncomeUsd) * 100) : null
  return {
    ...base,
    score: 10,
    headline: { lead: 'This month you saved ', accent: usd(saved), tail: '.' },
    body:
      rate != null
        ? `That's a ${rate}% savings rate so far this month.`
        : 'Log income to see your savings rate here.',
    cta: { label: 'See transactions', href: '/transactions' },
  }
}

/** Runs every rule, ranks descending by score, caps at 5. Guaranteed non-empty
 * (savingsRateRule always fires). */
export function buildInsights(input: InsightInput): Insight[] {
  const insights = [
    budgetPacingRule(input),
    ...categoryAnomalyRules(input),
    ...ccPaymentDueRules(input),
    lowCashBufferRule(input),
    savingsRateRule(input),
  ].filter((i): i is Insight => i != null)

  return insights.sort((a, b) => b.score - a.score).slice(0, 5)
}
