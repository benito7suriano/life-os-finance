import { NextRequest, NextResponse } from 'next/server'
import { createFinanceClient } from '@/lib/supabase/server'
import { toUsd } from '@/lib/fx'
import {
  bucketByMonth,
  fetchExpenseCategoryContext,
  fetchTransactionsPaged,
  periodOf,
  round2,
  toMonthlyTrend,
} from '@/lib/finance/history'
import { computeBudgetProjection } from '@/lib/finance/projection'

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
  const trendStart = new Date(now.getFullYear(), now.getMonth() - 11, 1)
  const trendStartStr = `${trendStart.getFullYear()}-${String(trendStart.getMonth() + 1).padStart(2, '0')}-01`

  let accountsRes, budgetsRes, snapshotsRes, catCtx, txRows
  try {
    ;[accountsRes, budgetsRes, snapshotsRes, catCtx, txRows] = await Promise.all([
      supabase
        .from('accounts')
        .select('id, type, balance, currency, credit_limit, original_amount')
        .eq('user_id', user.id)
        .is('deleted_at', null),
      supabase.from('budgets').select('id, amount, type, category_id').eq('user_id', user.id),
      supabase
        .from('budget_monthly_snapshots')
        .select('budget_id, budgeted_amount')
        .eq('user_id', user.id)
        .eq('month', currentMonth),
      fetchExpenseCategoryContext(supabase),
      // 12 calendar months ending now — drives the trend AND current-month totals.
      fetchTransactionsPaged(supabase, user.id, {
        types: ['expense', 'income'],
        fromDate: trendStartStr,
        toDateExclusive: nextMonthStr,
      }),
    ])
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'summary fetch failed' },
      { status: 500 }
    )
  }

  if (accountsRes.error) return NextResponse.json({ error: accountsRes.error.message }, { status: 500 })
  if (budgetsRes.error) return NextResponse.json({ error: budgetsRes.error.message }, { status: 500 })

  const accounts = accountsRes.data ?? []
  const budgets = budgetsRes.data ?? []
  const snapshots = snapshotsRes.data ?? []

  // Assets: cash + savings + investments. Liabilities: credit cards + loans.
  // All summed in USD via toUsd().
  const assets = accounts
    .filter((a) => ['checking', 'savings', 'wallet', 'investment'].includes(a.type))
    .reduce((sum, a) => sum + toUsd(Number(a.balance), a.currency), 0)

  // Debt balances are stored NEGATIVE, so the signed sum is negative when in
  // debt — adding it subtracts debt from assets. (A positive value would mean
  // a net credit balance across cards, which legitimately adds.)
  const liabilitiesSigned = accounts
    .filter((a) => ['credit_card', 'loan'].includes(a.type))
    .reduce((sum, a) => sum + toUsd(Number(a.balance), a.currency), 0)

  const netWorth = assets + liabilitiesSigned

  // Monthly totals from the bucketed window. Bookkeeping categories ("Balance
  // Adjustment" reconciliation entries) are excluded so they can't distort the
  // income/expense picture.
  const buckets = bucketByMonth(txRows, catCtx.excludedCategoryIds)
  const current = buckets.get(currentPeriod) ?? { income: 0, expenses: 0 }
  const monthlyIncome = round2(current.income)
  const monthlyExpenses = round2(current.expenses)
  const monthlyTrend = toMonthlyTrend(buckets, 12, now)

  // Current-month spend: exact category for budget-vs-actual, parent rollup
  // (with counts) for the spending breakdown.
  const spentByCategory: Record<string, number> = {}
  const parentSpend: Record<string, { amount: number; count: number }> = {}
  for (const t of txRows) {
    if (t.type !== 'expense') continue
    if (periodOf(t.date) !== currentPeriod) continue
    const cid = t.category_id
    if (!cid) continue
    const amountUsd = toUsd(Number(t.amount), t.currency)
    spentByCategory[cid] = (spentByCategory[cid] ?? 0) + amountUsd
    if (catCtx.excludedCategoryIds.has(cid)) continue
    const parentId = catCtx.childToParent[cid] ?? cid
    const entry = parentSpend[parentId] ?? { amount: 0, count: 0 }
    entry.amount += amountUsd
    entry.count += 1
    parentSpend[parentId] = entry
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

  const spendingTotal = round2(Object.values(parentSpend).reduce((s, e) => s + e.amount, 0))
  const spendingByCategory = {
    period: 'month' as const,
    total: spendingTotal,
    categories: catCtx.parents
      .filter((p) => parentSpend[p.id])
      .map((p) => ({
        id: p.id,
        name: p.name,
        amount: round2(parentSpend[p.id].amount),
        percent: spendingTotal > 0 ? round2((parentSpend[p.id].amount / spendingTotal) * 100) : 0,
        color: p.color || '#94a3b8',
        transactionCount: parentSpend[p.id].count,
      }))
      .sort((a, b) => b.amount - a.amount),
  }

  return NextResponse.json({
    netWorth,
    assets,
    // Positive magnitude for display ("you owe X").
    liabilities: -liabilitiesSigned,
    monthlyIncome,
    monthlyExpenses,
    monthlyNet: round2(monthlyIncome - monthlyExpenses),
    budgetVsActual,
    budgetProjection,
    monthlyTrend,
    spendingByCategory,
  })
}
