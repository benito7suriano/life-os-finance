import { NextRequest, NextResponse } from 'next/server'
import { createFinanceClient } from '@/lib/supabase/server'
import { toUsd } from '@/lib/fx'
import {
  bucketByMonth,
  computeCategoryAverages,
  fetchExpenseCategoryContext,
  fetchMonthlyBudgetTotal,
  fetchTransactionsPaged,
  periodOf,
  round2,
} from '@/lib/finance/history'
import { buildInsights } from '@/lib/insights/rules'

// Assembles the InsightInput from real data and runs the deterministic rules
// engine (lib/insights/rules.ts). Returns { insights, generatedAt } ranked by
// importance; the dashboard card shows the top one and Dismiss advances.
export async function GET(_request: NextRequest) {
  const supabase = await createFinanceClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const currentPeriod = currentMonth.slice(0, 7)
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const nextMonthStr = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01`
  // Trailing 12 calendar months including the current one (matches the budgets
  // route's averages window).
  const twelveStart = new Date(now.getFullYear(), now.getMonth() + 1 - 12, 1)
  const twelveStartStr = `${twelveStart.getFullYear()}-${String(twelveStart.getMonth() + 1).padStart(2, '0')}-01`

  let accountsRes, catCtx, txRows, totalBudget
  try {
    ;[accountsRes, catCtx, txRows, totalBudget] = await Promise.all([
      supabase
        .from('accounts')
        .select('id, name, type, balance, currency, payment_date')
        .eq('user_id', user.id)
        .is('deleted_at', null),
      fetchExpenseCategoryContext(supabase),
      fetchTransactionsPaged(supabase, user.id, {
        types: ['expense', 'income'],
        fromDate: twelveStartStr,
        toDateExclusive: nextMonthStr,
      }),
      fetchMonthlyBudgetTotal(supabase, user.id, currentMonth),
    ])
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'insights fetch failed' },
      { status: 500 }
    )
  }

  if (accountsRes.error) return NextResponse.json({ error: accountsRes.error.message }, { status: 500 })
  const accounts = accountsRes.data ?? []

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

  const insights = buildInsights({
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
  })

  return NextResponse.json({ insights, generatedAt: new Date().toISOString() })
}
