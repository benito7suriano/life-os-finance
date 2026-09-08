import { describe, it, expect } from 'vitest'
import { mockSupabase, opsFor, filterArg } from '@/lib/test-utils/mock-supabase'
import { computeFinanceSummary } from '../summary'

// Fixture: Sep 2026, one checking account, one DOP credit card, two parent
// categories (one with a child), one budget on the parent.
const NOW = new Date(2026, 8, 15) // Sep 15 2026

function fixture() {
  return mockSupabase((op) => {
    switch (op.table) {
      case 'accounts':
        return {
          data: [
            { id: 'a1', type: 'checking', balance: 1500, currency: 'USD' },
            { id: 'a2', type: 'credit_card', balance: -11800, currency: 'DOP' }, // -200 USD
          ],
        }
      case 'budgets':
        return { data: [{ id: 'b1', amount: 400, type: 'monthly', category_id: 'food' }] }
      case 'budget_monthly_snapshots':
        return { data: [{ budget_id: 'b1', budgeted_amount: 450 }] }
      case 'categories':
        return {
          data: [
            { id: 'food', name: 'Food', parent_id: null, color: '#f00' },
            { id: 'groceries', name: 'Groceries', parent_id: 'food', color: null },
            { id: 'fun', name: 'Fun', parent_id: null, color: null },
            { id: 'adj', name: 'Balance Adjustment', parent_id: null, color: null },
          ],
        }
      case 'transactions': {
        // fetchTransactionsPaged reads pages via .range(); one page suffices.
        const from = (op.filters.range?.[0]?.[0] as number) ?? 0
        if (from > 0) return { data: [] }
        return {
          data: [
            { date: '2026-09-02', amount: 100, currency: 'USD', category_id: 'food', type: 'expense' },
            { date: '2026-09-05', amount: 50, currency: 'USD', category_id: 'groceries', type: 'expense' },
            { date: '2026-09-06', amount: 30, currency: 'USD', category_id: 'fun', type: 'expense' },
            { date: '2026-09-07', amount: 999, currency: 'USD', category_id: 'adj', type: 'expense' },
            { date: '2026-09-01', amount: 3000, currency: 'USD', category_id: null, type: 'income' },
            { date: '2026-08-10', amount: 200, currency: 'USD', category_id: 'fun', type: 'expense' },
          ],
        }
      }
      default:
        return { data: [] }
    }
  })
}

describe('computeFinanceSummary', () => {
  it('produces the same shape and numbers the dashboard summary route returns', async () => {
    const { supabase, ops } = fixture()
    const s = await computeFinanceSummary(supabase, 'u1', NOW)

    expect(s.netWorth).toBe(1300)
    expect(s.assets).toBe(1500)
    expect(s.liabilities).toBe(200)
    expect(s.monthlyIncome).toBe(3000)
    // Balance Adjustment (999) is excluded from spend.
    expect(s.monthlyExpenses).toBe(180)
    expect(s.monthlyNet).toBe(2820)

    // Snapshot amount wins over the budget's current amount; spent is exact-category.
    expect(s.budgetVsActual).toEqual([
      { budgetId: 'b1', categoryId: 'food', type: 'monthly', budgeted: 450, spent: 100, remaining: 350 },
    ])
    expect(s.budgetProjection.totalBudget).toBe(450)
    expect(s.budgetProjection.spent).toBe(180)

    expect(s.monthlyTrend).toHaveLength(12)
    expect(s.monthlyTrend.at(-1)).toMatchObject({ period: '2026-09', income: 3000, expenses: 180 })
    expect(s.monthlyTrend.at(-2)).toMatchObject({ period: '2026-08', income: 0, expenses: 200 })

    // Child spend rolls into the parent; sorted by amount desc.
    expect(s.spendingByCategory.total).toBe(180)
    expect(s.spendingByCategory.categories.map((c) => [c.name, c.amount, c.transactionCount])).toEqual([
      ['Food', 150, 2],
      ['Fun', 30, 1],
    ])

    // Every query is scoped to the caller's user id.
    for (const table of ['accounts', 'budgets', 'budget_monthly_snapshots', 'transactions']) {
      expect(filterArg(opsFor(ops, table)[0], 'eq', 'user_id')).toBe('u1')
    }
  })
})
