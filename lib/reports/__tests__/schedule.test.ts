import { describe, it, expect } from 'vitest'
import { localDateParts, reportKindsDue } from '../schedule'

describe('localDateParts', () => {
  it('resolves the calendar date in the given timezone, not UTC', () => {
    // 02:30 UTC on Monday Sep 7 is still Sunday Sep 6 evening in Santo Domingo (UTC-4).
    const at = new Date('2026-09-07T02:30:00Z')
    expect(localDateParts(at, 'America/Santo_Domingo')).toEqual({
      dateStr: '2026-09-06',
      year: 2026,
      month: 9,
      day: 6,
      weekday: 'Sun',
    })
    expect(localDateParts(at, 'UTC')).toMatchObject({ dateStr: '2026-09-07', weekday: 'Mon' })
  })

  it('handles the 1st-of-month boundary across timezones', () => {
    const at = new Date('2026-10-01T03:00:00Z')
    expect(localDateParts(at, 'America/Santo_Domingo').day).toBe(30)
    expect(localDateParts(at, 'Asia/Tokyo').day).toBe(1)
  })
})

describe('reportKindsDue', () => {
  it('is weekly on Mondays, monthly on the 1st, both when they coincide', () => {
    expect(reportKindsDue({ weekday: 'Mon', day: 14 })).toEqual(['weekly'])
    expect(reportKindsDue({ weekday: 'Thu', day: 1 })).toEqual(['monthly'])
    expect(reportKindsDue({ weekday: 'Mon', day: 1 })).toEqual(['weekly', 'monthly'])
    expect(reportKindsDue({ weekday: 'Tue', day: 9 })).toEqual([])
  })
})
