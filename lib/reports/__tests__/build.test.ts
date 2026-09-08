import { describe, it, expect } from 'vitest'
import { mockSupabase, type Op } from '@/lib/test-utils/mock-supabase'
import { buildReportData, reportWindow, savingsRatePct } from '../build'

const NOW = new Date(2026, 8, 15) // Tue Sep 15 2026

const CATEGORIES = [
  { id: 'food', name: 'Food', parent_id: null, color: null, type: 'expense' },
  { id: 'fun', name: 'Fun', parent_id: null, color: null, type: 'expense' },
  { id: 'adj', name: 'Balance Adjustment', parent_id: null, color: null, type: 'expense' },
]

function tx(id: string, date: string, type: string, amount: number, category_id: string | null, merchant: string | null) {
  return {
    id, date, type, amount, currency: 'USD', description: '', category_id, to_amount: null, to_currency: null,
    category: category_id ? { name: CATEGORIES.find((c) => c.id === category_id)!.name, parent_id: null } : null,
    merchant: merchant ? { name: merchant } : null,
    from_account: type === 'expense' ? { name: 'Visa' } : null,
    to_account: type === 'income' ? { name: 'Checking' } : null,
  }
}

const TRANSACTIONS = [
  // Last week (Sep 8–14)
  tx('w1', '2026-09-09', 'expense', 120, 'food', 'Supermercado'),
  tx('w2', '2026-09-11', 'expense', 45, 'fun', 'Cinema'),
  tx('w3', '2026-09-12', 'income', 500, null, null),
  tx('w4', '2026-09-13', 'expense', 999, 'adj', null),
  // Earlier this month (outside the weekly window)
  tx('m1', '2026-09-02', 'expense', 60, 'food', 'Cafe'),
  // August 2026 (the monthly window)
  tx('a1', '2026-08-01', 'income', 1000, null, null),
  tx('a2', '2026-08-10', 'expense', 200, 'fun', 'Ticketmaster'),
  tx('a3', '2026-08-20', 'expense', 50, 'food', 'Cafe'),
  // July 2026
  tx('j1', '2026-07-05', 'expense', 100, 'food', 'Cafe'),
  tx('j2', '2026-07-01', 'income', 900, null, null),
  // August 2025
  tx('y1', '2025-08-15', 'expense', 400, 'fun', 'Concert'),
  tx('y2', '2025-08-01', 'income', 800, null, null),
]

function applyFilters<T extends Record<string, unknown>>(rows: T[], op: Op): T[] {
  let out = rows
  for (const [col, val] of op.filters.eq ?? []) {
    if (col === 'user_id') continue
    out = out.filter((r) => r[col as string] === val)
  }
  for (const [col, vals] of op.filters.in ?? []) out = out.filter((r) => (vals as unknown[]).includes(r[col as string]))
  for (const [col, val] of op.filters.gte ?? []) out = out.filter((r) => (r[col as string] as string) >= (val as string))
  for (const [col, val] of op.filters.lte ?? []) out = out.filter((r) => (r[col as string] as string) <= (val as string))
  for (const [col, val] of op.filters.lt ?? []) out = out.filter((r) => (r[col as string] as string) < (val as string))
  return out
}

function fixture() {
  return mockSupabase((op) => {
    switch (op.table) {
      case 'categories':
        return { data: applyFilters(CATEGORIES, op) }
      case 'transactions': {
        const from = (op.filters.range?.[0]?.[0] as number) ?? 0
        return { data: from > 0 ? [] : applyFilters(TRANSACTIONS, op) }
      }
      case 'accounts':
        return { data: [{ id: 'a1', name: 'Checking', type: 'checking', balance: 1000, currency: 'USD', payment_date: null, credit_limit: null, original_amount: null, institution: null }] }
      case 'budgets':
        return { data: [{ id: 'b1', amount: 100, type: 'monthly', category_id: 'fun', category: { id: 'fun', name: 'Fun', parent_id: null } }] }
      case 'budget_monthly_snapshots':
        return { data: [] }
      case 'account_balance_snapshots': {
        const all = [
          { snapshot_date: '2026-08-01', account_type: 'checking', balance_usd: 900 },
          { snapshot_date: '2026-08-31', account_type: 'checking', balance_usd: 950 },
          { snapshot_date: '2026-09-08', account_type: 'checking', balance_usd: 960 },
          { snapshot_date: '2026-09-14', account_type: 'checking', balance_usd: 1000 },
        ]
        return { data: applyFilters(all, op) }
      }
      default:
        return { data: [] }
    }
  })
}

describe('reportWindow', () => {
  it('weekly covers the 7 days ending yesterday', () => {
    expect(reportWindow('weekly', NOW)).toEqual({ from: '2026-09-08', to: '2026-09-14', label: 'Sep 8 – Sep 14, 2026' })
  })

  it('monthly covers the previous calendar month, across a year boundary too', () => {
    expect(reportWindow('monthly', NOW)).toEqual({ from: '2026-08-01', to: '2026-08-31', label: 'August 2026' })
    expect(reportWindow('monthly', new Date(2026, 0, 1))).toEqual({ from: '2025-12-01', to: '2025-12-31', label: 'December 2025' })
  })
})

describe('savingsRatePct', () => {
  it('is (income − expenses) / income, null without income', () => {
    expect(savingsRatePct(1000, 250)).toBe(75)
    expect(savingsRatePct(0, 250)).toBeNull()
  })
})

describe('buildReportData — weekly', () => {
  it('summarises last week: totals, top expenses, categories, budget risk, net-worth delta', async () => {
    const { supabase } = fixture()
    const data = await buildReportData(supabase, 'u1', 'weekly', NOW)
    if (data.kind !== 'weekly') throw new Error('expected weekly')

    expect(data.window).toEqual({ from: '2026-09-08', to: '2026-09-14', label: 'Sep 8 – Sep 14, 2026' })
    expect(data.totals).toEqual({ incomeUsd: 500, expensesUsd: 165, netUsd: 335 })
    expect(data.topExpenses.map((t) => [t.merchant, t.amountUsd])).toEqual([
      ['Supermercado', 120],
      ['Cinema', 45],
    ])
    expect(data.spendingByCategory.map((c) => [c.name, c.amountUsd])).toEqual([
      ['Food', 120],
      ['Fun', 45],
    ])
    // Fun budget: 45 spent of 100 by day 15 → projected 90 → on track; nothing at risk.
    expect(data.budget.month).toBe('2026-09')
    expect(data.budget.atRisk).toEqual([])
    expect(data.netWorth).toEqual({
      current: { date: '2026-09-14', assets: 1000, liabilities: 0, netWorth: 1000 },
      previous: { date: '2026-09-08', assets: 960, liabilities: 0, netWorth: 960 },
      changeUsd: 40,
      historyBeginsAt: '2026-09-08',
    })
    expect(data.insights.length).toBeGreaterThan(0)
    expect(data.insights.length).toBeLessThanOrEqual(3)
  })
})

describe('buildReportData — monthly', () => {
  it('summarises last month with MoM and YoY comparisons and last month\'s budgets', async () => {
    const { supabase } = fixture()
    const data = await buildReportData(supabase, 'u1', 'monthly', NOW)
    if (data.kind !== 'monthly') throw new Error('expected monthly')

    expect(data.window).toEqual({ from: '2026-08-01', to: '2026-08-31', label: 'August 2026' })
    expect(data.month).toEqual({ period: '2026-08', label: 'Aug 2026', incomeUsd: 1000, expensesUsd: 250, netUsd: 750, savingsRatePct: 75 })
    expect(data.previousMonth).toMatchObject({ period: '2026-07', incomeUsd: 900, expensesUsd: 100 })
    expect(data.monthOverMonth).toEqual({ expensesChangePct: 150, incomeChangePct: 11.11 })
    expect(data.yearOverYear).toEqual({
      period: '2026-08',
      comparedTo: '2025-08',
      expenses: { current: 250, previous: 400, changePct: -37.5 },
      income: { current: 1000, previous: 800, changePct: 25 },
    })
    expect(data.topCategories.map((c) => [c.name, c.amountUsd])).toEqual([
      ['Fun', 200],
      ['Food', 50],
    ])
    expect(data.topExpenses[0]).toMatchObject({ merchant: 'Ticketmaster', amountUsd: 200 })
    // August's Fun budget was blown: 200 of 100, evaluated over the full month.
    expect(data.budget.month).toBe('2026-08')
    expect(data.budget.budgets).toEqual([
      expect.objectContaining({ category: 'Fun', budgeted: 100, spent: 200, status: 'over_budget', projectedMonthEnd: 200 }),
    ])
    expect(data.netWorth).toEqual({
      start: { date: '2026-08-01', assets: 900, liabilities: 0, netWorth: 900 },
      end: { date: '2026-08-31', assets: 950, liabilities: 0, netWorth: 950 },
      changeUsd: 50,
      changePct: 5.56,
      historyBeginsAt: '2026-08-01',
    })
  })
})
