/**
 * Stage 02 — resolve accounts + categories onto normalized rows.
 *
 * Accounts come from mappings/accounts.json (statement key → UUID). Categories
 * come from mappings/merchants.json (ordered regex rules → category NAME),
 * resolved against live finance.categories. Rows with no matching rule keep
 * categoryId null and get the `[Uncategorized: …]` description marker (same
 * convention as the money-pro import) — they never block the pipeline.
 *
 *   npx tsx scripts/import/statements/02-map.ts
 */
import { CanonicalTxn, buildFinanceClient, loadEnv, normDesc, readMapping, readRunJson, writeRunJson } from './lib'

interface MerchantRule { pattern: string; category: string; clean?: string; type?: 'income' | 'expense' }
interface AccountEntry { accountId: string; name: string }

async function main() {
  await loadEnv()
  const supabase = buildFinanceClient()
  const accounts = await readMapping<Record<string, AccountEntry>>('accounts.json')
  const rules = (await readMapping<MerchantRule[]>('merchants.json')).map((r) => ({
    ...r,
    re: new RegExp(r.pattern, 'i'),
    type: r.type ?? 'expense' as const,
  }))

  const { data: cats, error } = await supabase.from('categories').select('id, name, type')
  if (error) throw new Error(`categories fetch failed: ${error.message}`)
  const catIndex = new Map<string, { id: string; name: string }>()
  for (const c of cats!) catIndex.set(`${c.type}:${c.name.toLowerCase()}`, { id: c.id, name: c.name })

  const normalized = await readRunJson<{ files: unknown[]; rows: CanonicalTxn[] }>('normalized.json')
  let unmappedAccounts = 0
  let uncategorized = 0

  for (const row of normalized.rows) {
    const acct = accounts[row.statementAccount]
    if (!acct) { unmappedAccounts++; (row.notes ??= []).push(`no account mapping for ${row.statementAccount}`); continue }
    row.accountId = acct.accountId
    row.accountName = acct.name
    row.inferredType = row.direction === 'out' ? 'expense' : 'income'

    const rule = rules.find((r) => r.type === row.inferredType && r.re.test(row.description))
    if (rule) {
      const cat = catIndex.get(`${rule.type}:${rule.category.toLowerCase()}`)
      if (!cat) throw new Error(`merchants.json references unknown ${rule.type} category "${rule.category}"`)
      row.categoryId = cat.id
      row.categoryName = cat.name
      row.cleanDescription = rule.clean ?? row.description
    } else {
      row.categoryId = null
      row.categoryName = null
      row.cleanDescription = `[Uncategorized: ${normDesc(row.description)}]`
      uncategorized++
    }
  }

  console.log(`${normalized.rows.length} rows mapped; ${uncategorized} uncategorized; ${unmappedAccounts} on unmapped accounts`)
  await writeRunJson('mapped.json', normalized)
}

main().catch((e) => { console.error(e); process.exit(1) })
