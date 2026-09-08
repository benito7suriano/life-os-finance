// One-off backfill of finance.account_balance_snapshots from transaction
// history, so net-worth trends and year-over-year comparisons work before the
// daily cron has accumulated real snapshots.
//
// For each live account: balance(d) = balance(today) − Σ legs dated after d,
// walking backward one day at a time. Reconstruction is only exact back to the
// account's most recent "Balance Adjustment" reconciliation, so the walk stops
// there rather than guessing.
//
// Usage:
//   npx tsx scripts/finance/backfill-snapshots.ts --since 2025-08-01 --dry-run
//   npx tsx scripts/finance/backfill-snapshots.ts --since 2025-08-01
//   npx tsx scripts/finance/backfill-snapshots.ts --since 2025-08-01 --hosted   # ignore .env.local
//
// Idempotent: existing rows (including real cron snapshots) are never overwritten.

import { promises as fs } from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'
import { toUsd } from '../../lib/fx'
import { EXCLUDED_CATEGORY_NAMES, round2 } from '../../lib/finance/history'
import { reconstructDailyBalances, type BalanceLeg } from '../../lib/finance/snapshots'
import { localDateParts, reportTimezone } from '../../lib/reports/schedule'

async function loadEnvFile(envPath: string) {
  try {
    const text = await fs.readFile(envPath, 'utf8')
    for (const line of text.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq < 0) continue
      const key = trimmed.slice(0, eq).trim()
      let value = trimmed.slice(eq + 1).trim()
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
      if (!(key in process.env)) process.env[key] = value
    }
  } catch (e: unknown) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e
  }
}

interface AccountRow {
  id: string
  user_id: string
  name: string
  type: string
  balance: number | string
  currency: string | null
}

interface TxRow extends BalanceLeg {
  category_id: string | null
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : undefined
}

async function main() {
  const root = path.resolve(__dirname, '..', '..')
  const hosted = process.argv.includes('--hosted')
  // .env.local (local stack) takes precedence over .env (hosted project);
  // loadEnvFile never overwrites, so load the higher-priority file first.
  if (!hosted) await loadEnvFile(path.join(root, '.env.local'))
  await loadEnvFile(path.join(root, '.env'))

  const dryRun = process.argv.includes('--dry-run')
  const since = arg('--since')
  if (!since || !/^\d{4}-\d{2}-\d{2}$/.test(since)) {
    console.error('Usage: npx tsx scripts/finance/backfill-snapshots.ts --since YYYY-MM-DD [--dry-run] [--hosted]')
    process.exit(1)
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set')
    process.exit(1)
  }
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: 'finance' },
  })
  const today = localDateParts(new Date(), reportTimezone()).dateStr
  console.log(`Target: ${url}\nWindow: ${since} → ${today}${dryRun ? '  (dry run)' : ''}\n`)

  const { data: accountsData, error: accountsErr } = await supabase
    .from('accounts')
    .select('id, user_id, name, type, balance, currency')
    .is('deleted_at', null)
  if (accountsErr) throw new Error(`accounts fetch failed: ${accountsErr.message}`)
  const accounts = (accountsData ?? []) as AccountRow[]

  const { data: catData, error: catErr } = await supabase.from('categories').select('id, name')
  if (catErr) throw new Error(`categories fetch failed: ${catErr.message}`)
  const adjustmentIds = new Set(
    ((catData ?? []) as { id: string; name: string }[])
      .filter((c) => EXCLUDED_CATEGORY_NAMES.has(c.name.trim().toLowerCase()))
      .map((c) => c.id)
  )

  // Only legs dated after `since` can affect balances on or after `since`.
  const legs: TxRow[] = []
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('transactions')
      .select('date, type, amount, to_amount, from_account_id, to_account_id, category_id')
      .gt('date', since)
      .order('date', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw new Error(`transactions fetch failed: ${error.message}`)
    if (!data || data.length === 0) break
    legs.push(...(data as TxRow[]))
    if (data.length < PAGE) break
  }
  console.log(`${accounts.length} accounts, ${legs.length} transactions after ${since}\n`)

  const rows: {
    user_id: string
    account_id: string
    snapshot_date: string
    account_type: string
    balance: number
    currency: string
    balance_usd: number
  }[] = []

  for (const account of accounts) {
    const accountLegs = legs.filter((l) => l.from_account_id === account.id || l.to_account_id === account.id)
    const cutoff = accountLegs
      .filter((l) => l.category_id && adjustmentIds.has(l.category_id))
      .reduce<string | null>((max, l) => (max === null || l.date > max ? l.date : max), null)

    const daily = reconstructDailyBalances({
      accountId: account.id,
      currentBalance: Number(account.balance),
      legs: accountLegs,
      since,
      today,
      cutoffDate: cutoff,
    })
    const first = daily[0]
    const last = daily[daily.length - 1]
    console.log(
      `${account.name.padEnd(28)} ${account.type.padEnd(12)} ${daily.length.toString().padStart(4)} days` +
        `  ${first.date} ${String(first.balance).padStart(12)} → ${last.date} ${String(last.balance).padStart(12)}` +
        (cutoff && cutoff > since ? `  (truncated at reconciliation ${cutoff})` : '')
    )
    for (const d of daily) {
      rows.push({
        user_id: account.user_id,
        account_id: account.id,
        snapshot_date: d.date,
        account_type: account.type,
        balance: d.balance,
        currency: account.currency ?? 'USD',
        balance_usd: round2(toUsd(d.balance, account.currency)),
      })
    }
  }

  console.log(`\n${rows.length} snapshot rows to write`)
  if (dryRun) return

  const BATCH = 500
  let written = 0
  for (let i = 0; i < rows.length; i += BATCH) {
    const { error } = await supabase
      .from('account_balance_snapshots')
      .upsert(rows.slice(i, i + BATCH), { onConflict: 'account_id,snapshot_date', ignoreDuplicates: true })
    if (error) throw new Error(`upsert failed at row ${i}: ${error.message}`)
    written += Math.min(BATCH, rows.length - i)
    process.stdout.write(`\r  ${written}/${rows.length}`)
  }
  console.log('\nDone. Existing rows were left untouched.')
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
