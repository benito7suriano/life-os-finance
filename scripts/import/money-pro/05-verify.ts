/**
 * Phase 5: Verify the seeded data.
 *
 * Reports:
 *   1. Row counts: raw vs inserted, skip reasons.
 *   2. Per-account balance reconciliation: recomputed Σ(income) − Σ(expense)
 *      ± transfers vs. the balance we set from Money Pro's final running total.
 *      Cross-currency transfers use to_amount on the destination side.
 *   3. Per-account date range.
 *   4. Orphans: txns with neither from_account_id nor to_account_id.
 *   5. Category coverage: % of expense/income rows with non-null category_id.
 *
 * Run: npx tsx scripts/import/money-pro/05-verify.ts
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { buildClients, ensureUser, loadEnv } from './lib'

const USER_EMAIL = 'bjsuriano@gmail.com'
const DATA_DIR = path.resolve(__dirname, 'data')

async function main() {
  await loadEnv()
  const clients = buildClients()
  const userId = await ensureUser(clients, USER_EMAIL)
  console.log(`user_id: ${userId}\n`)
  const f = clients.finance

  // -- Row counts -----------------------------------------------------------
  const rawRows = JSON.parse(await fs.readFile(path.join(DATA_DIR, 'raw.json'), 'utf8'))
  const { count: txCount, error: txCountErr } = await f
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
  if (txCountErr) throw new Error(txCountErr.message)
  console.log('=== 1. Row counts ===')
  console.log(`  raw (deduped)        : ${rawRows.length}`)
  console.log(`  inserted             : ${txCount}`)
  console.log(`  delta (skipped/etc)  : ${(rawRows as unknown[]).length - (txCount || 0)}`)

  // -- Account balance reconciliation --------------------------------------
  console.log('\n=== 2. Balance reconciliation ===')
  const { data: accounts, error: accErr } = await f
    .from('accounts')
    .select('id, name, type, currency, balance')
    .eq('user_id', userId)
  if (accErr) throw new Error(accErr.message)

  // Pull all transactions in batches.
  const allTxns: Array<{
    type: 'expense' | 'income' | 'transfer'
    amount: number
    from_account_id: string | null
    to_account_id: string | null
    to_amount: number | null
    to_currency: string | null
  }> = []
  const pageSize = 1000
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await f
      .from('transactions')
      .select('type, amount, from_account_id, to_account_id, to_amount, to_currency')
      .eq('user_id', userId)
      .range(from, from + pageSize - 1)
    if (error) throw new Error(error.message)
    if (!data || data.length === 0) break
    allTxns.push(...(data as typeof allTxns))
    if (data.length < pageSize) break
  }
  console.log(`  fetched ${allTxns.length} txns for recomputation`)

  // Recompute per-account flow. For transfers with to_amount set, the
  // destination side uses to_amount; otherwise destination uses `amount`.
  const flow = new Map<string, number>()
  for (const t of allTxns) {
    const amt = Number(t.amount)
    if (t.type === 'expense' && t.from_account_id) {
      flow.set(t.from_account_id, (flow.get(t.from_account_id) ?? 0) - amt)
    } else if (t.type === 'income' && t.to_account_id) {
      flow.set(t.to_account_id, (flow.get(t.to_account_id) ?? 0) + amt)
    } else if (t.type === 'transfer') {
      if (t.from_account_id) {
        flow.set(t.from_account_id, (flow.get(t.from_account_id) ?? 0) - amt)
      }
      if (t.to_account_id) {
        const inAmt = t.to_amount != null ? Number(t.to_amount) : amt
        flow.set(t.to_account_id, (flow.get(t.to_account_id) ?? 0) + inAmt)
      }
    }
  }
  let mismatches = 0
  const lines: string[] = []
  for (const a of accounts || []) {
    const set = Number(a.balance)
    const computed = flow.get(a.id) ?? 0
    const delta = set - computed
    const marker = Math.abs(delta) > 0.01 ? '⚠' : ' '
    if (Math.abs(delta) > 0.01) mismatches++
    lines.push(
      `  ${marker} ${a.name.padEnd(28)} ${a.currency.padEnd(4)} set=${set.toFixed(2).padStart(14)} flow=${computed.toFixed(2).padStart(14)} delta=${delta.toFixed(2).padStart(12)}`,
    )
  }
  for (const l of lines.slice(0, 50)) console.log(l)
  console.log(`  ${mismatches} accounts have a balance ≠ flow (Δ>0.01).`)
  console.log(`  NOTE: deltas > 0 reflect the implicit "opening balance" carried in Money Pro's running totals.`)
  console.log(`        We skipped Opening Balance rows; the absolute final balance is preserved.`)

  // -- Date range per account ---------------------------------------------
  console.log('\n=== 3. Date range per account ===')
  for (const a of (accounts || []).slice(0, 100)) {
    const { data: minRow } = await f
      .from('transactions')
      .select('date')
      .or(`from_account_id.eq.${a.id},to_account_id.eq.${a.id}`)
      .eq('user_id', userId)
      .order('date', { ascending: true })
      .limit(1)
    const { data: maxRow } = await f
      .from('transactions')
      .select('date')
      .or(`from_account_id.eq.${a.id},to_account_id.eq.${a.id}`)
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(1)
    const min = minRow?.[0]?.date ?? '—'
    const max = maxRow?.[0]?.date ?? '—'
    console.log(`  ${a.name.padEnd(28)} ${min} → ${max}`)
  }

  // -- Orphans -------------------------------------------------------------
  const orphans = allTxns.filter((t) => !t.from_account_id && !t.to_account_id)
  console.log(`\n=== 4. Orphans ===`)
  console.log(`  ${orphans.length} txns with neither from_account_id nor to_account_id`)

  // -- Category coverage ---------------------------------------------------
  const expIncome = allTxns.filter((t) => t.type !== 'transfer')
  const { data: withoutCat } = await f
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .neq('type', 'transfer')
    .is('category_id', null)
  const { data: total, count: totalCount } = await f
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .neq('type', 'transfer')
  console.log(`\n=== 5. Category coverage ===`)
  const totalExp = totalCount || expIncome.length
  console.log(`  expense+income rows  : ${totalExp}`)
  // We don't get count from the .head:true select on withoutCat properly above; recompute via filter.
  const orphanCats = allTxns.filter((t) => t.type !== 'transfer' && !t.from_account_id) // unused
  // The MoneyPro flow doesn't store category on transactions table directly accessible here without re-query. Use the fetched batch.
  const fetched = await f
    .from('transactions')
    .select('category_id')
    .eq('user_id', userId)
    .neq('type', 'transfer')
    .range(0, 9999)
  const rows = fetched.data || []
  const noCat = rows.filter((r) => !r.category_id).length
  console.log(`  rows w/o category    : ${noCat}`)
  console.log(`  coverage             : ${(((rows.length - noCat) / Math.max(rows.length, 1)) * 100).toFixed(1)}%`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
