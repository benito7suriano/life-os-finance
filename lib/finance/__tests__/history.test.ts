import { describe, it, expect } from 'vitest'
import {
  bucketByMonth,
  toMonthlyTrend,
  computeCategoryAverages,
  periodOf,
  monthLabel,
  type TxRow,
} from '../history'

const NONE = new Set<string>()

describe('periodOf / monthLabel', () => {
  it('keys by the raw date string — no timezone drift on the 1st', () => {
    // new Date('2026-08-01') is UTC midnight, which is July 31 in UTC-4;
    // string slicing keeps it in August.
    expect(periodOf('2026-08-01')).toBe('2026-08')
    expect(monthLabel('2026-08')).toBe('Aug 2026')
  })
})

describe('bucketByMonth', () => {
  const rows: TxRow[] = [
    { date: '2026-07-01', amount: 100, currency: 'USD', category_id: 'c1', type: 'expense' },
    { date: '2026-07-15', amount: '5900', currency: 'DOP', category_id: 'c1', type: 'expense' }, // = $100
    { date: '2026-07-20', amount: 500, currency: 'USD', category_id: null, type: 'income' },
    { date: '2026-08-02', amount: 40, currency: 'USD', category_id: 'excluded', type: 'expense' },
    { date: '2026-08-03', amount: 60, currency: 'USD', category_id: 'c2', type: 'expense' },
  ]

  it('sums USD-converted amounts per month and type', () => {
    const buckets = bucketByMonth(rows, NONE)
    expect(buckets.get('2026-07')).toEqual({ income: 500, expenses: 200 })
    expect(buckets.get('2026-08')).toEqual({ income: 0, expenses: 100 })
  })

  it('skips excluded bookkeeping categories', () => {
    const buckets = bucketByMonth(rows, new Set(['excluded']))
    expect(buckets.get('2026-08')).toEqual({ income: 0, expenses: 60 })
  })
})

describe('toMonthlyTrend', () => {
  it('zero-fills months with no data, oldest first', () => {
    const buckets = new Map([['2026-08', { income: 10, expenses: 20 }]])
    const trend = toMonthlyTrend(buckets, 3, new Date(2026, 7, 5)) // Aug 5 2026
    expect(trend.map((t) => t.period)).toEqual(['2026-06', '2026-07', '2026-08'])
    expect(trend[0]).toEqual({ period: '2026-06', label: 'Jun 2026', income: 0, expenses: 0 })
    expect(trend[2]).toEqual({ period: '2026-08', label: 'Aug 2026', income: 10, expenses: 20 })
  })

  it('crosses year boundaries', () => {
    const trend = toMonthlyTrend(new Map(), 3, new Date(2026, 0, 15)) // Jan 2026
    expect(trend.map((t) => t.period)).toEqual(['2025-11', '2025-12', '2026-01'])
  })
})

describe('computeCategoryAverages', () => {
  const rows: TxRow[] = [
    // Two months of data: child c1a under parent c1
    { date: '2026-06-10', amount: 100, currency: 'USD', category_id: 'c1a', type: 'expense' },
    { date: '2026-07-10', amount: 300, currency: 'USD', category_id: 'c1a', type: 'expense' },
    { date: '2026-07-11', amount: 50, currency: 'USD', category_id: 'c1', type: 'expense' },
    // Before the window — ignored
    { date: '2025-01-01', amount: 999, currency: 'USD', category_id: 'c1a', type: 'expense' },
    // Income never counts toward spend averages
    { date: '2026-07-12', amount: 400, currency: 'USD', category_id: null, type: 'income' },
  ]

  it('averages over months with data and rolls children into parents', () => {
    const averages = computeCategoryAverages(rows, NONE, { c1a: 'c1' }, '2026-06-01')
    // c1a: (100 + 300) / 2 months = 200; c1: (100 + 300 + 50) / 2 = 225
    expect(averages.c1a).toBe(200)
    expect(averages.c1).toBe(225)
  })

  it('skips excluded categories entirely', () => {
    const averages = computeCategoryAverages(rows, new Set(['c1a']), { c1a: 'c1' }, '2026-06-01')
    expect(averages.c1a).toBeUndefined()
    expect(averages.c1).toBe(50) // only the direct parent spend remains
  })
})
