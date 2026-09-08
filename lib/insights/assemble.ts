// Assembles the InsightInput from live data — shared by /api/finance/insights,
// the wealth-manager agent's get_insights tool, and the scheduled reports.

import type { SupabaseClient } from '@supabase/supabase-js'
import { toUsd } from '@/lib/fx'
import {
  bucketByMonth,
  computeCategoryAverages,
  fetchExpenseCategoryContext,
  fetchMonthlyBudgetTotal,
  fetchTransactionsPaged,
  monthStartStr,
  periodOf,
  round2,
} from '@/lib/finance/history'
import type { InsightInput } from './types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FinanceSupabase = SupabaseClient<any, any, any>

export async function assembleInsightInput(
  supabase: FinanceSupabase,
  userId: string,
  now: Date
): Promise<InsightInput> {
  const currentMonth = monthStartStr(now, 0)
  const currentPeriod = currentMonth.slice(0, 7)
  const nextMonthStr = monthStartStr(now, 1)
  // Trailing 12 calendar months including the current one (matches the budgets
  // route's averages window).
  const twelveStartStr = monthStartStr(now, -11)

  const [accountsRes, catCtx, txRows, totalBudget] = await Promise.all([
    supabase
      .from('accounts')
      .select('id, name, type, balance, currency, payment_date')
      .eq('user_id', userId)
      .is('deleted_at', null),
    fetchExpenseCategoryContext(supabase),
    fetchTransactionsPaged(supabase, userId, {
      types: ['expense', 'income'],
      fromDate: twelveStartStr,
      toDateExclusive: nextMonthStr,
    }),
    fetchMonthlyBudgetTotal(supabase, userId, currentMonth),
  ])

  if (accountsRes.error) throw new Error(accountsRes.error.message)
  const accounts = (accountsRes.data ?? []) as {
    id: string
    name: string
    type: string
    balance: number | string
    currency: string | null
    payment_date: number | string | null
  }[]

  const buckets = bucketByMonth(txRows, catCtx.excludedCategoryIds)
  const current = buckets.get(currentPeriod) ?? { income: 0, expenses: 0 }

  // Typical monthly spend = average of trailing FULL months (the current
  // partial month would drag the average down).
  let fullMonthSum = 0
  let fullMonthCount = 0
  for (const [period, bucket] of buckets) {
    if (period === currentPeriod) continue
    fullMonthSum += bucket.expenses
    fullMonthCount++
  }
  const avgMonthlyExpensesUsd = fullMonthCount > 0 ? fullMonthSum / fullMonthCount : 0

  // Current-month spend rolled up to parent categories.
  const parentSpend: Record<string, number> = {}
  for (const t of txRows) {
    if (t.type !== 'expense') continue
    if (periodOf(t.date) !== currentPeriod) continue
    const cid = t.category_id
    if (!cid || catCtx.excludedCategoryIds.has(cid)) continue
    const parentId = catCtx.childToParent[cid] ?? cid
    parentSpend[parentId] = (parentSpend[parentId] ?? 0) + toUsd(Number(t.amount), t.currency)
  }

  const averages = computeCategoryAverages(
    txRows,
    catCtx.excludedCategoryIds,
    catCtx.childToParent,
    twelveStartStr
  )

  return {
    today: now,
    budget: totalBudget > 0 ? { totalBudget, spent: current.expenses } : null,
    categories: catCtx.parents.map((p) => ({
      id: p.id,
      name: p.name,
      spentThisMonthUsd: round2(parentSpend[p.id] ?? 0),
      avgMonthlyUsd: averages[p.id] ?? 0,
    })),
    creditCards: accounts
      .filter((a) => a.type === 'credit_card')
      .map((a) => ({
        id: a.id,
        name: a.name,
        paymentDay: a.payment_date != null ? Number(a.payment_date) : null,
        balanceUsd: toUsd(Number(a.balance), a.currency),
      })),
    liquidUsd: round2(
      accounts
        .filter((a) => ['checking', 'savings', 'wallet'].includes(a.type))
        .reduce((sum, a) => sum + toUsd(Number(a.balance), a.currency), 0)
    ),
    avgMonthlyExpensesUsd: round2(avgMonthlyExpensesUsd),
    monthlyIncomeUsd: round2(current.income),
    monthlyExpensesUsd: round2(current.expenses),
  }
}
