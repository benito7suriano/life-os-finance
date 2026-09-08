// The dashboard summary computation, lifted out of /api/finance/summary so the
// wealth-manager agent and reports return exactly the numbers the app shows.

import type { SupabaseClient } from '@supabase/supabase-js'
import { toUsd } from '@/lib/fx'
import {
  bucketByMonth,
  fetchExpenseCategoryContext,
  fetchTransactionsPaged,
  monthStartStr,
  periodOf,
  rollupSpendingByParent,
  round2,
  toMonthlyTrend,
  type CategoryContext,
  type MonthlyTrendItem,
  type TxRow,
} from './history'
import { computeBudgetProjection, type BudgetProjection } from './projection'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FinanceSupabase = SupabaseClient<any, any, any>

export interface FinanceSummary {
  netWorth: number
  assets: number
  /** Positive magnitude for display ("you owe X"). */
  liabilities: number
  monthlyIncome: number
  monthlyExpenses: number
  monthlyNet: number
  budgetVsActual: {
    budgetId: string
    categoryId: string
    type: string
    budgeted: number
    spent: number
    remaining: number
  }[]
  budgetProjection: BudgetProjection
  monthlyTrend: MonthlyTrendItem[]
  spendingByCategory: {
    period: 'month'
    total: number
    categories: {
      id: string
      name: string
      amount: number
      percent: number
      color: string
      transactionCount: number
    }[]
  }
}

export const ASSET_ACCOUNT_TYPES = ['checking', 'savings', 'wallet', 'investment']
export const LIABILITY_ACCOUNT_TYPES = ['credit_card', 'loan']

export async function computeFinanceSummary(
  supabase: FinanceSupabase,
  userId: string,
  now: Date
): Promise<FinanceSummary> {
  const currentMonth = monthStartStr(now, 0)
  const currentPeriod = currentMonth.slice(0, 7)
  const nextMonthStr = monthStartStr(now, 1)
  const trendStartStr = monthStartStr(now, -11)

  const [accountsRes, budgetsRes, snapshotsRes, catCtx, txRows] = await Promise.all([
    supabase
      .from('accounts')
      .select('id, type, balance, currency, credit_limit, original_amount')
      .eq('user_id', userId)
      .is('deleted_at', null),
    supabase.from('budgets').select('id, amount, type, category_id').eq('user_id', userId),
    supabase
      .from('budget_monthly_snapshots')
      .select('budget_id, budgeted_amount')
      .eq('user_id', userId)
      .eq('month', currentMonth),
    fetchExpenseCategoryContext(supabase),
    // 12 calendar months ending now — drives the trend AND current-month totals.
    fetchTransactionsPaged(supabase, userId, {
      types: ['expense', 'income'],
      fromDate: trendStartStr,
      toDateExclusive: nextMonthStr,
    }),
  ])

  if (accountsRes.error) throw new Error(accountsRes.error.message)
  if (budgetsRes.error) throw new Error(budgetsRes.error.message)

  const accounts = (accountsRes.data ?? []) as {
    id: string
    type: string
    balance: number | string
    currency: string | null
  }[]
  const budgets = (budgetsRes.data ?? []) as {
    id: string
    amount: number | string
    type: string
    category_id: string
  }[]
  const snapshots = (snapshotsRes.data ?? []) as {
    budget_id: string
    budgeted_amount: number | string
  }[]

  // Assets: cash + savings + investments. Liabilities: credit cards + loans.
  const assets = accounts
    .filter((a) => ASSET_ACCOUNT_TYPES.includes(a.type))
    .reduce((sum, a) => sum + toUsd(Number(a.balance), a.currency), 0)

  // Debt balances are stored NEGATIVE, so the signed sum is negative when in
  // debt — adding it subtracts debt from assets. (A positive value would mean
  // a net credit balance across cards, which legitimately adds.)
  const liabilitiesSigned = accounts
    .filter((a) => LIABILITY_ACCOUNT_TYPES.includes(a.type))
    .reduce((sum, a) => sum + toUsd(Number(a.balance), a.currency), 0)

  const netWorth = assets + liabilitiesSigned

  // Bookkeeping categories ("Balance Adjustment") are excluded so they can't
  // distort the income/expense picture.
  const buckets = bucketByMonth(txRows, catCtx.excludedCategoryIds)
  const current = buckets.get(currentPeriod) ?? { income: 0, expenses: 0 }
  const monthlyIncome = round2(current.income)
  const monthlyExpenses = round2(current.expenses)
  const monthlyTrend = toMonthlyTrend(buckets, 12, now)

  const currentMonthRows = txRows.filter((t) => periodOf(t.date) === currentPeriod)
  const spentByCategory = exactSpendByCategory(currentMonthRows)
  const spendingByCategory = {
    period: 'month' as const,
    ...rollupSpendingByParent(currentMonthRows, catCtx),
  }

  const snapshotByBudget = new Map(snapshots.map((s) => [s.budget_id, Number(s.budgeted_amount)]))

  const budgetVsActual = budgets.map((b) => {
    const budgeted = snapshotByBudget.get(b.id) ?? Number(b.amount)
    const spent = round2(spentByCategory[b.category_id] ?? 0)
    return {
      budgetId: b.id,
      categoryId: b.category_id,
      type: b.type,
      budgeted,
      spent,
      remaining: round2(budgeted - spent),
    }
  })

  // Pacing vs the total monthly budget (snapshot-preferred, matching the
  // budgets page's totalBudgeted) against ALL non-bookkeeping expenses.
  const totalBudgeted = budgets.reduce(
    (sum, b) => sum + (snapshotByBudget.get(b.id) ?? Number(b.amount)),
    0
  )
  const budgetProjection = computeBudgetProjection({
    totalBudget: totalBudgeted,
    spent: monthlyExpenses,
    today: now,
  })

  return {
    netWorth,
    assets,
    liabilities: 0 - liabilitiesSigned,
    monthlyIncome,
    monthlyExpenses,
    monthlyNet: round2(monthlyIncome - monthlyExpenses),
    budgetVsActual,
    budgetProjection,
    monthlyTrend,
    spendingByCategory,
  }
}

/** USD expense spend keyed by the exact category id (bookkeeping included —
 * budget-vs-actual wants the raw per-category figure). */
export function exactSpendByCategory(rows: TxRow[]): Record<string, number> {
  const spent: Record<string, number> = {}
  for (const t of rows) {
    if (t.type !== 'expense' || !t.category_id) continue
    spent[t.category_id] = (spent[t.category_id] ?? 0) + toUsd(Number(t.amount), t.currency)
  }
  return spent
}

export type { CategoryContext }
