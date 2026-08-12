/**
 * Stage 04 — flag duplicates, both intra-run (overlapping statement files)
 * and against rows already in the DB.
 *
 * Intra-run: exact key (date|amount|currency|account|type|desc) — first
 * occurrence wins, later ones become intra_duplicate.
 * Against DB (rows dated >= 2026-05-01): exact match on
 * date|amount|currency|account|type → db_duplicate; otherwise a loose match
 * (amount+account within ±1 day) → needs_review, because descriptions differ
 * between hand-entered rows and statement text (e.g. DB "The Vita Place"
 * vs statement "UBER EATS-WB", both 455.33 on 2026-05-16).
 * Pre-cutoff rows (< 2026-05-17) that are NOT in the DB → needs_review: the
 * Money Pro history turned out to be complete for cards but not for the
 * Popular checking accounts.
 *
 *   npx tsx scripts/import/statements/04-dedup.ts
 */
import { CUTOFF_DATE, CanonicalTxn, buildFinanceClient, dayDiff, loadEnv, normDesc, readRunJson, writeRunJson } from './lib'

async function main() {
  await loadEnv()
  const supabase = buildFinanceClient()
  const data = await readRunJson<{ files: unknown[]; rows: CanonicalTxn[] }>('paired.json')
  // fetch DB rows from 2 days before the earliest statement row so every
  // statement row has a chance to match (card statements reach back into April)
  const minDate = data.rows.map((r) => r.date).sort()[0]
  const fetchFrom = new Date(Date.parse(minDate) - 2 * 86_400_000).toISOString().slice(0, 10)
  const { data: dbRows, error } = await supabase
    .from('transactions')
    .select('id, date, type, amount, currency, description, from_account_id, to_account_id, source_app')
    .gte('date', fetchFrom)
  if (error) throw new Error(`transactions fetch failed: ${error.message}`)

  const exact = new Map<string, { id: string; description: string }>()
  const loose: { date: string; amount: number; accountId: string; id: string; description: string; source_app: string }[] = []
  for (const r of dbRows!) {
    const amt = Number(r.amount)
    for (const acct of [r.from_account_id, r.to_account_id].filter(Boolean) as string[]) {
      exact.set([r.date, amt.toFixed(2), r.currency, acct, r.type].join('|'), { id: r.id, description: r.description })
      loose.push({ date: r.date, amount: amt, accountId: acct, id: r.id, description: r.description, source_app: r.source_app })
    }
  }

  const seen = new Map<string, string>() // intra key → sourceFile of first occurrence
  const counts: Record<string, number> = { new: 0, db_duplicate: 0, intra_duplicate: 0, needs_review: 0, merged: 0 }

  for (const row of data.rows) {
    if (row.mergedIntoPair) { counts.merged++; continue }

    // Same-key rows count as intra-run duplicates only across DIFFERENT files
    // (overlapping statement periods). Within one file they are legitimate
    // repeats — e.g. two identical same-day cash deposits.
    const intraKey = [row.date, row.amount.toFixed(2), row.currency, row.accountId, row.inferredType, normDesc(row.description).toLowerCase()].join('|')
    const firstFile = seen.get(intraKey)
    if (firstFile !== undefined && firstFile !== row.sourceFile) {
      row.dedupStatus = 'intra_duplicate'
      row.dedupNote = `same row appears in overlapping statement file ${firstFile}`
      counts.intra_duplicate++
      continue
    }
    seen.set(intraKey, row.sourceFile)

    const exactHit = exact.get([row.date, row.amount.toFixed(2), row.currency, row.accountId, row.inferredType].join('|'))
    if (exactHit) {
      row.dedupStatus = 'db_duplicate'
      row.dedupNote = `already in DB as "${exactHit.description || '(no description)'}"`
      counts.db_duplicate++
      continue
    }
    const looseHit = loose.find((l) => l.accountId === row.accountId && Math.abs(l.amount - row.amount) < 0.005 && dayDiff(l.date, row.date) <= 1)
    if (looseHit) {
      row.dedupStatus = 'needs_review'
      row.dedupNote = `likely already in DB: ${looseHit.date} "${looseHit.description}" (${looseHit.source_app})`
      counts.needs_review++
      continue
    }
    if (row.date < CUTOFF_DATE) {
      row.dedupStatus = 'needs_review'
      row.dedupNote = `pre-cutoff (${row.date} < ${CUTOFF_DATE}) but NOT found in DB — include?`
      counts.needs_review++
      continue
    }
    row.dedupStatus = 'new'
    counts.new++
  }

  console.log(counts)
  await writeRunJson('deduped.json', data)
}

main().catch((e) => { console.error(e); process.exit(1) })
