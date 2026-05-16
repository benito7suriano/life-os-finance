import { NextRequest, NextResponse } from 'next/server'
import { createFinanceClient } from '@/lib/supabase/server'

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
  const search = searchParams.get('search') || ''
  const categoryIds = searchParams.get('categoryIds')?.split(',').filter(Boolean) || []
  const accountIds = searchParams.get('accountIds')?.split(',').filter(Boolean) || []
  const sources = searchParams.get('sources')?.split(',').filter(Boolean) || []
  const dateFrom = searchParams.get('dateFrom')
  const dateTo = searchParams.get('dateTo')
  const sortBy = searchParams.get('sortBy') || 'date'
  const sortDir = searchParams.get('sortDir') === 'asc' ? true : false
  const page = parseInt(searchParams.get('page') || '1', 10)
  const limit = parseInt(searchParams.get('limit') || '10', 10)

  // Build query
  let query = supabase
    .from('transactions')
    .select(
      `
      *,
      category:categories(id, name, color, type),
      from_account:accounts!transactions_from_account_id_fkey(id, name, type, icon),
      to_account:accounts!transactions_to_account_id_fkey(id, name, type, icon)
    `,
      { count: 'exact' }
    )
    .eq('user_id', user.id)

  // Search filter
  if (search) {
    query = query.ilike('description', `%${search}%`)
  }

  // Category filter
  if (categoryIds.length > 0) {
    query = query.in('category_id', categoryIds)
  }

  // Account filter
  if (accountIds.length > 0) {
    query = query.or(
      `from_account_id.in.(${accountIds.join(',')}),to_account_id.in.(${accountIds.join(',')})`
    )
  }

  // Source filter
  if (sources.length > 0) {
    query = query.in('source', sources)
  }

  // Date range filter
  if (dateFrom) {
    query = query.gte('date', dateFrom)
  }
  if (dateTo) {
    query = query.lte('date', dateTo)
  }

  // Sort
  const sortColumn = sortBy === 'category' ? 'category_id' : sortBy === 'account' ? 'from_account_id' : sortBy
  query = query.order(sortColumn, { ascending: sortDir })

  // Pagination
  const from = (page - 1) * limit
  const to = from + limit - 1
  query = query.range(from, to)

  const { data: transactions, error, count } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Compute summary from a separate query (unfiltered or filtered)
  let summaryQuery = supabase
    .from('transactions')
    .select('type, amount')
    .eq('user_id', user.id)

  if (search) summaryQuery = summaryQuery.ilike('description', `%${search}%`)
  if (categoryIds.length > 0) summaryQuery = summaryQuery.in('category_id', categoryIds)
  if (accountIds.length > 0) {
    summaryQuery = summaryQuery.or(
      `from_account_id.in.(${accountIds.join(',')}),to_account_id.in.(${accountIds.join(',')})`
    )
  }
  if (sources.length > 0) summaryQuery = summaryQuery.in('source', sources)
  if (dateFrom) summaryQuery = summaryQuery.gte('date', dateFrom)
  if (dateTo) summaryQuery = summaryQuery.lte('date', dateTo)

  const { data: summaryData } = await summaryQuery

  const summary = (summaryData || []).reduce(
    (acc, t) => {
      acc.count++
      const amount = Number(t.amount)
      if (t.type === 'income') acc.totalIncome += amount
      else if (t.type === 'expense') acc.totalExpenses += amount
      return acc
    },
    { count: 0, totalIncome: 0, totalExpenses: 0 }
  )

  // Map DB rows to component-friendly format
  const mappedTransactions = (transactions || []).map((t) => ({
    id: t.id,
    date: t.date,
    description: t.description,
    categoryId: t.category_id || '',
    accountId: t.from_account_id || t.to_account_id || '',
    fromAccountId: t.from_account_id,
    toAccountId: t.to_account_id,
    amount: t.type === 'expense' ? -Number(t.amount) : Number(t.amount),
    type: t.type,
    source: t.source,
    category: t.category,
    fromAccount: t.from_account,
    toAccount: t.to_account,
  }))

  return NextResponse.json({
    transactions: mappedTransactions,
    summary,
    totalCount: count || 0,
    page,
    limit,
    totalPages: Math.ceil((count || 0) / limit),
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
  const { type, date, description, amount, categoryId, accountId, fromAccountId, toAccountId, goalAllocations } = body

  // Validate required fields
  if (!type || !description || !amount || amount <= 0) {
    return NextResponse.json(
      { error: 'Missing required fields: type, description, amount (> 0)' },
      { status: 400 }
    )
  }

  if (type !== 'transfer' && !categoryId) {
    return NextResponse.json({ error: 'categoryId is required for income/expense' }, { status: 400 })
  }

  // Insert transaction
  const transactionData: Record<string, unknown> = {
    user_id: user.id,
    type,
    date: date || new Date().toISOString().split('T')[0],
    description,
    amount,
    source: 'manual',
    source_app: 'financial-ledger',
  }

  if (type === 'expense') {
    transactionData.from_account_id = accountId
    transactionData.category_id = categoryId
  } else if (type === 'income') {
    transactionData.to_account_id = accountId
    transactionData.category_id = categoryId
  } else if (type === 'transfer') {
    transactionData.from_account_id = fromAccountId
    transactionData.to_account_id = toAccountId
  }

  const { data: transaction, error } = await supabase
    .from('transactions')
    .insert(transactionData)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Update account balances
  if (type === 'expense' && accountId) {
    await supabase.rpc('update_account_balance', {
      p_account_id: accountId,
      p_delta: -amount,
    }).then(({ error: rpcError }) => {
      // Fallback to manual update if RPC doesn't exist
      if (rpcError) {
        return supabase
          .from('accounts')
          .update({ balance: supabase.rpc('get_balance_minus', { id: accountId, delta: amount }) as unknown as number })
          .eq('id', accountId)
      }
    })
  } else if (type === 'income' && accountId) {
    // For income, add to account balance
    const { data: account } = await supabase
      .from('accounts')
      .select('balance')
      .eq('id', accountId)
      .single()
    if (account) {
      await supabase
        .from('accounts')
        .update({ balance: Number(account.balance) + amount })
        .eq('id', accountId)
    }
  } else if (type === 'transfer') {
    // Subtract from source, add to destination
    if (fromAccountId) {
      const { data: fromAccount } = await supabase
        .from('accounts')
        .select('balance')
        .eq('id', fromAccountId)
        .single()
      if (fromAccount) {
        await supabase
          .from('accounts')
          .update({ balance: Number(fromAccount.balance) - amount })
          .eq('id', fromAccountId)
      }
    }
    if (toAccountId) {
      const { data: toAccount } = await supabase
        .from('accounts')
        .select('balance')
        .eq('id', toAccountId)
        .single()
      if (toAccount) {
        await supabase
          .from('accounts')
          .update({ balance: Number(toAccount.balance) + amount })
          .eq('id', toAccountId)
      }
    }
  }

  // Create goal contributions for transfers
  if (type === 'transfer' && goalAllocations && Array.isArray(goalAllocations)) {
    for (const allocation of goalAllocations) {
      if (allocation.goalId && allocation.amount > 0) {
        await supabase.from('goal_contributions').insert({
          goal_id: allocation.goalId,
          transaction_id: transaction.id,
          amount: allocation.amount,
          date: date || new Date().toISOString().split('T')[0],
        })

        // Update goal current_balance
        const { data: goal } = await supabase
          .from('goals')
          .select('current_balance')
          .eq('id', allocation.goalId)
          .single()
        if (goal) {
          await supabase
            .from('goals')
            .update({ current_balance: Number(goal.current_balance) + allocation.amount })
            .eq('id', allocation.goalId)
        }
      }
    }
  }

  return NextResponse.json({ transaction }, { status: 201 })
}
