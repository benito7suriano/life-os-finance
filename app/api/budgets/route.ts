import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()

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

  const parentCategories = (allCategories || []).filter(c => !c.parent_id)
  const childCategories = (allCategories || []).filter(c => c.parent_id)

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

  // 5. Compute spent per category for the month
  const { data: monthTransactions } = await supabase
    .from('transactions')
    .select('category_id, amount')
    .eq('user_id', user.id)
    .eq('type', 'expense')
    .gte('date', monthStart)
    .lt('date', monthEnd)

  // Aggregate spent by category_id
  const spentByCategory: Record<string, number> = {}
  for (const t of monthTransactions || []) {
    if (t.category_id) {
      spentByCategory[t.category_id] = (spentByCategory[t.category_id] || 0) + Number(t.amount)
    }
  }

  // Build child-to-parent map for category rollup
  const childToParent: Record<string, string> = {}
  for (const c of childCategories) {
    childToParent[c.id] = c.parent_id
  }

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

    return {
      id: b.id,
      categoryId,
      subcategoryId,
      name: cat?.name || '',
      type: b.type,
      budgeted: Number(b.amount),
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

  // 6. Build summary
  const totalBudgeted = budgets.reduce((sum, b) => sum + b.budgeted, 0)
  const totalSpent = budgets.reduce((sum, b) => sum + b.spent, 0)

  // 7. Build monthly history (last 12 months)
  const monthlyHistory: { month: string; budgeted: number; spent: number }[] = []
  for (let i = 11; i >= 0; i--) {
    const histDate = new Date(targetYear, targetMonth - 1 - i, 1)
    const histMonthStart = `${histDate.getFullYear()}-${String(histDate.getMonth() + 1).padStart(2, '0')}-01`
    const histLabel = histDate.toLocaleString('en-US', { month: 'short', year: 'numeric' })
    monthlyHistory.push({ month: histLabel, budgeted: 0, spent: 0 })

    // We'll fill these from snapshots and transaction aggregates below
    void histMonthStart // used in batch queries below
  }

  // Fetch snapshots for last 12 months
  const historyStart = new Date(targetYear, targetMonth - 12, 1)
  const historyStartStr = `${historyStart.getFullYear()}-${String(historyStart.getMonth() + 1).padStart(2, '0')}-01`

  const { data: snapshots } = await supabase
    .from('budget_monthly_snapshots')
    .select('month, budgeted_amount')
    .eq('user_id', user.id)
    .gte('month', historyStartStr)
    .lt('month', monthEnd)

  // Aggregate snapshots by month
  const snapshotsByMonth: Record<string, number> = {}
  for (const s of snapshots || []) {
    const sDate = new Date(s.month)
    const key = sDate.toLocaleString('en-US', { month: 'short', year: 'numeric' })
    snapshotsByMonth[key] = (snapshotsByMonth[key] || 0) + Number(s.budgeted_amount)
  }

  // Fetch transaction aggregates for last 12 months
  const { data: histTransactions } = await supabase
    .from('transactions')
    .select('date, amount')
    .eq('user_id', user.id)
    .eq('type', 'expense')
    .gte('date', historyStartStr)
    .lt('date', monthEnd)

  const spentByMonth: Record<string, number> = {}
  for (const t of histTransactions || []) {
    const tDate = new Date(t.date)
    const key = tDate.toLocaleString('en-US', { month: 'short', year: 'numeric' })
    spentByMonth[key] = (spentByMonth[key] || 0) + Number(t.amount)
  }

  for (const entry of monthlyHistory) {
    entry.budgeted = Math.round((snapshotsByMonth[entry.month] || 0) * 100) / 100
    entry.spent = Math.round((spentByMonth[entry.month] || 0) * 100) / 100
  }

  // 8. Lazy-init snapshots for current month if missing
  const currentMonthSnapshots = (snapshots || []).filter(s => s.month === monthStart)
  if (currentMonthSnapshots.length === 0 && (dbBudgets || []).length > 0) {
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
      id, date, description, amount, category_id,
      from_account:accounts!transactions_from_account_id_fkey(name),
      merchant:merchants(name)
    `)
    .eq('user_id', user.id)
    .eq('type', 'expense')
    .gte('date', monthStart)
    .lt('date', monthEnd)
    .order('date', { ascending: false })
    .limit(50)

  const transactions = (recentTransactions || []).map(t => {
    const catId = t.category_id || ''
    const parentId = childToParent[catId]
    return {
      id: t.id,
      date: t.date,
      description: t.description,
      merchantName: (t.merchant as unknown as { name: string } | null)?.name || null,
      amount: Number(t.amount),
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
    savingsAccounts,
    transactions,
  })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()

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
