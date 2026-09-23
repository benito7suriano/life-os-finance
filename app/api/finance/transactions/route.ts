import { NextRequest, NextResponse } from 'next/server'
import { createFinanceClient } from '@/lib/supabase/server'
import { toUsd } from '@/lib/fx'
import { createLedgerTransaction, validateLedgerTransaction } from '@/lib/finance/transactions'

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
  const types = searchParams.get('types')?.split(',').filter(Boolean) || []
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
      `from_account_id.in.(${accountIds.join(',')}),to_account_id.in.(${accountIds.join(',')}),related_asset_id.in.(${accountIds.join(',')})`
    )
  }

  // Source filter
  if (sources.length > 0) {
    query = query.in('source', sources)
  }

  // Type filter (expense / income / transfer)
  if (types.length > 0) {
    query = query.in('type', types)
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

  // Compute summary from a separate query with the same filters, paginated
  // past PostgREST's max-rows cap so totals stay exact beyond 1000 rows.
  const buildSummaryQuery = () => {
    let q = supabase
      .from('transactions')
      .select('id, type, amount, currency')
      .eq('user_id', user.id)
    if (search) q = q.ilike('description', `%${search}%`)
    if (categoryIds.length > 0) q = q.in('category_id', categoryIds)
    if (accountIds.length > 0) {
      q = q.or(
        `from_account_id.in.(${accountIds.join(',')}),to_account_id.in.(${accountIds.join(',')}),related_asset_id.in.(${accountIds.join(',')})`
      )
    }
    if (sources.length > 0) q = q.in('source', sources)
    if (types.length > 0) q = q.in('type', types)
    if (dateFrom) q = q.gte('date', dateFrom)
    if (dateTo) q = q.lte('date', dateTo)
    return q
  }

  const summaryData: { type: string; amount: number | string; currency: string | null }[] = []
  const SUMMARY_PAGE = 1000
  for (let start = 0; ; start += SUMMARY_PAGE) {
    // Stable order (unique id) so pages never skip or repeat rows.
    const { data: summaryPage } = await buildSummaryQuery()
      .order('id', { ascending: true })
      .range(start, start + SUMMARY_PAGE - 1)
    if (!summaryPage || summaryPage.length === 0) break
    summaryData.push(...summaryPage)
    if (summaryPage.length < SUMMARY_PAGE) break
  }

  // Totals must be currency-normalized: summing raw amounts across USD + DOP
  // rows is meaningless. `*Usd` fields are authoritative; the UI displays those.
  const summary = (summaryData || []).reduce(
    (acc, t) => {
      acc.count++
      const amountUsd = toUsd(Number(t.amount), t.currency)
      if (t.type === 'income') acc.totalIncomeUsd += amountUsd
      else if (t.type === 'expense') acc.totalExpensesUsd += amountUsd
      return acc
    },
    { count: 0, totalIncomeUsd: 0, totalExpensesUsd: 0 }
  )

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
      relatedAssetId: t.related_asset_id || undefined,
      assetActivityKind: t.asset_activity_kind || undefined,
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
  const validationError = validateLedgerTransaction(body)
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 })
  try {
    const transaction = await createLedgerTransaction(supabase, user.id, body)
    return NextResponse.json({ transaction }, { status: 201 })
  } catch (cause) {
    return NextResponse.json({ error: cause instanceof Error ? cause.message : 'Unable to create transaction' }, { status: 500 })
  }
}
