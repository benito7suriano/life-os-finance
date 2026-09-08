// Daily cron (vercel.json): always snapshot account balances; on Mondays also
// send the weekly report, on the 1st the monthly one — evaluated in
// REPORT_TIMEZONE, not the UTC the cron fires in. One cron keeps us inside
// the Vercel Hobby limit.

import { NextRequest, NextResponse } from 'next/server'
import { createFinanceServiceClient } from '@/lib/supabase/server'
import { captureBalanceSnapshots } from '@/lib/finance/snapshots'
import { runReportForAllChannels, type ReportDelivery } from '@/lib/reports/deliver'
import { localDateParts, reportKindsDue, reportTimezone, type ReportKind } from '@/lib/reports/schedule'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

type Outcome<T> = T | { error: string }

function errorOf(err: unknown): { error: string } {
  return { error: err instanceof Error ? err.message : String(err) }
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createFinanceServiceClient()
  const now = new Date()
  const parts = localDateParts(now, reportTimezone())

  let snapshot: Outcome<{ accounts: number }>
  try {
    snapshot = await captureBalanceSnapshots(supabase, parts.dateStr)
  } catch (err) {
    console.error('[cron] snapshot failed', err)
    snapshot = errorOf(err)
  }

  // A report failure must never block the other report or the snapshot.
  const reports: Partial<Record<ReportKind, Outcome<ReportDelivery[]>>> = {}
  for (const kind of reportKindsDue(parts)) {
    try {
      reports[kind] = await runReportForAllChannels(supabase, kind, now)
    } catch (err) {
      console.error(`[cron] ${kind} report failed`, err)
      reports[kind] = errorOf(err)
    }
  }

  return NextResponse.json({ ok: true, date: parts.dateStr, snapshot, reports })
}
