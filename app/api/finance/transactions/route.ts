import { NextRequest, NextResponse } from 'next/server'
import { createFinanceClient } from '@/lib/supabase/server'
import { toUsd, fromUsd } from '@/lib/fx'

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

  // Compute summary from a separate query (unfiltered or filtered). Build a
  // fresh filtered builder each iteration so we can paginate past PostgREST's
  // max-rows (1000) cap — otherwise totals silently truncate to the first page.
  const buildSummaryQuery = () => {
    let q = supabase
      .from('transactions')
      .select('type, amount, currency')
      .eq('user_id', user.id)

    if (search) q = q.ilike('description', `%${search}%`)
    if (categoryIds.length > 0) q = q.in('category_id', categoryIds)
    if (accountIds.length > 0) {
      q = q.or(
        `from_account_id.in.(${accountIds.join(',')}),to_account_id.in.(${accountIds.join(',')})`
      )
    }
    if (sources.length > 0) q = q.in('source', sources)
    if (dateFrom) q = q.gte('date', dateFrom)
    if (dateTo) q = q.lte('date', dateTo)
    return q
  }

  const SUMMARY_PAGE_SIZE = 1000
  const summaryData: { type: string; amount: number | string; currency: string | null }[] = []
  for (let from = 0; ; from += SUMMARY_PAGE_SIZE) {
    const { data: page } = await buildSummaryQuery().range(from, from + SUMMARY_PAGE_SIZE - 1)
    if (!page || page.length === 0) break
    summaryData.push(...page)
    if (page.length < SUMMARY_PAGE_SIZE) break
  }

  // Totals must be currency-normalized: summing raw amounts across USD + DOP
  // rows is meaningless. `*Usd` fields are authoritative; the UI displays those.
  const summary = summaryData.reduce(
    (acc, t) => {
      acc.count++
      const amountUsd = toUsd(Number(t.amount), t.currency)
      if (t.type === 'income') acc.totalIncomeUsd += amountUsd
      else if (t.type === 'expense') acc.totalExpensesUsd += amountUsd
      return acc
    },
    { count: 0, totalIncomeUsd: 0, totalExpensesUsd: 0, netUsd: 0 }
  )
  // Net cash flow for the filtered view: positive = inflow, negative = outflow.
  summary.netUsd = summary.totalIncomeUsd - summary.totalExpensesUsd

  // Map DB rows to component-friendly format
  const mappedTransactions = (transactions || []).map((t) => {
    const signedAmount = t.type === 'expense' ? -Number(t.amount) : Number(t.amount)
    const currency = t.currency || 'USD'
    return {
      id: t.id,
      date: t.date,
      description: t.description,
      categoryId: t.category_id || '',
      accountId: t.from_account_id || t.to_account_id || '',
      fromAccountId: t.from_account_id,
      toAccountId: t.to_account_id,
      amount: signedAmount,
      currency,
      // USD-converted — the only amount the UI should aggregate.
      amountUsd: toUsd(signedAmount, currency),
      // Destination leg of a cross-currency transfer (null otherwise).
      toAmount: t.to_amount != null ? Number(t.to_amount) : undefined,
      toCurrency: t.to_currency || undefined,
      type: t.type,
      source: t.source,
      category: t.category,
      fromAccount: t.from_account,
      toAccount: t.to_account,
    }
  })

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
  const { type, date, description, amount, categoryId, accountId, fromAccountId, toAccountId, toAmount, toCurrency, goalAllocations } = body

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

  // Fetch the native currency + balance of every account involved, so we can
  // stamp the transaction's currency and convert the destination leg of a
  // cross-currency transfer. One round-trip, reused for the balance updates.
  const involvedIds = [accountId, fromAccountId, toAccountId].filter(Boolean) as string[]
  const acctMap = new Map<string, { balance: number; currency: string }>()
  if (involvedIds.length > 0) {
    const { data: involved } = await supabase
      .from('accounts')
      .select('id, balance, currency')
      .in('id', involvedIds)
    for (const a of involved || []) {
      acctMap.set(a.id, { balance: Number(a.balance), currency: a.currency || 'USD' })
    }
  }

  // Source-leg currency: the account money left (expense/transfer) or entered (income).
  const sourceAccountId = type === 'transfer' ? fromAccountId : accountId
  const sourceCurrency = acctMap.get(sourceAccountId)?.currency ?? 'USD'

  // Insert transaction
  const transactionData: Record<string, unknown> = {
    user_id: user.id,
    type,
    date: date || new Date().toISOString().split('T')[0],
    description,
    amount,
    currency: sourceCurrency,
    source: 'manual',
    source_app: 'financial-ledger',
  }

  // Amount credited to the destination of a transfer. Mirrors `amount` for
  // same-currency transfers; converted/explicit for cross-currency ones.
  let creditAmount = amount

  if (type === 'expense') {
    transactionData.from_account_id = accountId
    transactionData.category_id = categoryId
  } else if (type === 'income') {
    transactionData.to_account_id = accountId
    transactionData.category_id = categoryId
  } else if (type === 'transfer') {
    transactionData.from_account_id = fromAccountId
    transactionData.to_account_id = toAccountId
    const destCurrency = toCurrency || acctMap.get(toAccountId)?.currency || sourceCurrency
    if (destCurrency !== sourceCurrency) {
      // Cross-currency: prefer the actual settled amount the caller provides;
      // otherwise convert source → USD → destination via the central rate.
      creditAmount = toAmount != null ? Number(toAmount) : fromUsd(toUsd(amount, sourceCurrency), destCurrency)
      transactionData.to_currency = destCurrency
      transactionData.to_amount = creditAmount
    }
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
    // Debit the source in its currency (`amount`); credit the destination in
    // *its* currency (`creditAmount`) — equal for same-currency transfers,
    // FX-converted otherwise.
    const fromAccount = fromAccountId ? acctMap.get(fromAccountId) : undefined
    if (fromAccount) {
      await supabase
        .from('accounts')
        .update({ balance: fromAccount.balance - amount })
        .eq('id', fromAccountId)
    }
    const toAccount = toAccountId ? acctMap.get(toAccountId) : undefined
    if (toAccount) {
      await supabase
        .from('accounts')
        .update({ balance: toAccount.balance + creditAmount })
        .eq('id', toAccountId)
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
