/**
 * Stage 07 — post-import reconciliation.
 *
 * Compares each statement's closing balance against the stored account
 * balance, and reports transaction counts by source_app for the window.
 * Residual differences are REPORTED, not fixed — they signal cash activity,
 * missing statement cycles, or pre-existing drift.
 *
 *   npx tsx scripts/import/statements/07-verify.ts
 */
import { CanonicalTxn, ParsedFile, buildFinanceClient, loadEnv, readMapping, readRunJson } from './lib'

type FileMeta = Omit<ParsedFile, 'rows'>
const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

async function main() {
  await loadEnv()
  const supabase = buildFinanceClient()
  const accounts = await readMapping<Record<string, { accountId: string; name: string }>>('accounts.json')
  const data = await readRunJson<{ files: FileMeta[]; rows: CanonicalTxn[] }>('deduped.json')

  const { data: dbAccounts, error } = await supabase.from('accounts').select('id, name, balance, currency, type')
  if (error) throw new Error(error.message)
  const byId = new Map(dbAccounts!.map((a) => [a.id, a]))

  console.log('\n=== Stored balance vs statement closing balance ===')
  // keep only the freshest closing balance per statement account
  const freshest = new Map<string, { amount: number; asOf: string; file: string }>()
  for (const f of data.files) {
    if (!f.closingBalance || f.closingBalance.asOf === 'export') continue
    const cur = freshest.get(f.statementAccount)
    if (!cur || f.closingBalance.asOf > cur.asOf) {
      freshest.set(f.statementAccount, { ...f.closingBalance, file: f.sourceFile })
    }
  }
  for (const [key, cb] of freshest) {
    const acct = byId.get(accounts[key]?.accountId)
    if (!acct) { console.log(`  ${key}: no DB account mapped`); continue }
    // credit_card statements express debt as positive; DB stores debt negative
    const stored = Number(acct.balance)
    const statement = acct.type === 'credit_card' ? -cb.amount : cb.amount
    const diff = stored - statement
    const flag = Math.abs(diff) < 0.01 ? 'MATCH' : `DIFF ${fmt(diff)}`
    console.log(`  ${acct.name}: stored ${fmt(stored)} vs statement ${fmt(statement)} (${cb.asOf}) → ${flag}`)
  }

  console.log('\n=== Window transaction counts by source_app (>= 2026-05-01) ===')
  const { data: counts, error: cntErr } = await supabase
    .from('transactions')
    .select('source_app, date')
    .gte('date', '2026-05-01')
  if (cntErr) throw new Error(cntErr.message)
  const tally = new Map<string, number>()
  let latest = ''
  for (const r of counts!) {
    tally.set(r.source_app, (tally.get(r.source_app) ?? 0) + 1)
    if (r.date > latest) latest = r.date
  }
  for (const [app, n] of tally) console.log(`  ${app}: ${n}`)
  console.log(`  latest transaction date: ${latest}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
