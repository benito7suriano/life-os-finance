import { describe, it, expect, vi } from 'vitest'
import { mockSupabase, opsFor, filterArg, type Op } from '@/lib/test-utils/mock-supabase'
import {
  TOOL_DEFINITIONS,
  executeTool,
  getBudgetStatus,
  getInsights,
  getMonthlyCashflow,
  getNetWorthHistory,
  getSpendingByCategory,
  queryTransactions,
  yearOverYear,
  type ToolContext,
} from '../tools'

const NOW = new Date(2026, 8, 15) // Sep 15 2026

const CATEGORIES = [
  { id: 'food', name: 'Food', parent_id: null, color: null, type: 'expense' },
  { id: 'groceries', name: 'Groceries', parent_id: 'food', color: null, type: 'expense' },
  { id: 'fun', name: 'Fun', parent_id: null, color: null, type: 'expense' },
  { id: 'adj', name: 'Balance Adjustment', parent_id: null, color: null, type: 'expense' },
  { id: 'salary', name: 'Salary', parent_id: null, color: null, type: 'income' },
]

const TRANSACTIONS = [
  {
    id: 't1', date: '2026-09-01', amount: 100, currency: 'USD', type: 'expense', description: 'ride',
    category_id: 'food', category: { name: 'Food', parent_id: null }, merchant: { name: 'Uber Eats' },
    from_account: { name: 'Visa' }, to_account: null, to_amount: null, to_currency: null,
  },
  {
    id: 't2', date: '2026-09-02', amount: 11800, currency: 'DOP', type: 'expense', description: '',
    category_id: 'groceries', category: { name: 'Groceries', parent_id: 'food' }, merchant: { name: 'Supermercado Nacional' },
    from_account: { name: 'Popular' }, to_account: null, to_amount: null, to_currency: null,
  },
  {
    id: 't3', date: '2026-09-03', amount: 999, currency: 'USD', type: 'expense', description: 'reconcile',
    category_id: 'adj', category: { name: 'Balance Adjustment', parent_id: null }, merchant: null,
    from_account: { name: 'Visa' }, to_account: null, to_amount: null, to_currency: null,
  },
  {
    id: 't4', date: '2026-09-06', amount: 30, currency: 'USD', type: 'expense', description: 'cinema',
    category_id: 'fun', category: { name: 'Fun', parent_id: null }, merchant: { name: 'Caribbean Cinemas' },
    from_account: { name: 'Visa' }, to_account: null, to_amount: null, to_currency: null,
  },
  {
    id: 't5', date: '2026-09-04', amount: 3000, currency: 'USD', type: 'income', description: 'payroll',
    category_id: 'salary', category: { name: 'Salary', parent_id: null }, merchant: null,
    from_account: null, to_account: { name: 'Checking' }, to_amount: null, to_currency: null,
  },
  {
    id: 't6', date: '2026-08-10', amount: 200, currency: 'USD', type: 'expense', description: 'concert',
    category_id: 'fun', category: { name: 'Fun', parent_id: null }, merchant: { name: 'Ticketmaster' },
    from_account: { name: 'Visa' }, to_account: null, to_amount: null, to_currency: null,
  },
]

/** Applies the recorded eq/in/gte/lte/lt filters to the fixture so tests
 * exercise real filtering, not just "the responder returned rows". */
function applyFilters<T extends Record<string, unknown>>(rows: T[], op: Op): T[] {
  let out = rows
  for (const [col, val] of op.filters.eq ?? []) {
    if (col === 'user_id') continue
    out = out.filter((r) => r[col as string] === val)
  }
  for (const [col, vals] of op.filters.in ?? []) {
    out = out.filter((r) => (vals as unknown[]).includes(r[col as string]))
  }
  for (const [col, val] of op.filters.gte ?? []) out = out.filter((r) => (r[col as string] as string) >= (val as string))
  for (const [col, val] of op.filters.lte ?? []) out = out.filter((r) => (r[col as string] as string) <= (val as string))
  for (const [col, val] of op.filters.lt ?? []) out = out.filter((r) => (r[col as string] as string) < (val as string))
  return out
}

function ctx(extra: Partial<ToolContext> = {}) {
  const { supabase, ops } = mockSupabase((op) => {
    switch (op.table) {
      case 'categories':
        return { data: applyFilters(CATEGORIES, op) }
      case 'transactions': {
        const from = (op.filters.range?.[0]?.[0] as number) ?? 0
        return { data: from > 0 ? [] : applyFilters(TRANSACTIONS, op) }
      }
      case 'budgets':
        return {
          data: [
            { id: 'b1', amount: 400, type: 'monthly', category_id: 'food', category: { id: 'food', name: 'Food', parent_id: null } },
            { id: 'b2', amount: 100, type: 'monthly', category_id: 'groceries', category: { id: 'groceries', name: 'Groceries', parent_id: 'food' } },
            { id: 'b3', amount: 50, type: 'monthly', category_id: 'fun', category: { id: 'fun', name: 'Fun', parent_id: null } },
          ],
        }
      case 'budget_monthly_snapshots':
        return { data: [{ budget_id: 'b1', budgeted_amount: 450 }] }
      case 'account_balance_snapshots':
        return {
          data: [
            { snapshot_date: '2026-09-05', account_type: 'checking', balance_usd: 1000 },
            { snapshot_date: '2026-09-07', account_type: 'checking', balance_usd: 1100 },
            { snapshot_date: '2026-09-07', account_type: 'credit_card', balance_usd: -50 },
          ],
        }
      default:
        return { data: [] }
    }
  })
  const context: ToolContext = { supabase, userId: 'u1', now: NOW, ...extra }
  return { context, ops }
}

describe('TOOL_DEFINITIONS', () => {
  it('are strict, closed schemas whose descriptions say when to call them', () => {
    expect(TOOL_DEFINITIONS.length).toBeGreaterThanOrEqual(9)
    for (const tool of TOOL_DEFINITIONS) {
      expect(tool.strict, tool.name).toBe(true)
      expect(tool.input_schema.additionalProperties, tool.name).toBe(false)
      expect(tool.description ?? '', tool.name).toMatch(/(Call|Use) this when/)
    }
  })
})

describe('queryTransactions', () => {
  it('ranks by USD amount across currencies and excludes bookkeeping rows', async () => {
    const { context } = ctx()
    const result = await queryTransactions(context, { type: 'expense', sort: 'amount', limit: 5, from_date: '2026-09-01' })
    expect(result.transactions.map((t) => [t.merchant, t.amountUsd])).toEqual([
      ['Supermercado Nacional', 200],
      ['Uber Eats', 100],
      ['Caribbean Cinemas', 30],
    ])
    expect(result.count).toBe(3)
    expect(result.totalUsd).toBe(330)
    expect(result.transactions[0]).toMatchObject({
      date: '2026-09-02', amount: 11800, currency: 'DOP', category: 'Groceries', account: 'Popular',
    })
  })

  it('defaults the window to the last 90 days and applies the limit', async () => {
    const { context, ops } = ctx()
    const result = await queryTransactions(context, { limit: 2 })
    const op = opsFor(ops, 'transactions')[0]
    expect(filterArg(op, 'gte', 'date')).toBe('2026-06-17')
    expect(filterArg(op, 'lte', 'date')).toBe('2026-09-15')
    expect(result.transactions).toHaveLength(2)
    // Newest first by default.
    expect(result.transactions[0].date).toBe('2026-09-06')
  })

  it('matches a category name against the parent and its children', async () => {
    const { context, ops } = ctx()
    const result = await queryTransactions(context, { category: 'food', from_date: '2026-09-01' })
    expect(filterArg(opsFor(ops, 'transactions')[0], 'in', 'category_id')).toEqual(['food', 'groceries'])
    expect(result.count).toBe(2)
  })

  it('filters by merchant or description text', async () => {
    const { context } = ctx()
    const byMerchant = await queryTransactions(context, { merchant_contains: 'uber', from_date: '2026-09-01' })
    expect(byMerchant.transactions.map((t) => t.merchant)).toEqual(['Uber Eats'])
    const byDescription = await queryTransactions(context, { merchant_contains: 'cinema', from_date: '2026-09-01' })
    expect(byDescription.transactions.map((t) => t.merchant)).toEqual(['Caribbean Cinemas'])
  })
})

describe('getMonthlyCashflow', () => {
  it('returns one zero-filled row per month with net, oldest first', async () => {
    const { context, ops } = ctx()
    const result = await getMonthlyCashflow(context, { months: 3 })
    expect(result.months).toEqual([
      { period: '2026-07', label: 'Jul 2026', income: 0, expenses: 0, net: 0 },
      { period: '2026-08', label: 'Aug 2026', income: 0, expenses: 200, net: -200 },
      { period: '2026-09', label: 'Sep 2026', income: 3000, expenses: 330, net: 2670 },
    ])
    const op = opsFor(ops, 'transactions')[0]
    expect(filterArg(op, 'gte', 'date')).toBe('2026-07-01')
    expect(filterArg(op, 'lt', 'date')).toBe('2026-10-01')
    expect(result.yearOverYear).toBeNull()
  })

  it('caps the window at 36 months', async () => {
    const { context, ops } = ctx()
    await getMonthlyCashflow(context, { months: 120 })
    expect(filterArg(opsFor(ops, 'transactions')[0], 'gte', 'date')).toBe('2023-10-01')
  })
})

describe('yearOverYear', () => {
  it('compares the latest full month to the same month a year earlier', () => {
    const months = [
      { period: '2025-08', label: 'Aug 2025', income: 1000, expenses: 500, net: 500 },
      { period: '2025-09', label: 'Sep 2025', income: 1000, expenses: 400, net: 600 },
      { period: '2026-08', label: 'Aug 2026', income: 1200, expenses: 600, net: 600 },
      { period: '2026-09', label: 'Sep 2026', income: 900, expenses: 100, net: 800 },
    ]
    expect(yearOverYear(months, '2026-08')).toEqual({
      period: '2026-08',
      comparedTo: '2025-08',
      expenses: { current: 600, previous: 500, changePct: 20 },
      income: { current: 1200, previous: 1000, changePct: 20 },
    })
    expect(yearOverYear(months, '2025-09')).toBeNull()
  })
})

describe('getSpendingByCategory', () => {
  it('rolls child spend into parents with a subcategory breakdown', async () => {
    const { context, ops } = ctx()
    const result = await getSpendingByCategory(context, { from_date: '2026-09-01', to_date: '2026-09-30' })
    const op = opsFor(ops, 'transactions')[0]
    expect(filterArg(op, 'gte', 'date')).toBe('2026-09-01')
    expect(filterArg(op, 'lt', 'date')).toBe('2026-10-01')
    expect(result.totalUsd).toBe(330)
    expect(result.categories).toEqual([
      { name: 'Food', amountUsd: 300, percent: 90.91, transactionCount: 2, subcategories: [{ name: 'Groceries', amountUsd: 200 }] },
      { name: 'Fun', amountUsd: 30, percent: 9.09, transactionCount: 1, subcategories: [] },
    ])
  })
})

describe('getBudgetStatus', () => {
  it('sums children into parent budgets, paces each one, and sorts by risk', async () => {
    const { context } = ctx()
    const result = await getBudgetStatus(context)
    expect(result.month).toBe('2026-09')
    expect(result.totalBudgeted).toBe(600)
    expect(result.totalSpent).toBe(330)
    // over_budget first, then warnings by percent used (Food 66.7% > Fun 60%).
    expect(result.budgets.map((b) => [b.category, b.budgeted, b.spent, b.status])).toEqual([
      ['Groceries', 100, 200, 'over_budget'],
      ['Food', 450, 300, 'warning'],
      ['Fun', 50, 30, 'warning'],
    ])
    const fun = result.budgets.find((b) => b.category === 'Fun')!
    expect(fun.projectedMonthEnd).toBe(60)
    expect(fun.percentUsed).toBe(60)
  })

  it('evaluates a past month over its full length', async () => {
    const { context, ops } = ctx()
    const result = await getBudgetStatus(context, { month: '2026-08' })
    expect(result.month).toBe('2026-08')
    expect(result.daysRemaining).toBe(0)
    expect(filterArg(opsFor(ops, 'budget_monthly_snapshots')[0], 'eq', 'month')).toBe('2026-08-01')
    const op = opsFor(ops, 'transactions')[0]
    expect(filterArg(op, 'gte', 'date')).toBe('2026-08-01')
    expect(filterArg(op, 'lt', 'date')).toBe('2026-09-01')
    // Fun: 200 spent of 50 in August; no extrapolation beyond the actual spend.
    const fun = result.budgets.find((b) => b.category === 'Fun')!
    expect(fun).toMatchObject({ spent: 200, projectedMonthEnd: 200, status: 'over_budget' })
  })
})

describe('getInsights', () => {
  it('flattens the three-part headline without a space before punctuation', async () => {
    const { context } = ctx()
    const result = await getInsights(context)
    const savings = result.insights.find((i) => i.kind === 'savings_rate')!
    expect(savings.headline).toMatch(/^This month you saved \$[\d,.]+\.$/)
    expect(savings.headline).not.toMatch(/\s[.,!?]/)
  })
})

describe('getNetWorthHistory', () => {
  it('reports where history begins when snapshots start after the requested window', async () => {
    const { context } = ctx()
    const result = await getNetWorthHistory(context, { from_date: '2026-08-01' })
    expect(result.from).toBe('2026-08-01')
    expect(result.to).toBe('2026-09-15')
    expect(result.historyBeginsAt).toBe('2026-09-05')
    expect(result.start).toMatchObject({ date: '2026-09-05', netWorth: 1000 })
    expect(result.end).toMatchObject({ date: '2026-09-07', netWorth: 1050 })
    expect(result.change).toEqual({ amountUsd: 50, percent: 5 })
    expect(result.note).toContain('2026-09-05')
  })
})

describe('executeTool', () => {
  it('routes log_transaction to the extraction pipeline callback', async () => {
    const logTransaction = vi.fn(async () => {})
    const { context } = ctx({ logTransaction })
    const result = await executeTool('log_transaction', { text: '$12 coffee at Blue Bottle' }, context)
    expect(logTransaction).toHaveBeenCalledWith('$12 coffee at Blue Bottle')
    expect(result).toEqual({ status: 'confirmation_card_sent' })
  })

  it('rejects unknown tools', async () => {
    const { context } = ctx()
    await expect(executeTool('drop_tables', {}, context)).rejects.toThrow('Unknown tool')
  })
})
