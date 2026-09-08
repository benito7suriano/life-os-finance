// Server-side analytics helpers shared by /api/finance/{summary,budgets,insights}.
// Query functions take the finance-scoped client; the bucketing/averaging
// functions are pure so they can be unit-tested with fixtures.

import { toUsd } from '@/lib/fx'
import type { SupabaseClient } from '@supabase/supabase-js'

// The finance client is scoped to a non-`public` schema, which trips the
// default SupabaseClient generic — accept any schema (house pattern).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FinanceSupabase = SupabaseClient<any, any, any>

export interface TxRow {
  date: string
  amount: number | string
  currency: string | null
  category_id: string | null
  type: 'expense' | 'income'
}

export interface CategoryContext {
  /** Every expense-type category row, including excluded bookkeeping ones. */
  all: { id: string; name: string; parent_id: string | null; color: string | null }[]
  /** Bookkeeping categories (e.g. "Balance Adjustment") excluded from spend rollups. */
  excludedCategoryIds: Set<string>
  childToParent: Record<string, string>
  parents: { id: string; name: string; color: string | null }[]
  children: { id: string; name: string; parent_id: string }[]
}

// Categories that represent bookkeeping artifacts rather than real spending.
// "Balance Adjustment" is a Money Pro reconciliation entry (trues an account's
// computed balance up to its actual balance) — exclude it from all rollups.
export const EXCLUDED_CATEGORY_NAMES = new Set(['balance adjustment'])

export function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export async function fetchExpenseCategoryContext(supabase: FinanceSupabase): Promise<CategoryContext> {
  const { data, error } = await supabase
    .from('categories')
    .select('id, name, parent_id, color')
    .eq('type', 'expense')
    .order('name')
  if (error) throw new Error(`category fetch failed: ${error.message}`)

  const all = (data ?? []) as CategoryContext['all']
  const excludedCategoryIds = new Set(
    all
      .filter((c) => EXCLUDED_CATEGORY_NAMES.has((c.name || '').trim().toLowerCase()))
      .map((c) => c.id)
  )
  const parents = all
    .filter((c) => !c.parent_id && !excludedCategoryIds.has(c.id))
    .map(({ id, name, color }) => ({ id, name, color }))
  const children = all
    .filter((c) => c.parent_id && !excludedCategoryIds.has(c.id))
    .map((c) => ({ id: c.id, name: c.name, parent_id: c.parent_id as string }))
  const childToParent: Record<string, string> = {}
  for (const c of children) childToParent[c.id] = c.parent_id

  return { all, excludedCategoryIds, childToParent, parents, children }
}

/** Fetches transactions in date order, paginating past PostgREST's max-rows cap
 * (default 1000) so multi-year windows aggregate fully instead of silently
 * truncating. */
export async function fetchTransactionsPaged(
  supabase: FinanceSupabase,
  userId: string,
  opts: { types: ('expense' | 'income')[]; fromDate?: string; toDateExclusive?: string }
): Promise<TxRow[]> {
  const rows: TxRow[] = []
  const PAGE_SIZE = 1000
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = supabase
      .from('transactions')
      .select('date, amount, currency, category_id, type')
      .eq('user_id', userId)
      .in('type', opts.types)
      .order('date', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)
    if (opts.fromDate) query = query.gte('date', opts.fromDate)
    if (opts.toDateExclusive) query = query.lt('date', opts.toDateExclusive)
    const { data: page, error } = await query
    if (error) throw new Error(`transactions page fetch failed: ${error.message}`)
    if (!page || page.length === 0) break
    rows.push(...(page as TxRow[]))
    if (page.length < PAGE_SIZE) break
  }
  return rows
}

/** 'YYYY-MM' straight from the DATE string — no `new Date(str)` UTC-midnight
 * parsing, which shifts 1st-of-month rows into the prior month in western TZs. */
export function periodOf(dateStr: string): string {
  return dateStr.slice(0, 7)
}

/** 'YYYY-MM-01' for the month `offset` months away from `now`'s month (local). */
export function monthStartStr(now: Date, offset: number): string {
  const d = new Date(now.getFullYear(), now.getMonth() + offset, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

export interface ParentSpendItem {
  id: string
  name: string
  amount: number
  percent: number
  color: string
  transactionCount: number
}

/** Expense spend rolled up to parent categories (child spend counts toward its
 * parent), bookkeeping excluded, sorted by amount desc — the dashboard's
 * spending breakdown, reusable over any window of rows. */
export function rollupSpendingByParent(
  rows: TxRow[],
  catCtx: CategoryContext
): { total: number; categories: ParentSpendItem[] } {
  const parentSpend: Record<string, { amount: number; count: number }> = {}
  for (const t of rows) {
    if (t.type !== 'expense') continue
    const cid = t.category_id
    if (!cid || catCtx.excludedCategoryIds.has(cid)) continue
    const parentId = catCtx.childToParent[cid] ?? cid
    const entry = parentSpend[parentId] ?? { amount: 0, count: 0 }
    entry.amount += toUsd(Number(t.amount), t.currency)
    entry.count += 1
    parentSpend[parentId] = entry
  }
  const total = round2(Object.values(parentSpend).reduce((s, e) => s + e.amount, 0))
  const categories = catCtx.parents
    .filter((p) => parentSpend[p.id])
    .map((p) => ({
      id: p.id,
      name: p.name,
      amount: round2(parentSpend[p.id].amount),
      percent: total > 0 ? round2((parentSpend[p.id].amount / total) * 100) : 0,
      color: p.color || '#94a3b8',
      transactionCount: parentSpend[p.id].count,
    }))
    .sort((a, b) => b.amount - a.amount)
  return { total, categories }
}

/** 'Aug 2026' for a 'YYYY-MM' period (locale-safe: built from components). */
export function monthLabel(period: string): string {
  const [y, m] = period.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'short', year: 'numeric' })
}

export interface MonthBucket {
  income: number
  expenses: number
}

/** USD income/expense totals per 'YYYY-MM'; bookkeeping categories skipped. */
export function bucketByMonth(rows: TxRow[], excludedCategoryIds: Set<string>): Map<string, MonthBucket> {
  const buckets = new Map<string, MonthBucket>()
  for (const t of rows) {
    if (t.category_id && excludedCategoryIds.has(t.category_id)) continue
    const key = periodOf(t.date)
    const bucket = buckets.get(key) ?? { income: 0, expenses: 0 }
    const usd = toUsd(Number(t.amount), t.currency)
    if (t.type === 'income') bucket.income += usd
    else bucket.expenses += usd
    buckets.set(key, bucket)
  }
  return buckets
}

export interface MonthlyTrendItem {
  period: string
  label: string
  income: number
  expenses: number
}

/** The last `lastN` calendar months ending at `now`'s month, zero-filled. */
export function toMonthlyTrend(
  buckets: Map<string, MonthBucket>,
  lastN: number,
  now: Date
): MonthlyTrendItem[] {
  const items: MonthlyTrendItem[] = []
  for (let i = lastN - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const period = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const bucket = buckets.get(period)
    items.push({
      period,
      label: monthLabel(period),
      income: round2(bucket?.income ?? 0),
      expenses: round2(bucket?.expenses ?? 0),
    })
  }
  return items
}

/** Trailing average monthly spend per category since `sinceDateStr`, with child
 * spend also rolled into its parent — extracted from the budgets route's
 * budget-suggestion logic. Divides by months that actually have data (≤12). */
export function computeCategoryAverages(
  rows: TxRow[],
  excludedCategoryIds: Set<string>,
  childToParent: Record<string, string>,
  sinceDateStr: string
): Record<string, number> {
  const totals: Record<string, number> = {}
  const monthsWithData = new Set<string>()
  for (const t of rows) {
    if (t.type !== 'expense') continue
    if (t.date < sinceDateStr) continue
    const cid = t.category_id
    if (cid && excludedCategoryIds.has(cid)) continue
    monthsWithData.add(periodOf(t.date))
    if (!cid) continue
    const amt = toUsd(Number(t.amount), t.currency)
    totals[cid] = (totals[cid] || 0) + amt
    const parent = childToParent[cid]
    if (parent) totals[parent] = (totals[parent] || 0) + amt
  }
  const monthsCovered = Math.min(12, Math.max(1, monthsWithData.size))
  const averages: Record<string, number> = {}
  for (const [cid, total] of Object.entries(totals)) {
    averages[cid] = round2(total / monthsCovered)
  }
  return averages
}

/** Σ budgeted for a month: the month's snapshot when present, else the
 * budget's current amount (matches the budgets page's totalBudgeted). */
export async function fetchMonthlyBudgetTotal(
  supabase: FinanceSupabase,
  userId: string,
  monthStartStr: string
): Promise<number> {
  const [budgetsRes, snapshotsRes] = await Promise.all([
    supabase.from('budgets').select('id, amount').eq('user_id', userId),
    supabase
      .from('budget_monthly_snapshots')
      .select('budget_id, budgeted_amount')
      .eq('user_id', userId)
      .eq('month', monthStartStr),
  ])
  if (budgetsRes.error) throw new Error(`budgets fetch failed: ${budgetsRes.error.message}`)
  const snapshotByBudget = new Map(
    ((snapshotsRes.data ?? []) as { budget_id: string; budgeted_amount: number | string }[]).map(
      (s) => [s.budget_id, Number(s.budgeted_amount)]
    )
  )
  return ((budgetsRes.data ?? []) as { id: string; amount: number | string }[]).reduce(
    (sum, b) => sum + (snapshotByBudget.get(b.id) ?? Number(b.amount)),
    0
  )
}
