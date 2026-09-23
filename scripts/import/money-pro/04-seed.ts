/**
 * Phase 4: Seed accounts, categories, and transactions from Money Pro data.
 *
 * Reads mappings + raw.json produced by Phases 0 and 2, inserts into local
 * Supabase via service-role client (bypasses RLS and the balance-mutating POST
 * handler). Sets each account's final balance to the most recent running
 * balance observed in the CSV.
 *
 * Run: npx tsx scripts/import/money-pro/04-seed.ts
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { buildClients, ensureUser, FinanceClients, loadEnv } from './lib'

const USER_EMAIL = 'bjsuriano@gmail.com'
const DATA_DIR = path.resolve(__dirname, 'data')
const MAPPINGS_DIR = path.resolve(__dirname, 'mappings')
const BATCH_SIZE = 500

type Currency = 'USD' | 'DOP'
type AccountType = 'checking' | 'savings' | 'credit_card' | 'loan' | 'wallet' | 'investment'
type AssetClass = 'private_investment' | 'retirement' | 'real_estate' | 'vehicle'

interface NormalizedRow {
  sourceFile: number
  sourceLine: number
  dateIso: string
  date: string
  amount: number
  currency: Currency
  account: string
  amountReceived: number | null
  amountReceivedCurrency: Currency | null
  accountTo: string | null
  balance: number | null
  balanceCurrency: Currency | null
  category: string | null
  categoryParent: string | null
  categoryChild: string | null
  description: string | null
  transactionType: string
}

interface AccountMapping {
  sourceNames: string[]
  targetName: string
  type: AccountType
  assetClass?: AssetClass
  currency: Currency
  notes?: string
}

interface CategoryMapping {
  sourceName: string
  parent: string
  child: string | null
  type: 'income' | 'expense'
  systemParent: string | null
}

// =============================================================================
// Helpers
// =============================================================================

function buildSourceToTarget(accountMappings: AccountMapping[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const m of accountMappings) {
    for (const src of m.sourceNames) map.set(src, m.targetName)
  }
  return map
}

function chainFor(m: CategoryMapping): string[] {
  const chain: string[] = []
  if (m.systemParent) chain.push(m.systemParent)
  if (m.parent && m.parent !== m.systemParent) chain.push(m.parent)
  if (m.child && m.child !== m.parent) chain.push(m.child)
  return chain
}

// =============================================================================
// Stage 1: Accounts
// =============================================================================

async function seedAccounts(
  clients: FinanceClients,
  userId: string,
  mappings: AccountMapping[],
): Promise<Map<string, string>> {
  console.log(`\n[stage 1] seeding ${mappings.length} accounts…`)
  const targetToId = new Map<string, string>()
  for (const m of mappings) {
    const insert: Record<string, unknown> = {
      user_id: userId,
      type: m.type,
      name: m.targetName,
      balance: 0, // updated in stage 4
      currency: m.currency,
    }
    if (m.assetClass) insert.asset_class = m.assetClass
    if (m.type === 'checking' || m.type === 'savings') {
      insert.beneficiary_name = m.targetName
    }
    if (m.type === 'wallet') {
      insert.icon = 'wallet'
    }
    const { data, error } = await clients.finance.from('accounts').insert(insert).select('id').single()
    if (error) {
      throw new Error(`account "${m.targetName}": ${error.message}`)
    }
    targetToId.set(m.targetName, data.id)
  }
  return targetToId
}

// =============================================================================
// Stage 2: Categories
// =============================================================================

async function seedCategories(
  clients: FinanceClients,
  userId: string,
  mappings: CategoryMapping[],
): Promise<Map<string, string>> {
  console.log(`\n[stage 2] seeding category hierarchy…`)
  const f = clients.finance

  // Load existing system categories (case-insensitive lookup).
  const { data: sysCats, error: sysErr } = await f
    .from('categories')
    .select('id, name, type, parent_id, is_system')
    .eq('is_system', true)
  if (sysErr) throw new Error(`load system cats: ${sysErr.message}`)
  const lookup = new Map<string, string>()
  for (const c of sysCats || []) {
    lookup.set(`${c.name.toLowerCase()}|${c.parent_id || ''}`, c.id)
  }

  // Build a tree of unique chains.
  const chainSet = new Set<string>()
  const chains: Array<{ names: string[]; type: 'income' | 'expense' }> = []
  for (const m of mappings) {
    const chain = chainFor(m)
    if (chain.length === 0) continue
    const key = chain.join('||') + '||' + m.type
    if (chainSet.has(key)) continue
    chainSet.add(key)
    chains.push({ names: chain, type: m.type })
  }

  /** Find or create a category by (name, parent_id, type). In-memory cache. */
  async function findOrCreate(
    name: string,
    parentId: string | null,
    type: 'income' | 'expense',
  ): Promise<string> {
    const key = `${name.toLowerCase()}|${parentId || ''}`
    const cached = lookup.get(key)
    if (cached) return cached

    const { data, error } = await f
      .from('categories')
      .insert({
        user_id: userId,
        name,
        parent_id: parentId,
        type,
        color: type === 'income' ? '#10b981' : '#64748b',
        icon: 'circle',
        is_system: false,
      })
      .select('id')
      .single()
    if (error) throw new Error(`create category "${name}" parent=${parentId}: ${error.message}`)
    lookup.set(key, data.id)
    return data.id
  }

  // Walk each chain top→bottom and remember the leaf id by full chain key.
  const leafByChain = new Map<string, string>()
  for (const { names, type } of chains) {
    let parentId: string | null = null
    for (let i = 0; i < names.length; i++) {
      const name = names[i]
      const id = await findOrCreate(name, parentId, type)
      parentId = id
    }
    leafByChain.set(names.join('||'), parentId!)
  }

  // Map every source category name → leaf id.
  const sourceToLeaf = new Map<string, string>()
  for (const m of mappings) {
    const chain = chainFor(m)
    if (chain.length === 0) continue
    const leaf = leafByChain.get(chain.join('||'))
    if (!leaf) throw new Error(`no leaf for ${m.sourceName} (chain=${chain.join('>')})`)
    sourceToLeaf.set(m.sourceName, leaf)
  }
  console.log(`  created ${lookup.size - (sysCats?.length || 0)} new categories (${sysCats?.length || 0} system reused)`)
  return sourceToLeaf
}

// =============================================================================
// Stage 3: Transactions
// =============================================================================

interface TxnInsert {
  user_id: string
  type: 'expense' | 'income' | 'transfer'
  date: string
  description: string
  amount: number
  from_account_id?: string | null
  to_account_id?: string | null
  category_id?: string | null
  source: 'import'
  source_app: 'money-pro'
  to_amount?: number | null
  to_currency?: string | null
}

interface MapResult {
  row?: TxnInsert
  skip?: string
}

function mapRow(
  r: NormalizedRow,
  userId: string,
  accountId: (sourceName: string | null) => string | null,
  catId: (sourceName: string) => string | null,
  syntheticCatId: (key: string) => string | null,
): MapResult {
  const description = r.description || ''
  const baseDesc = (override?: string) => (override ? override : description)
  const from = accountId(r.account)
  const to = accountId(r.accountTo)
  const cat = r.category ? catId(r.category) : null
  // If the category didn't resolve, prefix description so it's findable.
  const desc = cat || !r.category
    ? description
    : `[Uncategorized: ${r.category}] ${description}`.trim()

  const base: Omit<TxnInsert, 'type'> & { type?: 'expense' | 'income' | 'transfer' } = {
    user_id: userId,
    date: r.date,
    description: desc,
    amount: r.amount,
    source: 'import',
    source_app: 'money-pro',
  }

  switch (r.transactionType) {
    case 'Expense':
      if (!from) return { skip: `expense w/o known account "${r.account}"` }
      return { row: { ...base, type: 'expense', from_account_id: from, category_id: cat } }

    case 'Income':
      if (!from) return { skip: `income w/o known account "${r.account}"` }
      return { row: { ...base, type: 'income', to_account_id: from, category_id: cat } }

    case 'Money Transfer': {
      if (!from || !to) return { skip: `transfer with unknown account ${r.account} / ${r.accountTo}` }
      const crossCurrency =
        r.amountReceivedCurrency && r.amountReceivedCurrency !== r.currency
      return {
        row: {
          ...base,
          type: 'transfer',
          from_account_id: from,
          to_account_id: to,
          to_amount: crossCurrency ? r.amountReceived : null,
          to_currency: crossCurrency ? r.amountReceivedCurrency : null,
        },
      }
    }

    case 'Balance Adjustment': {
      if (!from) return { skip: `balance adj w/o known account "${r.account}"` }
      // Direction inferred from whether the absolute amount represents a
      // pos/neg adjustment. In Money Pro the Amount column is always positive
      // here. The CSV's Balance column reflects the post-adjustment running
      // total — we can't easily infer direction from one row in isolation.
      // Default to expense; the user can fix in-app if needed.
      const syntheticKey = '__balance_adjustment_expense__'
      return {
        row: {
          ...base,
          type: 'expense',
          from_account_id: from,
          category_id: syntheticCatId(syntheticKey),
        },
      }
    }

    case 'Opening Balance':
      return { skip: 'opening balance (handled via final-balance pass)' }

    case 'Asset Purchase': {
      if (to && from) {
        // Real transfer from cash → asset account
        return {
          row: {
            ...base,
            type: 'transfer',
            from_account_id: from,
            to_account_id: to,
          },
        }
      }
      if (!from) return { skip: `asset purchase w/o known account "${r.account}"` }
      return {
        row: {
          ...base,
          type: 'expense',
          from_account_id: from,
          category_id: syntheticCatId('__asset_purchase__'),
          description: baseDesc(description || 'Asset Purchase'),
        },
      }
    }

    case 'Asset Sale': {
      if (to && from) {
        return {
          row: {
            ...base,
            type: 'transfer',
            from_account_id: from,
            to_account_id: to,
          },
        }
      }
      if (!from) return { skip: `asset sale w/o known account "${r.account}"` }
      return {
        row: {
          ...base,
          type: 'income',
          to_account_id: from,
          category_id: syntheticCatId('__asset_sale__'),
          description: baseDesc(description || 'Asset Sale'),
        },
      }
    }

    default:
      return { skip: `unknown transaction type "${r.transactionType}"` }
  }
}

async function seedTransactions(
  clients: FinanceClients,
  userId: string,
  rows: NormalizedRow[],
  accountIdByTarget: Map<string, string>,
  sourceCategoryToId: Map<string, string>,
  accountMappings: AccountMapping[],
): Promise<{ inserted: number; skipped: Record<string, number>; finalBalanceByAccountId: Map<string, number> }> {
  console.log(`\n[stage 3] mapping + inserting ${rows.length} transactions…`)
  const sourceToTarget = buildSourceToTarget(accountMappings)
  const accountId = (sourceName: string | null): string | null => {
    if (!sourceName) return null
    const target = sourceToTarget.get(sourceName)
    if (!target) return null
    return accountIdByTarget.get(target) ?? null
  }
  const catId = (sourceName: string): string | null => sourceCategoryToId.get(sourceName) ?? null
  const syntheticCatId = (key: string): string | null => sourceCategoryToId.get(key) ?? null

  const inserts: TxnInsert[] = []
  const skipped: Record<string, number> = {}
  // Track final running balance per account-target-name (CSV order, chronological).
  const finalBalanceByTarget = new Map<string, { balance: number; date: string; sortKey: string }>()
  const unresolvedAccounts = new Set<string>()

  // Sort rows chronologically with file+line tiebreaker
  rows.sort((a, b) => {
    if (a.dateIso < b.dateIso) return -1
    if (a.dateIso > b.dateIso) return 1
    if (a.sourceFile !== b.sourceFile) return a.sourceFile - b.sourceFile
    return a.sourceLine - b.sourceLine
  })

  for (const r of rows) {
    const result = mapRow(r, userId, accountId, catId, syntheticCatId)
    if (result.skip) {
      skipped[result.skip] = (skipped[result.skip] || 0) + 1
      if (result.skip.includes('unknown account') || result.skip.includes('w/o known account')) {
        if (r.account) unresolvedAccounts.add(r.account)
        if (r.accountTo) unresolvedAccounts.add(r.accountTo)
      }
      continue
    }
    if (result.row) {
      inserts.push(result.row)
      // Track final balance for the *source* account: Balance column reflects
      // the running balance OF the `Account` column.
      if (r.balance !== null && r.account) {
        const target = sourceToTarget.get(r.account)
        if (target) {
          const sortKey = `${r.dateIso}|${r.sourceFile}|${r.sourceLine}`
          const prev = finalBalanceByTarget.get(target)
          if (!prev || sortKey > prev.sortKey) {
            finalBalanceByTarget.set(target, { balance: r.balance, date: r.date, sortKey })
          }
        }
      }
    }
  }

  // Batched inserts.
  let inserted = 0
  for (let i = 0; i < inserts.length; i += BATCH_SIZE) {
    const chunk = inserts.slice(i, i + BATCH_SIZE)
    const { error } = await clients.finance.from('transactions').insert(chunk)
    if (error) {
      console.error(`batch starting at ${i}: ${error.message}`)
      console.error('sample row:', JSON.stringify(chunk[0], null, 2))
      throw new Error(`insert failed: ${error.message}`)
    }
    inserted += chunk.length
    process.stdout.write(`  inserted ${inserted}/${inserts.length}\r`)
  }
  process.stdout.write('\n')

  if (unresolvedAccounts.size) {
    console.warn(`[warn] unresolved accounts: ${Array.from(unresolvedAccounts).join(', ')}`)
  }

  // Convert target→balance map to accountId→balance map for stage 4.
  const finalBalanceByAccountId = new Map<string, number>()
  for (const [target, { balance }] of finalBalanceByTarget) {
    const id = accountIdByTarget.get(target)
    if (id) finalBalanceByAccountId.set(id, balance)
  }
  return { inserted, skipped, finalBalanceByAccountId }
}

// =============================================================================
// Stage 4: Final balances
// =============================================================================

async function applyFinalBalances(
  clients: FinanceClients,
  finalBalanceByAccountId: Map<string, number>,
): Promise<void> {
  console.log(`\n[stage 4] setting final balances for ${finalBalanceByAccountId.size} accounts…`)
  for (const [accountId, balance] of finalBalanceByAccountId) {
    const { error } = await clients.finance
      .from('accounts')
      .update({ balance })
      .eq('id', accountId)
    if (error) throw new Error(`update balance for ${accountId}: ${error.message}`)
  }
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  await loadEnv()
  const clients = buildClients()
  const userId = await ensureUser(clients, USER_EMAIL)
  console.log(`user_id: ${userId}`)

  const [rawText, accountText, categoryText] = await Promise.all([
    fs.readFile(path.join(DATA_DIR, 'raw.json'), 'utf8'),
    fs.readFile(path.join(MAPPINGS_DIR, 'accounts.json'), 'utf8'),
    fs.readFile(path.join(MAPPINGS_DIR, 'categories.json'), 'utf8'),
  ])
  const rows: NormalizedRow[] = JSON.parse(rawText)
  const accountMappings: AccountMapping[] = JSON.parse(accountText)
  const categoryMappings: CategoryMapping[] = JSON.parse(categoryText)
  console.log(`Loaded ${rows.length} raw rows, ${accountMappings.length} accounts, ${categoryMappings.length} categories.`)

  const accountIdByTarget = await seedAccounts(clients, userId, accountMappings)
  const sourceCategoryToId = await seedCategories(clients, userId, categoryMappings)
  const result = await seedTransactions(clients, userId, rows, accountIdByTarget, sourceCategoryToId, accountMappings)
  await applyFinalBalances(clients, result.finalBalanceByAccountId)

  console.log('\n=== Seed Report ===')
  console.log(`inserted transactions: ${result.inserted}`)
  console.log(`skipped:`)
  const skipEntries = Object.entries(result.skipped).sort((a, b) => b[1] - a[1])
  for (const [reason, n] of skipEntries) console.log(`  ${n.toString().padStart(5)}  ${reason}`)
  console.log(`final-balance updates: ${result.finalBalanceByAccountId.size}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
