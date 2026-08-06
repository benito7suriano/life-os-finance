import { describe, it, expect } from 'vitest'
import {
  buildInsights,
  budgetPacingRule,
  categoryAnomalyRules,
  ccPaymentDueRules,
  lowCashBufferRule,
  savingsRateRule,
} from '../rules'
import type { InsightInput } from '../types'

// August 10, 2026 — 31-day month, 21 days remaining.
const TODAY = new Date(2026, 7, 10)

function baseInput(overrides: Partial<InsightInput> = {}): InsightInput {
  return {
    today: TODAY,
    budget: null,
    categories: [],
    creditCards: [],
    liquidUsd: 10_000,
    avgMonthlyExpensesUsd: 2_000,
    monthlyIncomeUsd: 5_000,
    monthlyExpensesUsd: 3_000,
    ...overrides,
  }
}

describe('budgetPacingRule', () => {
  it('returns null without a budget', () => {
    expect(budgetPacingRule(baseInput())).toBeNull()
  })

  it('scores over_budget at 100', () => {
    const insight = budgetPacingRule(baseInput({ budget: { totalBudget: 1000, spent: 1200 } }))!
    expect(insight.score).toBe(100)
    expect(insight.headline.accent).toBe('$200.00')
  })

  it('scores pacing warnings at 65 with the projected overspend', () => {
    // 1000/10 days → 3100 projected vs 2000 budget.
    const insight = budgetPacingRule(baseInput({ budget: { totalBudget: 2000, spent: 1000 } }))!
    expect(insight.score).toBe(65)
    expect(insight.headline.accent).toBe('$1,100.00')
    expect(insight.cta?.href).toBe('/budgets')
  })

  it('emits a low-score on-track insight otherwise', () => {
    const insight = budgetPacingRule(baseInput({ budget: { totalBudget: 2000, spent: 300 } }))!
    expect(insight.score).toBe(15)
  })
})

describe('categoryAnomalyRules', () => {
  it('requires BOTH the 1.4x ratio and the $75 excess', () => {
    const input = baseInput({
      categories: [
        // ratio ok (2x) but excess only $50 → no
        { id: 'a', name: 'Coffee', spentThisMonthUsd: 100, avgMonthlyUsd: 50 },
        // excess ok ($200) but ratio only 1.2x → no
        { id: 'b', name: 'Groceries', spentThisMonthUsd: 1200, avgMonthlyUsd: 1000 },
        // both → yes
        { id: 'c', name: 'Dining', spentThisMonthUsd: 500, avgMonthlyUsd: 300 },
      ],
    })
    const insights = categoryAnomalyRules(input)
    expect(insights).toHaveLength(1)
    expect(insights[0].id).toContain('category_anomaly:c')
    expect(insights[0].headline.tail).toContain('67% above')
  })

  it('caps at the two largest anomalies', () => {
    // Overshoots of $200/$400/$600 keep scores under the +20 cap so the
    // ordering reflects magnitude: C (72) > B (68) > A (64).
    const categories = ['a', 'b', 'c'].map((id, i) => ({
      id,
      name: id.toUpperCase(),
      spentThisMonthUsd: 300 + i * 200,
      avgMonthlyUsd: 100,
    }))
    const insights = categoryAnomalyRules(baseInput({ categories }))
    expect(insights).toHaveLength(2)
    expect(insights[0].headline.lead).toBe('C is at ')
    expect(insights[1].headline.lead).toBe('B is at ')
  })
})

describe('ccPaymentDueRules', () => {
  it('fires only for cards in debt with a payment day within 5 days', () => {
    const input = baseInput({
      creditCards: [
        { id: '1', name: 'Visa', paymentDay: 12, balanceUsd: -674 }, // in 2 days → 90
        { id: '2', name: 'Amex', paymentDay: 15, balanceUsd: -100 }, // in 5 days → 70
        { id: '3', name: 'Paid-off', paymentDay: 11, balanceUsd: 0 }, // no debt → skip
        { id: '4', name: 'Far', paymentDay: 25, balanceUsd: -50 }, // 15 days → skip
      ],
    })
    const insights = ccPaymentDueRules(input)
    expect(insights.map((i) => i.score)).toEqual([90, 70])
    expect(insights[0].headline.tail).toContain('in 2 days')
    expect(insights[0].headline.tail).toContain('$674.00')
  })

  it('wraps into next month when the payment day already passed', () => {
    // Today Aug 10; payment day 5 → Sep 5 is 26 days away → no insight.
    const none = ccPaymentDueRules(
      baseInput({ creditCards: [{ id: '1', name: 'V', paymentDay: 5, balanceUsd: -10 }] })
    )
    expect(none).toHaveLength(0)
    // Aug 30 → payment day 2 wraps to Sep 2 = 3 days → fires at 90.
    const wrapped = ccPaymentDueRules(
      baseInput({
        today: new Date(2026, 7, 30),
        creditCards: [{ id: '1', name: 'V', paymentDay: 2, balanceUsd: -10 }],
      })
    )
    expect(wrapped).toHaveLength(1)
    expect(wrapped[0].score).toBe(90)
  })
})

describe('lowCashBufferRule', () => {
  it('fires when liquid funds fall below one typical month of spending', () => {
    const insight = lowCashBufferRule(baseInput({ liquidUsd: 1500, avgMonthlyExpensesUsd: 2000 }))!
    expect(insight.score).toBe(80)
    expect(insight.headline.accent).toBe('$1,500.00')
  })

  it('stays quiet with a healthy buffer or no history', () => {
    expect(lowCashBufferRule(baseInput({ liquidUsd: 5000, avgMonthlyExpensesUsd: 2000 }))).toBeNull()
    expect(lowCashBufferRule(baseInput({ avgMonthlyExpensesUsd: 0 }))).toBeNull()
  })
})

describe('savingsRateRule', () => {
  it('celebrates positive savings with the rate', () => {
    const insight = savingsRateRule(baseInput({ monthlyIncomeUsd: 5000, monthlyExpensesUsd: 3000 }))
    expect(insight.score).toBe(10)
    expect(insight.headline.accent).toBe('$2,000.00')
    expect(insight.body).toContain('40%')
  })

  it('escalates when spending exceeds income', () => {
    const insight = savingsRateRule(baseInput({ monthlyIncomeUsd: 1000, monthlyExpensesUsd: 1500 }))
    expect(insight.score).toBe(55)
    expect(insight.headline.lead).toBe('Spending exceeds income by ')
    expect(insight.headline.accent).toBe('$500.00')
  })
})

describe('buildInsights', () => {
  it('always returns at least one insight, ranked by score', () => {
    const insights = buildInsights(baseInput())
    expect(insights.length).toBeGreaterThanOrEqual(1)
    const scores = insights.map((i) => i.score)
    expect(scores).toEqual([...scores].sort((a, b) => b - a))
  })

  it('caps the list at 5 with the strongest signals first', () => {
    const input = baseInput({
      budget: { totalBudget: 1000, spent: 1200 }, // 100
      liquidUsd: 100, // 80
      categories: [
        { id: 'a', name: 'A', spentThisMonthUsd: 1000, avgMonthlyUsd: 100 },
        { id: 'b', name: 'B', spentThisMonthUsd: 900, avgMonthlyUsd: 100 },
      ], // 2 anomalies
      creditCards: [
        { id: '1', name: 'V1', paymentDay: 11, balanceUsd: -10 }, // 90
        { id: '2', name: 'V2', paymentDay: 15, balanceUsd: -10 }, // 70
      ],
      monthlyIncomeUsd: 100,
      monthlyExpensesUsd: 500, // savings 55
    })
    const insights = buildInsights(input)
    expect(insights).toHaveLength(5)
    expect(insights[0].kind).toBe('budget_pacing')
    expect(insights[0].score).toBe(100)
  })
})
