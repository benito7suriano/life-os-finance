import { NextRequest, NextResponse } from 'next/server'
import { createFinanceClient } from '@/lib/supabase/server'
import { toUsd } from '@/lib/fx'

export async function GET(request: NextRequest) {
  const supabase = await createFinanceClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const monthParam = searchParams.get('month') // e.g. "2025-01" or null for current

  // Determine the target month
  const now = new Date()
  let targetYear: number, targetMonth: number
  if (monthParam) {
    const [y, m] = monthParam.split('-').map(Number)
    targetYear = y
    targetMonth = m
  } else {
    targetYear = now.getFullYear()
    targetMonth = now.getMonth() + 1
  }

  const monthStart = `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`
  const nextMonth = targetMonth === 12 ? 1 : targetMonth + 1
  const nextYear = targetMonth === 12 ? targetYear + 1 : targetYear
  const monthEnd = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`
  const monthLabel = new Date(targetYear, targetMonth - 1).toLocaleString('en-US', { month: 'long', year: 'numeric' })

  // 1. Fetch expense categories with subcategories
  const { data: allCategories } = await supabase
    .from('categories')
    .select('id, name, parent_id, type')
    .eq('type', 'expense')
    .order('name')

  // Categories that represent bookkeeping artifacts rather than real spending.
  // "Balance Adjustment" is a Money Pro reconciliation entry (trues an account's
  // computed balance up to its actual balance) — exclude it from all spend rollups.
  const EXCLUDED_CATEGORY_NAMES = new Set(['balance adjustment'])
  const excludedCategoryIds = new Set(
    (allCategories || [])
      .filter(c => EXCLUDED_CATEGORY_NAMES.has((c.name || '').trim().toLowerCase()))
      .map(c => c.id)
  )

  const parentCategories = (allCategories || []).filter(c => !c.parent_id && !excludedCategoryIds.has(c.id))
  const childCategories = (allCategories || []).filter(c => c.parent_id && !excludedCategoryIds.has(c.id))

  const categories = parentCategories.map(parent => ({
    id: parent.id,
    name: parent.name,
    subcategories: childCategories
      .filter(c => c.parent_id === parent.id)
      .map(c => ({ id: c.id, name: c.name })),
  }))

  // 2. Fetch budgets
  const { data: dbBudgets } = await supabase
    .from('budgets')
    .select('*, category:categories(id, name, parent_id)')
    .eq('user_id', user.id)

  // 3. Fetch goals
  const { data: dbGoals } = await supabase
    .from('goals')
    .select('*, account:accounts(id, name)')
    .eq('user_id', user.id)
    .in('status', ['active', 'completed'])

  // 4. Fetch goal contributions
  const goalIds = (dbGoals || []).map(g => g.id)
  let dbContributions: { id: string; goal_id: string; transaction_id: string; amount: string | number; date: string }[] = []
  if (goalIds.length > 0) {
    const { data } = await supabase
      .from('goal_contributions')
      .select('id, goal_id, transaction_id, amount, date')
      .in('goal_id', goalIds)
      .order('date', { ascending: false })
    dbContributions = data || []
  }

  // Expense amounts are stored in the transaction's own `currency` (DOP or USD)
  // and must be converted to USD before they can be summed together.
  const usd = (amount: number | string, currency: string | null | undefined) =>
    toUsd(Number(amount), currency)

  // 5. Compute spent per category for the month (in USD)
  const { data: monthTransactions } = await supabase
    .from('transactions')
    .select('category_id, amount, currency')
    .eq('user_id', user.id)
    .eq('type', 'expense')
    .gte('date', monthStart)
    .lt('date', monthEnd)

  // Aggregate spent by category_id (excluding bookkeeping categories)
  const spentByCategory: Record<string, number> = {}
  for (const t of monthTransactions || []) {
    if (t.category_id && !excludedCategoryIds.has(t.category_id)) {
      spentByCategory[t.category_id] = (spentByCategory[t.category_id] || 0) + usd(t.amount, t.currency)
    }
  }

  // Build child-to-parent map for category rollup
  const childToParent: Record<string, string> = {}
  for (const c of childCategories) {
    childToParent[c.id] = c.parent_id
  }

  // Determine the full-history window: from the earliest expense transaction's
  // month up to (and including) the target month.
  const { data: earliestTxRows } = await supabase
    .from('transactions')
    .select('date')
    .eq('user_id', user.id)
    .eq('type', 'expense')
    .order('date', { ascending: true })
    .limit(1)

  const earliestTxDate = earliestTxRows?.[0]?.date
    ? new Date(earliestTxRows[0].date)
    : new Date(targetYear, targetMonth - 1, 1)
  const historyStart = new Date(earliestTxDate.getFullYear(), earliestTxDate.getMonth(), 1)
  const historyStartStr = `${historyStart.getFullYear()}-${String(historyStart.getMonth() + 1).padStart(2, '0')}-01`

  // Fetch snapshots across the full history window
  const { data: snapshots } = await supabase
    .from('budget_monthly_snapshots')
    .select('budget_id, month, budgeted_amount')
    .eq('user_id', user.id)
    .gte('month', historyStartStr)
    .lt('month', monthEnd)

  // Snapshot lookups: per budget for the target month, and aggregate per month
  const targetSnapshotByBudget: Record<string, number> = {}
  const snapshotsByMonth: Record<string, number> = {}
  for (const s of snapshots || []) {
    if (s.month === monthStart) {
      targetSnapshotByBudget[s.budget_id] = Number(s.budgeted_amount)
    }
    const sKey = new Date(s.month).toLocaleString('en-US', { month: 'short', year: 'numeric' })
    snapshotsByMonth[sKey] = (snapshotsByMonth[sKey] || 0) + Number(s.budgeted_amount)
  }

  // Whether the target month is the current calendar month
  const currentMonthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const isCurrentMonth = monthStart === currentMonthStart

  // Map budgets to component format
  const budgets = (dbBudgets || []).map(b => {
    const cat = b.category
    const isChild = cat?.parent_id != null
    const categoryId = isChild ? cat.parent_id : b.category_id
    const subcategoryId = isChild ? b.category_id : null

    // Compute spent: for subcategory budgets use exact match;
    // for category budgets sum parent + all children
    let spent = 0
    if (subcategoryId) {
      spent = spentByCategory[subcategoryId] || 0
    } else {
      // Sum parent category + all children
      spent = spentByCategory[categoryId] || 0
      for (const child of childCategories) {
        if (child.parent_id === categoryId) {
          spent += spentByCategory[child.id] || 0
        }
      }
    }

    // Budgeted reflects the snapshot for the target month. For the current
    // month, fall back to the budget's current amount (snapshot is lazily
    // created below). For a past month with no snapshot the budget did not
    // exist yet, so its budget is unknown.
    const snap = targetSnapshotByBudget[b.id]
    let budgeted: number
    let budgetKnown = true
    if (snap != null) {
      budgeted = snap
    } else if (isCurrentMonth) {
      budgeted = Number(b.amount)
    } else {
      budgeted = 0
      budgetKnown = false
    }

    return {
      id: b.id,
      categoryId,
      subcategoryId,
      name: cat?.name || '',
      type: b.type,
      budgeted,
      budgetKnown,
      spent: Math.round(spent * 100) / 100,
      isCategory: !isChild,
      linkedGoalId: b.linked_goal_id || undefined,
    }
  })

  // Map goals
  const goals = (dbGoals || []).map(g => {
    const cat = allCategories?.find(c => c.id === g.category_id)
    const isChild = cat?.parent_id != null
    const categoryId = isChild ? cat!.parent_id : g.category_id
    const subcategoryId = isChild ? g.category_id : null

    const remaining = Number(g.target_amount) - Number(g.current_balance)
    const endDate = new Date(g.target_date)
    const monthsLeft = Math.max(
      1,
      (endDate.getFullYear() - now.getFullYear()) * 12 + (endDate.getMonth() - now.getMonth())
    )

    return {
      id: g.id,
      categoryId,
      subcategoryId,
      name: g.name,
      linkedBudgetId: g.linked_budget_id || '',
      linkedAccountId: g.linked_account_id,
      linkedAccountName: g.account?.name || '',
      targetAmount: Number(g.target_amount),
      targetDate: g.target_date,
      currentBalance: Number(g.current_balance),
      monthlyContribution: Math.round((remaining / monthsLeft) * 100) / 100,
      status: g.status,
    }
  })

  // Map contributions
  const goalContributions = dbContributions.map(c => ({
    id: c.id,
    goalId: c.goal_id,
    transactionId: c.transaction_id,
    amount: Number(c.amount),
    date: c.date,
  }))

  // 6. Build summary — Total Spent is ALL expenses for the month (USD),
  // independent of whether a budget exists for the category.
  const totalBudgeted = budgets.reduce((sum, b) => sum + b.budgeted, 0)
  const totalSpent =
    Math.round(
      (monthTransactions || [])
        .filter(t => !(t.category_id && excludedCategoryIds.has(t.category_id)))
        .reduce((sum, t) => sum + usd(t.amount, t.currency), 0) * 100
    ) / 100

  // 6b. Per-category spending for the month (every category, not just budgeted
  // ones), with subcategory breakdown — drives the breakdown list below the chart.
  const categorySpending = parentCategories
    .map(parent => {
      const subcategories = childCategories
        .filter(c => c.parent_id === parent.id)
        .map(c => ({ id: c.id, name: c.name, spent: Math.round((spentByCategory[c.id] || 0) * 100) / 100 }))
        .filter(s => s.spent > 0)
        .sort((a, b) => b.spent - a.spent)
      const directSpent = spentByCategory[parent.id] || 0
      const total = directSpent + subcategories.reduce((s, c) => s + c.spent, 0)
      return {
        id: parent.id,
        name: parent.name,
        spent: Math.round(total * 100) / 100,
        subcategories,
      }
    })
    .sort((a, b) => b.spent - a.spent)

  // 7. Build monthly history spanning the full window (earliest tx → target month)
  const monthlyHistory: { month: string; budgeted: number; spent: number }[] = []
  const historyMonths =
    (targetYear - historyStart.getFullYear()) * 12 +
    (targetMonth - 1 - historyStart.getMonth()) +
    1
  for (let i = historyMonths - 1; i >= 0; i--) {
    const histDate = new Date(targetYear, targetMonth - 1 - i, 1)
    const histLabel = histDate.toLocaleString('en-US', { month: 'short', year: 'numeric' })
    monthlyHistory.push({ month: histLabel, budgeted: 0, spent: 0 })
  }

  // Fetch expense transactions across the full history window (with category for
  // averages). Paginate past PostgREST's max-rows cap so multi-year histories
  // aggregate fully instead of silently truncating to the oldest page.
  const histTransactions: { date: string; amount: number | string; category_id: string | null; currency: string | null }[] = []
  const PAGE_SIZE = 1000
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data: page } = await supabase
      .from('transactions')
      .select('date, amount, category_id, currency')
      .eq('user_id', user.id)
      .eq('type', 'expense')
      .gte('date', historyStartStr)
      .lt('date', monthEnd)
      .order('date', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)
    if (!page || page.length === 0) break
    histTransactions.push(...page)
    if (page.length < PAGE_SIZE) break
  }

  const spentByMonth: Record<string, number> = {}
  for (const t of histTransactions || []) {
    if (t.category_id && excludedCategoryIds.has(t.category_id)) continue
    const tDate = new Date(t.date)
    const key = tDate.toLocaleString('en-US', { month: 'short', year: 'numeric' })
    spentByMonth[key] = (spentByMonth[key] || 0) + usd(t.amount, t.currency)
  }

  for (const entry of monthlyHistory) {
    entry.budgeted = Math.round((snapshotsByMonth[entry.month] || 0) * 100) / 100
    entry.spent = Math.round((spentByMonth[entry.month] || 0) * 100) / 100
  }

  // 7b. Trailing-12-month average monthly spend per category (for budget suggestions)
  const twelveStart = new Date(targetYear, targetMonth - 12, 1)
  const twelveStartStr = `${twelveStart.getFullYear()}-${String(twelveStart.getMonth() + 1).padStart(2, '0')}-01`
  const avgTotals: Record<string, number> = {}
  const monthsWithData = new Set<string>()
  for (const t of histTransactions || []) {
    if (t.date < twelveStartStr) continue
    const cid = t.category_id
    if (cid && excludedCategoryIds.has(cid)) continue
    monthsWithData.add(new Date(t.date).toLocaleString('en-US', { month: 'short', year: 'numeric' }))
    if (!cid) continue
    const amt = usd(t.amount, t.currency)
    avgTotals[cid] = (avgTotals[cid] || 0) + amt
    const parent = childToParent[cid]
    if (parent) avgTotals[parent] = (avgTotals[parent] || 0) + amt
  }
  const monthsCovered = Math.min(12, Math.max(1, monthsWithData.size))
  const categoryAverages: Record<string, number> = {}
  for (const [cid, total] of Object.entries(avgTotals)) {
    categoryAverages[cid] = Math.round((total / monthsCovered) * 100) / 100
  }

  // 8. Lazy-init snapshots for the current month if missing
  if (isCurrentMonth && Object.keys(targetSnapshotByBudget).length === 0 && (dbBudgets || []).length > 0) {
    const snapshotRows = (dbBudgets || []).map(b => ({
      budget_id: b.id,
      user_id: user.id,
      month: monthStart,
      budgeted_amount: b.amount,
    }))
    await supabase.from('budget_monthly_snapshots').upsert(snapshotRows, {
      onConflict: 'budget_id,month',
    })

    // Update current month history entry
    const currentEntry = monthlyHistory.find(e => e.month === monthLabel)
    if (currentEntry) {
      currentEntry.budgeted = snapshotRows.reduce((sum, r) => sum + Number(r.budgeted_amount), 0)
    }
  }

  // 9. Fetch savings accounts
  const { data: dbSavingsAccounts } = await supabase
    .from('accounts')
    .select('id, name, balance')
    .eq('user_id', user.id)
    .eq('type', 'savings')
    .is('deleted_at', null)
    .order('name')

  const savingsAccounts = (dbSavingsAccounts || []).map(a => ({
    id: a.id,
    name: a.name,
    balance: Number(a.balance),
  }))

  // 10. Fetch recent expense transactions for drawer display
  const { data: recentTransactions } = await supabase
    .from('transactions')
    .select(`
      id, date, description, amount, currency, category_id, from_account_id,
      from_account:accounts!transactions_from_account_id_fkey(name),
      merchant:merchants(name)
    `)
    .eq('user_id', user.id)
    .eq('type', 'expense')
    .gte('date', monthStart)
    .lt('date', monthEnd)
    .order('date', { ascending: false })
    .limit(50)

  const transactions = (recentTransactions || [])
    .filter(t => !(t.category_id && excludedCategoryIds.has(t.category_id)))
    .map(t => {
    const catId = t.category_id || ''
    const parentId = childToParent[catId]
    return {
      id: t.id,
      date: t.date,
      description: t.description,
      merchantName: (t.merchant as unknown as { name: string } | null)?.name || null,
      amount: usd(t.amount, t.currency),
      categoryId: parentId || catId,
      subcategoryId: parentId ? catId : null,
      accountName: (t.from_account as unknown as { name: string } | null)?.name || '',
    }
  })

  return NextResponse.json({
    budgets,
    goals,
    goalContributions,
    summary: { totalBudgeted, totalSpent, month: monthLabel },
    monthlyHistory,
    categories,
    categoryAverages,
    categorySpending,
    savingsAccounts,
    transactions,
  })
}

export async function POST(request: NextRequest) {
  const supabase = await createFinanceClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { type, categoryId, subcategoryId, amount, name, targetAmount, targetDate, linkedAccountId } = body

  if (!type || !categoryId) {
    return NextResponse.json({ error: 'Missing required fields: type, categoryId' }, { status: 400 })
  }

  // The category_id stored in DB is the most specific: subcategoryId if provided, else categoryId
  const dbCategoryId = subcategoryId || categoryId

  if (type === 'monthly') {
    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'amount must be > 0' }, { status: 400 })
    }

    // Insert budget
    const { data: budget, error } = await supabase
      .from('budgets')
      .insert({
        user_id: user.id,
        category_id: dbCategoryId,
        type: 'monthly',
        amount,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Upsert snapshot for current month
    const now = new Date()
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    await supabase.from('budget_monthly_snapshots').upsert({
      budget_id: budget.id,
      user_id: user.id,
      month: monthStart,
      budgeted_amount: amount,
    }, { onConflict: 'budget_id,month' })

    return NextResponse.json({ budget }, { status: 201 })
  }

  if (type === 'sinking_fund') {
    if (!targetAmount || targetAmount <= 0 || !targetDate || !linkedAccountId) {
      return NextResponse.json(
        { error: 'Missing required fields for sinking fund: targetAmount, targetDate, linkedAccountId' },
        { status: 400 }
      )
    }

    // Calculate monthly contribution
    const now = new Date()
    const end = new Date(targetDate)
    const monthsLeft = Math.max(
      1,
      (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth())
    )
    const monthlyContribution = Math.round((targetAmount / monthsLeft) * 100) / 100

    // Insert budget
    const { data: budget, error: budgetError } = await supabase
      .from('budgets')
      .insert({
        user_id: user.id,
        category_id: dbCategoryId,
        type: 'sinking_fund',
        amount: monthlyContribution,
      })
      .select()
      .single()

    if (budgetError) {
      return NextResponse.json({ error: budgetError.message }, { status: 500 })
    }

    // Insert goal
    const { data: goal, error: goalError } = await supabase
      .from('goals')
      .insert({
        user_id: user.id,
        name: name || 'Sinking Fund',
        category_id: dbCategoryId,
        linked_budget_id: budget.id,
        linked_account_id: linkedAccountId,
        target_amount: targetAmount,
        target_date: targetDate,
        current_balance: 0,
        status: 'active',
      })
      .select()
      .single()

    if (goalError) {
      // Clean up the budget if goal creation fails
      await supabase.from('budgets').delete().eq('id', budget.id)
      return NextResponse.json({ error: goalError.message }, { status: 500 })
    }

    // Update budget with linked_goal_id
    await supabase
      .from('budgets')
      .update({ linked_goal_id: goal.id })
      .eq('id', budget.id)

    // Upsert snapshot for current month
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    await supabase.from('budget_monthly_snapshots').upsert({
      budget_id: budget.id,
      user_id: user.id,
      month: monthStart,
      budgeted_amount: monthlyContribution,
    }, { onConflict: 'budget_id,month' })

    return NextResponse.json({ budget, goal }, { status: 201 })
  }

  return NextResponse.json({ error: 'Invalid type. Must be "monthly" or "sinking_fund"' }, { status: 400 })
}
