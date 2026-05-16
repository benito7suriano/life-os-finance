import { NextRequest, NextResponse } from 'next/server'
import { createFinanceClient } from '@/lib/supabase/server'

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
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

  const [accountsRes, txRes, budgetsRes, snapshotsRes] = await Promise.all([
    supabase
      .from('accounts')
      .select('type, balance, credit_limit, original_amount')
      .eq('user_id', user.id)
      .is('deleted_at', null),
    supabase
      .from('transactions')
      .select('type, amount, category_id')
      .eq('user_id', user.id)
      .gte('date', monthStart)
      .lte('date', monthEnd),
    supabase
      .from('budgets')
      .select('id, amount, type, category_id')
      .eq('user_id', user.id),
    supabase
      .from('budget_monthly_snapshots')
      .select('budget_id, budgeted_amount')
      .eq('user_id', user.id)
      .eq('month', currentMonth),
  ])

  if (accountsRes.error) return NextResponse.json({ error: accountsRes.error.message }, { status: 500 })
  if (txRes.error) return NextResponse.json({ error: txRes.error.message }, { status: 500 })
  if (budgetsRes.error) return NextResponse.json({ error: budgetsRes.error.message }, { status: 500 })

  const accounts = accountsRes.data ?? []
  const transactions = txRes.data ?? []
  const budgets = budgetsRes.data ?? []
  const snapshots = snapshotsRes.data ?? []

  const assets = accounts
    .filter((a) => ['checking', 'savings'].includes(a.type))
    .reduce((sum, a) => sum + Number(a.balance), 0)

  const liabilities = accounts
    .filter((a) => ['credit', 'loan'].includes(a.type))
    .reduce((sum, a) => sum + Number(a.balance), 0)

  const netWorth = assets - liabilities

  const monthlyIncome = transactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + Number(t.amount), 0)

  const monthlyExpenses = transactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + Number(t.amount), 0)

  const spentByCategory = transactions
    .filter((t) => t.type === 'expense' && t.category_id)
    .reduce<Record<string, number>>((acc, t) => {
      const key = t.category_id as string
      acc[key] = (acc[key] ?? 0) + Number(t.amount)
      return acc
    }, {})

  const snapshotByBudget = new Map(snapshots.map((s) => [s.budget_id, Number(s.budgeted_amount)]))

  const budgetVsActual = budgets.map((b) => {
    const budgeted = snapshotByBudget.get(b.id) ?? Number(b.amount)
    const spent = spentByCategory[b.category_id] ?? 0
    return {
      budgetId: b.id,
      categoryId: b.category_id,
      type: b.type,
      budgeted,
      spent,
      remaining: budgeted - spent,
    }
  })

  return NextResponse.json({
    netWorth,
    assets,
    liabilities,
    monthlyIncome,
    monthlyExpenses,
    monthlyNet: monthlyIncome - monthlyExpenses,
    budgetVsActual,
  })
}
