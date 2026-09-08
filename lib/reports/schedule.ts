// Calendar logic for the daily cron, evaluated in the user's timezone
// (REPORT_TIMEZONE) rather than the UTC the cron fires in.

export type Weekday = 'Sun' | 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat'

export interface LocalDateParts {
  dateStr: string
  year: number
  month: number
  day: number
  weekday: Weekday
}

export const DEFAULT_TIMEZONE = 'America/Santo_Domingo'

export function reportTimezone(): string {
  return process.env.REPORT_TIMEZONE || DEFAULT_TIMEZONE
}

export function localDateParts(date: Date, timeZone: string): LocalDateParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  }).formatToParts(date)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  const year = Number(get('year'))
  const month = Number(get('month'))
  const day = Number(get('day'))
  return {
    dateStr: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    year,
    month,
    day,
    weekday: get('weekday') as Weekday,
  }
}

export type ReportKind = 'weekly' | 'monthly'

/** Weekly on Mondays, monthly on the 1st; both when a month starts on Monday. */
export function reportKindsDue(parts: { weekday: Weekday; day: number }): ReportKind[] {
  const kinds: ReportKind[] = []
  if (parts.weekday === 'Mon') kinds.push('weekly')
  if (parts.day === 1) kinds.push('monthly')
  return kinds
}
