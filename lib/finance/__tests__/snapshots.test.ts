import { describe, it, expect } from 'vitest'
import { mockSupabase, opsFor, filterArg } from '@/lib/test-utils/mock-supabase'
import {
  captureBalanceSnapshots,
  computeNetWorthFromSnapshots,
  fetchNetWorthHistory,
  reconstructDailyBalances,
} from '../snapshots'

describe('captureBalanceSnapshots', () => {
  it('upserts one USD-converted row per live account, keyed on account+date', async () => {
    const { supabase, ops } = mockSupabase((op) => {
      if (op.table === 'accounts') {
        return {
          data: [
            { id: 'a1', user_id: 'u1', type: 'checking', balance: '1000', currency: 'USD' },
            { id: 'a2', user_id: 'u1', type: 'credit_card', balance: -5900, currency: 'DOP' },
          ],
        }
      }
      return { data: null }
    })
    const result = await captureBalanceSnapshots(supabase, '2026-09-07')
    expect(result).toEqual({ accounts: 2 })

    const [upsert] = opsFor(ops, 'account_balance_snapshots', 'upsert')
    expect(upsert.values).toEqual([
      { user_id: 'u1', account_id: 'a1', snapshot_date: '2026-09-07', account_type: 'checking', balance: 1000, currency: 'USD', balance_usd: 1000 },
      { user_id: 'u1', account_id: 'a2', snapshot_date: '2026-09-07', account_type: 'credit_card', balance: -5900, currency: 'DOP', balance_usd: -100 },
    ])
    expect(upsert.filters.upsert?.[0]?.[0]).toEqual({ onConflict: 'account_id,snapshot_date' })
    expect(filterArg(opsFor(ops, 'accounts')[0], 'is', 'deleted_at')).toBeNull()
  })

  it('throws when the account fetch fails', async () => {
    const { supabase } = mockSupabase(() => ({ error: { message: 'boom' } }))
    await expect(captureBalanceSnapshots(supabase, '2026-09-07')).rejects.toThrow('boom')
  })
})

describe('fetchNetWorthHistory', () => {
  it('scopes to the user and date range and returns net-worth points', async () => {
    const { supabase, ops } = mockSupabase((op) => {
      if (op.table === 'account_balance_snapshots') {
        return {
          data: [
            { snapshot_date: '2026-09-01', account_type: 'checking', balance_usd: 500 },
            { snapshot_date: '2026-09-01', account_type: 'loan', balance_usd: -100 },
          ],
        }
      }
      return { data: null }
    })
    const points = await fetchNetWorthHistory(supabase, 'u1', { fromDate: '2026-08-01', toDate: '2026-09-07' })
    expect(points).toEqual([{ date: '2026-09-01', assets: 500, liabilities: 100, netWorth: 400 }])
    const op = opsFor(ops, 'account_balance_snapshots')[0]
    expect(filterArg(op, 'eq', 'user_id')).toBe('u1')
    expect(filterArg(op, 'gte', 'snapshot_date')).toBe('2026-08-01')
    expect(filterArg(op, 'lte', 'snapshot_date')).toBe('2026-09-07')
  })
})

describe('computeNetWorthFromSnapshots', () => {
  it('sums assets and signed liabilities per date, sorted ascending', () => {
    const points = computeNetWorthFromSnapshots([
      { snapshot_date: '2026-09-02', account_type: 'checking', balance_usd: 1000 },
      { snapshot_date: '2026-09-02', account_type: 'credit_card', balance_usd: -250 },
      { snapshot_date: '2026-09-01', account_type: 'checking', balance_usd: '900' },
      { snapshot_date: '2026-09-01', account_type: 'investment', balance_usd: 500 },
      { snapshot_date: '2026-09-01', account_type: 'loan', balance_usd: -2000 },
    ])
    expect(points).toEqual([
      { date: '2026-09-01', assets: 1400, liabilities: 2000, netWorth: -600 },
      { date: '2026-09-02', assets: 1000, liabilities: 250, netWorth: 750 },
    ])
  })

  it('treats a positive card balance as a genuine credit that adds to net worth', () => {
    const [p] = computeNetWorthFromSnapshots([
      { snapshot_date: '2026-09-01', account_type: 'credit_card', balance_usd: 40 },
    ])
    expect(p).toEqual({ date: '2026-09-01', assets: 0, liabilities: -40, netWorth: 40 })
  })
})

describe('reconstructDailyBalances', () => {
  const ACCOUNT = 'acc-1'
  const legs = [
    { date: '2026-09-07', type: 'expense', amount: 10, from_account_id: ACCOUNT, to_account_id: null, to_amount: null },
    { date: '2026-09-05', type: 'income', amount: 50, from_account_id: null, to_account_id: ACCOUNT, to_amount: null },
    { date: '2026-09-03', type: 'transfer', amount: 20, from_account_id: ACCOUNT, to_account_id: 'other', to_amount: null },
    // Cross-currency inbound transfer: the destination leg is `to_amount`.
    { date: '2026-09-02', type: 'transfer', amount: 1770, from_account_id: 'dop-acct', to_account_id: ACCOUNT, to_amount: 30 },
    // Unrelated to this account — must be ignored.
    { date: '2026-09-04', type: 'expense', amount: 999, from_account_id: 'other', to_account_id: null, to_amount: null },
  ]

  it('walks backward from today\'s balance, one end-of-day row per date', () => {
    const rows = reconstructDailyBalances({
      accountId: ACCOUNT,
      currentBalance: 100,
      legs,
      since: '2026-09-01',
      today: '2026-09-07',
    })
    expect(rows).toEqual([
      { date: '2026-09-01', balance: 50 },
      { date: '2026-09-02', balance: 80 },
      { date: '2026-09-03', balance: 60 },
      { date: '2026-09-04', balance: 60 },
      { date: '2026-09-05', balance: 110 },
      { date: '2026-09-06', balance: 110 },
      { date: '2026-09-07', balance: 100 },
    ])
  })

  it('stops at the reconciliation cutoff instead of guessing earlier balances', () => {
    const rows = reconstructDailyBalances({
      accountId: ACCOUNT,
      currentBalance: 100,
      legs,
      since: '2026-09-01',
      today: '2026-09-07',
      cutoffDate: '2026-09-03',
    })
    expect(rows.map((r) => r.date)).toEqual([
      '2026-09-03',
      '2026-09-04',
      '2026-09-05',
      '2026-09-06',
      '2026-09-07',
    ])
    expect(rows[0].balance).toBe(60)
  })
})
