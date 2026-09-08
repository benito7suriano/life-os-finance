// Read-only tools for the wealth-manager agent. Every executor takes the
// finance-scoped service client + the verified user id, returns JSON, and
// reports money in USD (native amount + currency alongside where useful).
// Schemas are closed (additionalProperties: false) and their descriptions say
// WHEN to call the tool — that trigger text is what drives tool selection.
// v2 write tools (budgets) will join this file behind the same interface.

import type { ToolDefinition } from './types'
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
  EXCLUDED_CATEGORY_NAMES,
  type MonthlyTrendItem,
} from '@/lib/finance/history'
import { computeFinanceSummary } from '@/lib/finance/summary'
import { fetchNetWorthHistory, type NetWorthPoint } from '@/lib/finance/snapshots'
import { computeBudgetProjection } from '@/lib/finance/projection'
import { assembleInsightInput } from '@/lib/insights/assemble'
import { buildInsights } from '@/lib/insights/rules'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FinanceSupabase = SupabaseClient<any, any, any>

export interface ToolContext {
  supabase: FinanceSupabase
  userId: string
  now: Date
  /** Hands transaction-shaped text to the extraction + confirm pipeline. */
  logTransaction?: (text: string) => Promise<void>
}

// ---------------------------------------------------------------------------
// Definitions

const DATE = { type: 'string', description: 'YYYY-MM-DD' } as const

function schema(
  properties: Record<string, unknown>,
  required: string[] = []
): Record<string, unknown> {
  return { type: 'object', properties, required, additionalProperties: false }
}

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'get_financial_overview',
    description:
      'Call this when the user asks for their net worth, overall financial position, this month at a glance, or "how am I doing". Returns net worth (assets minus debt), this month\'s income/expenses/net, budget pacing, and the top spending categories this month. All amounts USD.',
    input_schema: schema({}),
  },
  {
    name: 'get_accounts',
    description:
      'Call this when the user asks about a specific account, account balances, how much cash they have, or what they owe on a card or loan. Returns every live account with its native balance, currency and USD equivalent. Debt balances are negative.',
    input_schema: schema({}),
  },
  {
    name: 'query_transactions',
    description:
      'Call this when the user asks about specific transactions: biggest/largest expenses, what they spent at a merchant, recent purchases, or income received. Use sort="amount" for "biggest" questions. Bookkeeping balance-adjustment rows are excluded. Defaults to the last 90 days when no dates are given.',
    input_schema: schema({
      from_date: { ...DATE, description: 'Inclusive start date, YYYY-MM-DD. Default: 90 days ago.' },
      to_date: { ...DATE, description: 'Inclusive end date, YYYY-MM-DD. Default: today.' },
      type: { type: 'string', enum: ['expense', 'income', 'transfer'], description: 'Omit for all types.' },
      category: { type: 'string', description: 'Category name (case-insensitive). A parent category includes its subcategories.' },
      merchant_contains: { type: 'string', description: 'Case-insensitive substring matched against merchant name or description.' },
      min_amount_usd: { type: 'number', description: 'Only rows at or above this USD amount.' },
      sort: { type: 'string', enum: ['date', 'amount'], description: '"date" = newest first (default); "amount" = largest USD first.' },
      limit: { type: 'integer', description: 'Max rows to return, 1–50. Default 20.' },
    }),
  },
  {
    name: 'get_spending_by_category',
    description:
      'Call this when the user asks where their money went, spending by category, or their biggest expense categories for a period. Returns expense totals rolled up to parent categories with a subcategory breakdown, sorted by amount. Bookkeeping rows excluded.',
    input_schema: schema(
      {
        from_date: { ...DATE, description: 'Inclusive start date.' },
        to_date: { ...DATE, description: 'Inclusive end date.' },
      },
      ['from_date', 'to_date']
    ),
  },
  {
    name: 'get_monthly_cashflow',
    description:
      'Call this when the user asks for income or expenses over time, a monthly table, trends, savings per month, or year-over-year change. Returns one row per calendar month (oldest first) with income, expenses and net, plus a year-over-year comparison for the latest full month when 13+ months are available. Ask for 13 or 24 months for YoY questions.',
    input_schema: schema({
      months: { type: 'integer', description: 'Number of trailing calendar months including the current one, 1–36. Default 12.' },
    }),
  },
  {
    name: 'get_budget_status',
    description:
      'Call this when the user asks about budgets, whether they are on track, which categories risk going over budget this month, how much budget is left, or how they did against budget in a past month. Returns each budget with spent, remaining, percent used, the straight-line projected month-end spend and a status (on_track, warning = projected to exceed, over_budget = already exceeded), riskiest first.',
    input_schema: schema({
      month: { type: 'string', description: 'YYYY-MM. Default: the current month. Past months are evaluated over their full length.' },
    }),
  },
  {
    name: 'get_insights',
    description:
      'Call this when the user asks for insights, advice, what to watch out for, anything unusual, or an overall check-up. Returns the ranked findings from the deterministic insights engine (budget pacing, category anomalies vs trailing average, upcoming card payments, low cash buffer, savings rate).',
    input_schema: schema({}),
  },
  {
    name: 'get_net_worth_history',
    description:
      'Call this when the user asks how their net worth has changed, net worth over time, or progress since a date. Returns daily net-worth points from balance snapshots between the dates, the start/end values and the change. If history begins after the requested start, the response says so — tell the user.',
    input_schema: schema({
      from_date: { ...DATE, description: 'Inclusive start date. Default: 90 days ago.' },
      to_date: { ...DATE, description: 'Inclusive end date. Default: today.' },
    }),
  },
  {
    name: 'log_transaction',
    description:
      'Call this when the user\'s message is a transaction to record rather than a question — e.g. "$12 coffee at Blue Bottle", "paid 2,500 pesos for gas", "got paid 3000". Pass the user\'s text verbatim. The pipeline sends its own confirmation card, so reply with nothing else after calling it.',
    input_schema: schema({ text: { type: 'string', description: 'The user\'s message, verbatim.' } }, ['text']),
  },
]

// ---------------------------------------------------------------------------
// Helpers

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function daysAgo(now: Date, days: number): string {
  return toDateStr(new Date(now.getFullYear(), now.getMonth(), now.getDate() - days))
}

function nextDay(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return toDateStr(new Date(y, m - 1, d + 1))
}

/** Supabase returns many-to-one joins as an object, or an array on some
 * client versions — accept either. */
function one<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return null
  return round2(((current - previous) / Math.abs(previous)) * 100)
}

// ---------------------------------------------------------------------------
// Executors

export async function getFinancialOverview(ctx: ToolContext) {
  const s = await computeFinanceSummary(ctx.supabase, ctx.userId, ctx.now)
  const period = monthStartStr(ctx.now, 0).slice(0, 7)
  return {
    asOf: toDateStr(ctx.now),
    netWorthUsd: round2(s.netWorth),
    assetsUsd: round2(s.assets),
    liabilitiesUsd: round2(s.liabilities),
    currentMonth: {
      period,
      incomeUsd: s.monthlyIncome,
      expensesUsd: s.monthlyExpenses,
      netUsd: s.monthlyNet,
    },
    budgetPacing: s.budgetProjection,
    topSpendingCategories: s.spendingByCategory.categories.slice(0, 5).map((c) => ({
      name: c.name,
      amountUsd: c.amount,
      percent: c.percent,
    })),
    monthlyTrend: s.monthlyTrend.slice(-6).map((m) => ({
      period: m.period,
      incomeUsd: m.income,
      expensesUsd: m.expenses,
    })),
  }
}

export async function getAccounts(ctx: ToolContext) {
  const { data, error } = await ctx.supabase
    .from('accounts')
    .select('id, name, type, balance, currency, credit_limit, payment_date, institution:institutions(name)')
    .eq('user_id', ctx.userId)
    .is('deleted_at', null)
    .order('type')
  if (error) throw new Error(`accounts fetch failed: ${error.message}`)
  const accounts = ((data ?? []) as {
    id: string
    name: string
    type: string
    balance: number | string
    currency: string | null
    credit_limit: number | string | null
    payment_date: number | string | null
    institution: { name: string } | { name: string }[] | null
  }[]).map((a) => ({
    name: a.name,
    type: a.type,
    institution: one(a.institution)?.name ?? null,
    balance: round2(Number(a.balance)),
    currency: a.currency ?? 'USD',
    balanceUsd: round2(toUsd(Number(a.balance), a.currency)),
    creditLimit: a.credit_limit != null ? Number(a.credit_limit) : null,
    paymentDay: a.payment_date != null ? Number(a.payment_date) : null,
  }))
  return {
    accounts,
    totalAssetsUsd: round2(
      accounts
        .filter((a) => ['checking', 'savings', 'wallet', 'investment'].includes(a.type))
        .reduce((s, a) => s + a.balanceUsd, 0)
    ),
    totalDebtUsd: round2(
      -accounts
        .filter((a) => ['credit_card', 'loan'].includes(a.type))
        .reduce((s, a) => s + a.balanceUsd, 0)
    ),
  }
}

export interface QueryTransactionsInput {
  from_date?: string
  to_date?: string
  type?: 'expense' | 'income' | 'transfer'
  category?: string
  merchant_contains?: string
  min_amount_usd?: number
  sort?: 'date' | 'amount'
  limit?: number
}

interface TxJoinedRow {
  id: string
  date: string
  amount: number | string
  currency: string | null
  type: string
  description: string | null
  category_id: string | null
  to_amount: number | string | null
  to_currency: string | null
  category: { name: string; parent_id: string | null } | { name: string; parent_id: string | null }[] | null
  merchant: { name: string } | { name: string }[] | null
  from_account: { name: string } | { name: string }[] | null
  to_account: { name: string } | { name: string }[] | null
}

export async function queryTransactions(ctx: ToolContext, input: QueryTransactionsInput) {
  const fromDate = input.from_date ?? daysAgo(ctx.now, 90)
  const toDate = input.to_date ?? toDateStr(ctx.now)
  const limit = Math.min(50, Math.max(1, input.limit ?? 20))

  const { data: catData, error: catErr } = await ctx.supabase
    .from('categories')
    .select('id, name, parent_id, type')
    .eq('user_id', ctx.userId)
  if (catErr) throw new Error(`category fetch failed: ${catErr.message}`)
  const categories = (catData ?? []) as { id: string; name: string; parent_id: string | null }[]
  const excludedIds = new Set(
    categories.filter((c) => EXCLUDED_CATEGORY_NAMES.has(c.name.trim().toLowerCase())).map((c) => c.id)
  )

  let categoryIds: string[] | null = null
  if (input.category) {
    const wanted = input.category.trim().toLowerCase()
    const matches = categories.filter((c) => c.name.trim().toLowerCase() === wanted)
    const ids = new Set<string>()
    for (const m of matches) {
      ids.add(m.id)
      for (const c of categories) if (c.parent_id === m.id) ids.add(c.id)
    }
    categoryIds = [...ids]
    if (categoryIds.length === 0) {
      return { count: 0, totalUsd: 0, transactions: [], note: `No category named "${input.category}".` }
    }
  }

  const rows: TxJoinedRow[] = []
  const PAGE_SIZE = 1000
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = ctx.supabase
      .from('transactions')
      .select(
        `id, date, amount, currency, type, description, category_id, to_amount, to_currency,
         category:categories(name, parent_id),
         merchant:merchants(name),
         from_account:accounts!transactions_from_account_id_fkey(name),
         to_account:accounts!transactions_to_account_id_fkey(name)`
      )
      .eq('user_id', ctx.userId)
      .gte('date', fromDate)
      .lte('date', toDate)
      .order('date', { ascending: false })
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)
    if (input.type) query = query.eq('type', input.type)
    if (categoryIds) query = query.in('category_id', categoryIds)
    const { data, error } = await query
    if (error) throw new Error(`transactions fetch failed: ${error.message}`)
    if (!data || data.length === 0) break
    rows.push(...(data as TxJoinedRow[]))
    if (data.length < PAGE_SIZE) break
  }

  const needle = input.merchant_contains?.trim().toLowerCase()
  const mapped = rows
    .filter((r) => !(r.category_id && excludedIds.has(r.category_id)))
    .map((r) => {
      const amountUsd = round2(toUsd(Number(r.amount), r.currency))
      const merchant = one(r.merchant)?.name ?? null
      return {
        date: r.date,
        type: r.type,
        amountUsd,
        amount: round2(Number(r.amount)),
        currency: r.currency ?? 'USD',
        merchant,
        description: r.description || null,
        category: one(r.category)?.name ?? null,
        account: one(r.from_account)?.name ?? one(r.to_account)?.name ?? null,
        toAccount: r.type === 'transfer' ? one(r.to_account)?.name ?? null : undefined,
      }
    })
    .filter((t) => {
      if (needle) {
        const hay = `${t.merchant ?? ''} ${t.description ?? ''}`.toLowerCase()
        if (!hay.includes(needle)) return false
      }
      if (input.min_amount_usd != null && t.amountUsd < input.min_amount_usd) return false
      return true
    })

  if (input.sort === 'amount') mapped.sort((a, b) => b.amountUsd - a.amountUsd)
  else mapped.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))

  return {
    count: mapped.length,
    totalUsd: round2(mapped.reduce((s, t) => s + t.amountUsd, 0)),
    transactions: mapped.slice(0, limit),
    window: { from: fromDate, to: toDate },
  }
}

export async function getSpendingByCategory(ctx: ToolContext, input: { from_date: string; to_date: string }) {
  const [catCtx, rows] = await Promise.all([
    fetchExpenseCategoryContext(ctx.supabase),
    fetchTransactionsPaged(ctx.supabase, ctx.userId, {
      types: ['expense'],
      fromDate: input.from_date,
      toDateExclusive: nextDay(input.to_date),
    }),
  ])
  const rollup = rollupSpendingByParent(rows, catCtx)

  const childSpend: Record<string, number> = {}
  for (const t of rows) {
    if (t.category_id && catCtx.childToParent[t.category_id]) {
      childSpend[t.category_id] = (childSpend[t.category_id] ?? 0) + toUsd(Number(t.amount), t.currency)
    }
  }

  return {
    window: { from: input.from_date, to: input.to_date },
    totalUsd: rollup.total,
    categories: rollup.categories.map((c) => ({
      name: c.name,
      amountUsd: c.amount,
      percent: c.percent,
      transactionCount: c.transactionCount,
      subcategories: catCtx.children
        .filter((ch) => ch.parent_id === c.id && childSpend[ch.id])
        .map((ch) => ({ name: ch.name, amountUsd: round2(childSpend[ch.id]) }))
        .sort((a, b) => b.amountUsd - a.amountUsd),
    })),
  }
}

export interface CashflowMonth extends MonthlyTrendItem {
  net: number
}

export function yearOverYear(months: CashflowMonth[], period: string) {
  const [y, m] = period.split('-')
  const prevPeriod = `${Number(y) - 1}-${m}`
  const current = months.find((x) => x.period === period)
  const previous = months.find((x) => x.period === prevPeriod)
  if (!current || !previous) return null
  return {
    period,
    comparedTo: prevPeriod,
    expenses: {
      current: current.expenses,
      previous: previous.expenses,
      changePct: pctChange(current.expenses, previous.expenses),
    },
    income: {
      current: current.income,
      previous: previous.income,
      changePct: pctChange(current.income, previous.income),
    },
  }
}

export async function getMonthlyCashflow(ctx: ToolContext, input: { months?: number }) {
  const months = Math.min(36, Math.max(1, input.months ?? 12))
  const [catCtx, rows] = await Promise.all([
    fetchExpenseCategoryContext(ctx.supabase),
    fetchTransactionsPaged(ctx.supabase, ctx.userId, {
      types: ['expense', 'income'],
      fromDate: monthStartStr(ctx.now, -(months - 1)),
      toDateExclusive: monthStartStr(ctx.now, 1),
    }),
  ])
  const trend = toMonthlyTrend(bucketByMonth(rows, catCtx.excludedCategoryIds), months, ctx.now)
  const table: CashflowMonth[] = trend.map((m) => ({ ...m, net: round2(m.income - m.expenses) }))
  // Latest FULL month (the current one is partial).
  const latestFull = monthStartStr(ctx.now, -1).slice(0, 7)
  return {
    months: table,
    totals: {
      incomeUsd: round2(table.reduce((s, m) => s + m.income, 0)),
      expensesUsd: round2(table.reduce((s, m) => s + m.expenses, 0)),
    },
    yearOverYear: yearOverYear(table, latestFull),
    note: `The current month (${periodOf(toDateStr(ctx.now))}) is partial.`,
  }
}

const STATUS_RANK = { over_budget: 0, warning: 1, on_track: 2 } as const

export async function getBudgetStatus(ctx: ToolContext, input: { month?: string } = {}) {
  const period = input.month && /^\d{4}-\d{2}$/.test(input.month) ? input.month : monthStartStr(ctx.now, 0).slice(0, 7)
  const [py, pm] = period.split('-').map(Number)
  const monthStart = `${period}-01`
  const monthEndExclusive = monthStartStr(new Date(py, pm - 1, 1), 1)
  // A past month is evaluated over its full length; the current month paces
  // from today; a future month has no spend yet.
  const currentPeriod = monthStartStr(ctx.now, 0).slice(0, 7)
  const today =
    period < currentPeriod ? new Date(py, pm, 0) : period > currentPeriod ? new Date(py, pm - 1, 1) : ctx.now

  const [budgetsRes, snapshotsRes, catCtx, rows] = await Promise.all([
    ctx.supabase
      .from('budgets')
      .select('id, amount, type, category_id, category:categories(id, name, parent_id)')
      .eq('user_id', ctx.userId),
    ctx.supabase
      .from('budget_monthly_snapshots')
      .select('budget_id, budgeted_amount')
      .eq('user_id', ctx.userId)
      .eq('month', monthStart),
    fetchExpenseCategoryContext(ctx.supabase),
    fetchTransactionsPaged(ctx.supabase, ctx.userId, {
      types: ['expense'],
      fromDate: monthStart,
      toDateExclusive: monthEndExclusive,
    }),
  ])
  if (budgetsRes.error) throw new Error(`budgets fetch failed: ${budgetsRes.error.message}`)

  const spentByCategory: Record<string, number> = {}
  let totalSpent = 0
  for (const t of rows) {
    if (!t.category_id || catCtx.excludedCategoryIds.has(t.category_id)) continue
    const usd = toUsd(Number(t.amount), t.currency)
    spentByCategory[t.category_id] = (spentByCategory[t.category_id] ?? 0) + usd
    totalSpent += usd
  }
  const snapshotByBudget = new Map(
    ((snapshotsRes.data ?? []) as { budget_id: string; budgeted_amount: number | string }[]).map((s) => [
      s.budget_id,
      Number(s.budgeted_amount),
    ])
  )

  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
  const dayOfMonth = today.getDate()

  const budgets = ((budgetsRes.data ?? []) as {
    id: string
    amount: number | string
    type: string
    category_id: string
    category: { id: string; name: string; parent_id: string | null } | { id: string; name: string; parent_id: string | null }[] | null
  }[]).map((b) => {
    const cat = one(b.category)
    const isChild = cat?.parent_id != null
    // Same semantics as the Budgets page: a parent-category budget covers the
    // parent plus all its subcategories; a subcategory budget is exact.
    let spent = spentByCategory[b.category_id] ?? 0
    if (!isChild) {
      for (const child of catCtx.children) {
        if (child.parent_id === b.category_id) spent += spentByCategory[child.id] ?? 0
      }
    }
    const budgeted = snapshotByBudget.get(b.id) ?? Number(b.amount)
    const projection = computeBudgetProjection({ totalBudget: budgeted, spent, today })
    return {
      category: cat?.name ?? b.category_id,
      kind: b.type,
      budgeted: round2(budgeted),
      spent: round2(spent),
      remaining: projection.remaining,
      percentUsed: projection.percentUsed,
      projectedMonthEnd: round2((spent / dayOfMonth) * daysInMonth),
      status: projection.status,
    }
  })

  budgets.sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || b.percentUsed - a.percentUsed)
  const totalBudgeted = round2(budgets.reduce((s, b) => s + b.budgeted, 0))

  return {
    month: period,
    daysRemaining: daysInMonth - dayOfMonth,
    totalBudgeted,
    totalSpent: round2(totalSpent),
    overall: computeBudgetProjection({ totalBudget: totalBudgeted, spent: totalSpent, today }),
    budgets,
  }
}

export async function getInsights(ctx: ToolContext) {
  const insights = buildInsights(await assembleInsightInput(ctx.supabase, ctx.userId, ctx.now))
  return {
    insights: insights.map((i) => ({
      kind: i.kind,
      score: i.score,
      // The parts carry their own spacing (e.g. lead ends with a space).
      headline: `${i.headline.lead}${i.headline.accent}${i.headline.tail}`.replace(/\s+/g, ' ').trim(),
      body: i.body,
    })),
  }
}

export async function getNetWorthHistory(ctx: ToolContext, input: { from_date?: string; to_date?: string }) {
  const from = input.from_date ?? daysAgo(ctx.now, 90)
  const to = input.to_date ?? toDateStr(ctx.now)
  const points = await fetchNetWorthHistory(ctx.supabase, ctx.userId, { fromDate: from, toDate: to })
  if (points.length === 0) {
    return {
      from,
      to,
      historyBeginsAt: null,
      points: [] as NetWorthPoint[],
      start: null,
      end: null,
      change: null,
      note: 'No net-worth history in this window yet — daily snapshots start when the cron first runs.',
    }
  }
  const start = points[0]
  const end = points[points.length - 1]
  const amountUsd = round2(end.netWorth - start.netWorth)
  return {
    from,
    to,
    historyBeginsAt: start.date,
    points: thin(points, 40),
    start,
    end,
    change: { amountUsd, percent: pctChange(end.netWorth, start.netWorth) },
    note:
      start.date > from
        ? `History begins ${start.date}; there are no snapshots before that date.`
        : null,
  }
}

/** Keeps at most `max` points (always the first and last) so a year of daily
 * rows doesn't flood the model's context. */
function thin<T>(points: T[], max: number): T[] {
  if (points.length <= max) return points
  const step = (points.length - 1) / (max - 1)
  return Array.from({ length: max }, (_, i) => points[Math.round(i * step)])
}

// ---------------------------------------------------------------------------
// Dispatch

export async function executeTool(name: string, input: unknown, ctx: ToolContext): Promise<unknown> {
  // Inputs are validated server-side against the strict schemas above.
  const args = (input ?? {}) as Record<string, unknown>
  switch (name) {
    case 'get_financial_overview':
      return getFinancialOverview(ctx)
    case 'get_accounts':
      return getAccounts(ctx)
    case 'query_transactions':
      return queryTransactions(ctx, args as QueryTransactionsInput)
    case 'get_spending_by_category':
      return getSpendingByCategory(ctx, args as { from_date: string; to_date: string })
    case 'get_monthly_cashflow':
      return getMonthlyCashflow(ctx, args as { months?: number })
    case 'get_budget_status':
      return getBudgetStatus(ctx, args as { month?: string })
    case 'get_insights':
      return getInsights(ctx)
    case 'get_net_worth_history':
      return getNetWorthHistory(ctx, args as { from_date?: string; to_date?: string })
    case 'log_transaction': {
      if (!ctx.logTransaction) throw new Error('log_transaction is not available in this context')
      await ctx.logTransaction(String(args.text ?? ''))
      return { status: 'confirmation_card_sent' }
    }
    default:
      throw new Error(`Unknown tool: ${name}`)
  }
}
