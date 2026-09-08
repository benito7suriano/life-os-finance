// Daily per-account balance snapshots → net-worth history. The daily cron
// captures a row per account; the backfill script reconstructs older rows
// from transactions. All USD math is frozen into balance_usd at capture time.

import type { SupabaseClient } from '@supabase/supabase-js'
import { toUsd } from '@/lib/fx'
import { round2 } from './history'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FinanceSupabase = SupabaseClient<any, any, any>

const ASSET_TYPES = new Set(['checking', 'savings', 'wallet', 'investment'])
const LIABILITY_TYPES = new Set(['credit_card', 'loan'])

export interface SnapshotRow {
  snapshot_date: string
  account_type: string
  balance_usd: number | string
}

export interface NetWorthPoint {
  date: string
  assets: number
  /** Positive magnitude of debt ("you owe X"), matching /api/finance/summary. */
  liabilities: number
  netWorth: number
}

/** Same classification as the summary route: debt balances are stored
 * negative, so the signed liability sum subtracts from assets. */
export function computeNetWorthFromSnapshots(rows: SnapshotRow[]): NetWorthPoint[] {
  const byDate = new Map<string, { assets: number; liabilitiesSigned: number }>()
  for (const r of rows) {
    const entry = byDate.get(r.snapshot_date) ?? { assets: 0, liabilitiesSigned: 0 }
    const usd = Number(r.balance_usd)
    if (ASSET_TYPES.has(r.account_type)) entry.assets += usd
    else if (LIABILITY_TYPES.has(r.account_type)) entry.liabilitiesSigned += usd
    byDate.set(r.snapshot_date, entry)
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([date, e]) => ({
      date,
      assets: round2(e.assets),
      // `0 - x` rather than `-x` so a debt-free day yields 0, not -0.
      liabilities: round2(0 - e.liabilitiesSigned),
      netWorth: round2(e.assets + e.liabilitiesSigned),
    }))
}

export interface BalanceLeg {
  date: string
  type: string
  amount: number | string
  to_amount?: number | string | null
  from_account_id?: string | null
  to_account_id?: string | null
}

/** Signed effect of one transaction row on one account's native balance —
 * mirrors applyTransactionBalances (expense −, income +, transfer from −/to +
 * with the destination leg using to_amount). */
export function accountDelta(accountId: string, leg: BalanceLeg): number {
  const amount = Number(leg.amount)
  if (leg.type === 'expense') return leg.from_account_id === accountId ? -amount : 0
  if (leg.type === 'income') return leg.to_account_id === accountId ? amount : 0
  if (leg.type === 'transfer') {
    let delta = 0
    if (leg.from_account_id === accountId) delta -= amount
    if (leg.to_account_id === accountId) delta += leg.to_amount != null ? Number(leg.to_amount) : amount
    return delta
  }
  return 0
}

/** Walks backward from today's balance: balance(d) = today − Σ legs dated after d.
 * Emits one end-of-day row per date from max(since, cutoffDate) through today.
 * `cutoffDate` is the account's last reconciliation — earlier balances are
 * unknowable, so they are dropped rather than guessed. */
export function reconstructDailyBalances(input: {
  accountId: string
  currentBalance: number
  legs: BalanceLeg[]
  since: string
  today: string
  cutoffDate?: string | null
}): { date: string; balance: number }[] {
  const floor = input.cutoffDate && input.cutoffDate > input.since ? input.cutoffDate : input.since
  const deltas = input.legs
    .map((leg) => ({ date: leg.date, delta: accountDelta(input.accountId, leg) }))
    .filter((d) => d.delta !== 0 && d.date > floor)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))

  const rows: { date: string; balance: number }[] = []
  let balance = input.currentBalance
  let i = 0
  for (let date = input.today; date >= floor; date = previousDay(date)) {
    // Undo every leg dated strictly after this date before recording it.
    while (i < deltas.length && deltas[i].date > date) {
      balance -= deltas[i].delta
      i++
    }
    rows.push({ date, balance: round2(balance) })
  }
  return rows.reverse()
}

/** 'YYYY-MM-DD' minus one day, via UTC so DST can't skip or repeat a date. */
export function previousDay(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10)
}

interface AccountRow {
  id: string
  user_id: string
  type: string
  balance: number | string
  currency: string | null
}

/** Upserts today's row for every live account. Idempotent on
 * (account_id, snapshot_date) so cron retries and manual triggers are safe. */
export async function captureBalanceSnapshots(
  supabase: FinanceSupabase,
  snapshotDate: string
): Promise<{ accounts: number }> {
  const { data, error } = await supabase
    .from('accounts')
    .select('id, user_id, type, balance, currency')
    .is('deleted_at', null)
  if (error) throw new Error(`accounts fetch failed: ${error.message}`)
  const accounts = (data ?? []) as AccountRow[]
  if (accounts.length === 0) return { accounts: 0 }

  const rows = accounts.map((a) => ({
    user_id: a.user_id,
    account_id: a.id,
    snapshot_date: snapshotDate,
    account_type: a.type,
    balance: round2(Number(a.balance)),
    currency: a.currency ?? 'USD',
    balance_usd: round2(toUsd(Number(a.balance), a.currency)),
  }))
  const { error: upsertErr } = await supabase
    .from('account_balance_snapshots')
    .upsert(rows, { onConflict: 'account_id,snapshot_date' })
  if (upsertErr) throw new Error(`snapshot upsert failed: ${upsertErr.message}`)
  return { accounts: rows.length }
}

export async function fetchNetWorthHistory(
  supabase: FinanceSupabase,
  userId: string,
  range: { fromDate: string; toDate: string }
): Promise<NetWorthPoint[]> {
  const { data, error } = await supabase
    .from('account_balance_snapshots')
    .select('snapshot_date, account_type, balance_usd')
    .eq('user_id', userId)
    .gte('snapshot_date', range.fromDate)
    .lte('snapshot_date', range.toDate)
    .order('snapshot_date', { ascending: true })
  if (error) throw new Error(`snapshot fetch failed: ${error.message}`)
  return computeNetWorthFromSnapshots((data ?? []) as SnapshotRow[])
}
