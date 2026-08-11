/**
 * Stage 06 — insert approved rows into finance.transactions and apply
 * balance deltas through the atomic update_account_balance RPC.
 *
 * Gated: requires --approve. Optional runs/<run>/overrides.json:
 *   {
 *     "include": ["<row id>"],            // promote needs_review → insert
 *     "exclude": ["<row id>"],            // drop a 'new' row
 *     "category": { "<row id>": "Name" }, // set/override category by name
 *     "description": { "<row id>": "…" }  // override clean description
 *   }
 *
 * Every inserted id + its balance legs are journaled to inserted.json;
 * `--rollback` deletes those rows and reverses the balance deltas.
 *
 *   npx tsx scripts/import/statements/06-insert.ts --approve
 *   npx tsx scripts/import/statements/06-insert.ts --rollback
 */
import { createClient } from '@supabase/supabase-js'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { applyTransactionBalances, legsFromRow } from '../../../lib/finance/apply-balances'
import { CanonicalTxn, RUN_DIR, SOURCE_APP, USER_EMAIL, buildFinanceClient, loadEnv, readRunJson, writeRunJson } from './lib'

interface Overrides {
  include?: string[]
  exclude?: string[]
  category?: Record<string, string>
  description?: Record<string, string>
}

async function main() {
  const approve = process.argv.includes('--approve')
  const rollback = process.argv.includes('--rollback')
  await loadEnv()
  const supabase = buildFinanceClient()

  if (rollback) {
    const journal = await readRunJson<{ inserted: { id: string }[] }>('inserted.json')
    console.log(`rolling back ${journal.inserted.length} rows`)
    for (const entry of journal.inserted) {
      const { data: row, error } = await supabase.from('transactions').select('*').eq('id', entry.id).maybeSingle()
      if (error) throw new Error(error.message)
      if (!row) continue
      await applyTransactionBalances(supabase, legsFromRow(row), -1)
      const { error: delErr } = await supabase.from('transactions').delete().eq('id', entry.id)
      if (delErr) throw new Error(delErr.message)
    }
    console.log('rollback complete')
    return
  }

  if (!approve) throw new Error('Refusing to insert without --approve (present review.md to the user first)')

  // user id from public.users (finance client is schema-scoped, so build a public one)
  const pub = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  const { data: users, error: userErr } = await pub.from('users').select('id').eq('email', USER_EMAIL)
  if (userErr || !users?.length) throw new Error(`user lookup failed: ${userErr?.message ?? 'not found'}`)
  const userId = users[0].id

  let overrides: Overrides = {}
  try { overrides = JSON.parse(await fs.readFile(path.join(RUN_DIR, 'overrides.json'), 'utf8')) } catch { /* optional */ }

  const { data: cats, error: catErr } = await supabase.from('categories').select('id, name, type')
  if (catErr) throw new Error(catErr.message)

  const data = await readRunJson<{ files: unknown[]; rows: CanonicalTxn[] }>('deduped.json')
  const include = new Set(overrides.include ?? [])
  const exclude = new Set(overrides.exclude ?? [])
  const toInsert = data.rows.filter((r) =>
    !r.mergedIntoPair &&
    !exclude.has(r.id) &&
    (r.dedupStatus === 'new' || (r.dedupStatus === 'needs_review' && include.has(r.id))))

  const missingReview = data.rows.filter((r) => !r.mergedIntoPair && r.dedupStatus === 'needs_review' && !include.has(r.id) && !exclude.has(r.id))
  if (missingReview.length) {
    console.warn(`[warn] ${missingReview.length} needs_review rows neither included nor excluded — they will be SKIPPED`)
  }

  const payload = toInsert.map((r) => {
    let categoryId = r.categoryId ?? null
    const catName = overrides.category?.[r.id]
    if (catName) {
      const cat = cats!.find((c) => c.name.toLowerCase() === catName.toLowerCase() && c.type === (r.direction === 'in' ? 'income' : 'expense'))
      if (!cat) throw new Error(`override category "${catName}" not found for ${r.id}`)
      categoryId = cat.id
    }
    const isTransfer = r.inferredType === 'transfer'
    return {
      user_id: userId,
      type: r.inferredType!,
      date: r.date,
      description: overrides.description?.[r.id] ?? r.cleanDescription ?? r.description,
      amount: r.amount,
      currency: r.currency,
      category_id: isTransfer ? null : categoryId,
      from_account_id: isTransfer ? (r.direction === 'out' ? r.accountId : r.transferCounterAccountId) : (r.direction === 'out' ? r.accountId : null),
      to_account_id: isTransfer ? (r.direction === 'out' ? r.transferCounterAccountId : r.accountId) : (r.direction === 'in' ? r.accountId : null),
      to_amount: isTransfer ? r.toAmount ?? null : null,
      to_currency: isTransfer ? r.toCurrency ?? null : null,
      source: 'import',
      source_app: SOURCE_APP,
    }
  })

  console.log(`inserting ${payload.length} transactions…`)
  const inserted: { id: string }[] = []
  for (let i = 0; i < payload.length; i += 100) {
    const batch = payload.slice(i, i + 100)
    const { data: rows, error } = await supabase.from('transactions').insert(batch).select('*')
    if (error) throw new Error(`insert batch failed at ${i}: ${error.message}`)
    for (const row of rows!) {
      await applyTransactionBalances(supabase, legsFromRow(row), 1)
      inserted.push({ id: row.id })
    }
    console.log(`  ${Math.min(i + 100, payload.length)}/${payload.length}`)
  }

  await writeRunJson('inserted.json', { insertedAt: new Date().toISOString(), inserted })
  console.log(`done: ${inserted.length} rows inserted with balances applied`)
}

main().catch((e) => { console.error(e); process.exit(1) })
