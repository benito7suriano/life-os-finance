import { describe, it, expect } from 'vitest'
import { mockSupabase } from '@/lib/test-utils/mock-supabase'
import { assembleInsightInput } from '../assemble'

const NOW = new Date(2026, 8, 15) // Sep 15 2026

function fixture() {
  return mockSupabase((op) => {
    switch (op.table) {
      case 'accounts':
        return {
          data: [
            { id: 'a1', name: 'Checking', type: 'checking', balance: 1000, currency: 'USD', payment_date: null },
            { id: 'a2', name: 'Visa', type: 'credit_card', balance: -200, currency: 'USD', payment_date: 20 },
          ],
        }
      case 'budgets':
        return { data: [{ id: 'b1', amount: 400 }] }
      case 'budget_monthly_snapshots':
        return { data: [{ budget_id: 'b1', budgeted_amount: 450 }] }
      case 'categories':
        return {
          data: [
            { id: 'food', name: 'Food', parent_id: null, color: null },
            { id: 'fun', name: 'Fun', parent_id: null, color: null },
          ],
        }
      case 'transactions': {
        const from = (op.filters.range?.[0]?.[0] as number) ?? 0
        if (from > 0) return { data: [] }
        return {
          data: [
            { date: '2026-08-10', amount: 200, currency: 'USD', category_id: 'fun', type: 'expense' },
            { date: '2026-09-02', amount: 100, currency: 'USD', category_id: 'food', type: 'expense' },
            { date: '2026-09-06', amount: 30, currency: 'USD', category_id: 'fun', type: 'expense' },
            { date: '2026-09-01', amount: 3000, currency: 'USD', category_id: null, type: 'income' },
          ],
        }
      }
      default:
        return { data: [] }
    }
  })
}

describe('assembleInsightInput', () => {
  it('builds the InsightInput exactly as /api/finance/insights does', async () => {
    const { supabase } = fixture()
    const input = await assembleInsightInput(supabase, 'u1', NOW)

    expect(input.today).toBe(NOW)
    expect(input.budget).toEqual({ totalBudget: 450, spent: 130 })
    // Trailing FULL months only — the partial current month is excluded.
    expect(input.avgMonthlyExpensesUsd).toBe(200)
    expect(input.categories).toEqual([
      { id: 'food', name: 'Food', spentThisMonthUsd: 100, avgMonthlyUsd: 50 },
      { id: 'fun', name: 'Fun', spentThisMonthUsd: 30, avgMonthlyUsd: 115 },
    ])
    expect(input.creditCards).toEqual([{ id: 'a2', name: 'Visa', paymentDay: 20, balanceUsd: -200 }])
    expect(input.liquidUsd).toBe(1000)
    expect(input.monthlyIncomeUsd).toBe(3000)
    expect(input.monthlyExpensesUsd).toBe(130)
  })

  it('reports a null budget when the user has none', async () => {
    const { supabase } = mockSupabase((op) => {
      if (op.table === 'transactions') return { data: [] }
      return { data: [] }
    })
    const input = await assembleInsightInput(supabase, 'u1', NOW)
    expect(input.budget).toBeNull()
  })
})
