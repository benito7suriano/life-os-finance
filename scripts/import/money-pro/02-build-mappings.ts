/**
 * Phase 2: Generate human-reviewable mapping JSONs from the Phase 0 inventories.
 *
 * Inputs : data/unique-accounts.json, data/unique-categories.json
 * Outputs: mappings/accounts.json, mappings/categories.json
 *
 * These are CHECKPOINT artifacts — the user reviews and edits them before
 * Phase 4 (seed). Re-running this script will OVERWRITE the mapping files
 * unless they already exist (idempotent default; pass --force to regenerate).
 *
 * Run: npx tsx scripts/import/money-pro/02-build-mappings.ts [--force]
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'

const DATA_DIR = path.resolve(__dirname, 'data')
const MAPPINGS_DIR = path.resolve(__dirname, 'mappings')

type Currency = 'USD' | 'DOP'
type AccountType = 'checking' | 'savings' | 'credit_card' | 'loan' | 'wallet' | 'investment'
type AssetClass =
  | 'investment_fund'
  | 'business'
  | 'pension'
  | 'retirement'
  | 'real_estate'
  | 'vehicle'

interface AccountInventory {
  name: string
  currencies: Currency[]
  firstSeen: string
  lastSeen: string
  txnCount: number
}

interface CategoryInventory {
  name: string
  parent: string
  child: string | null
  txnCount: number
  transactionTypes: string[]
}

interface AccountMapping {
  /** All Money Pro source-account spellings that collapse to this target. */
  sourceNames: string[]
  /** Display name in Life OS (defaults to the canonical source name). */
  targetName: string
  type: AccountType
  /** Only set when type='investment'. */
  assetClass?: AssetClass
  currency: Currency
  /** Free-text note for the user — not persisted. */
  notes?: string
}

interface CategoryMapping {
  sourceName: string
  /** Money Pro parent (left of the colon) or the whole name if no colon. */
  parent: string
  /** Money Pro child (right of the colon) or null. */
  child: string | null
  type: 'income' | 'expense'
  /**
   * Existing Life OS system category to nest this under, OR null to create a
   * new user-scoped parent named `parent`.
   */
  systemParent: string | null
}

/** 8 seeded system categories (case-insensitive match key). */
const SYSTEM_CATEGORIES = [
  'Auto & Transportation',
  'Bills & Utilities',
  'Food & Dining',
  'Health & Wellness',
  'Housing',
  'Income',
  'Shopping',
  'Travel & Lifestyle',
]

function classifyAccount(name: string, currencies: Currency[]): {
  type: AccountType
  assetClass?: AssetClass
  currency: Currency
  notes?: string
} {
  const lower = name.toLowerCase()
  const currency: Currency = currencies.includes('DOP') && !currencies.includes('USD')
    ? 'DOP'
    : currencies.includes('USD') && !currencies.includes('DOP')
    ? 'USD'
    : currencies[0] || 'USD'

  // Real estate
  if (/^8-vii\b|sky 01|liberty place/i.test(name)) {
    return { type: 'investment', assetClass: 'real_estate', currency }
  }
  // Vehicles
  if (/hyundai|tucson/i.test(name)) {
    return { type: 'investment', assetClass: 'vehicle', currency }
  }
  // Pension / retirement
  if (/^afp$/i.test(name)) {
    return { type: 'investment', assetClass: 'pension', currency }
  }
  if (/^rl360$/i.test(name)) {
    return { type: 'investment', assetClass: 'retirement', currency }
  }
  // Business
  if (/^paas$/i.test(name)) {
    return { type: 'investment', assetClass: 'business', currency }
  }
  // Investment funds
  if (/atlántida|atlantida|aureus|alpha inversion|wahoo/i.test(name)) {
    return { type: 'investment', assetClass: 'investment_fund', currency }
  }
  // Credit cards (Popular 1778 is a Visa card per user, despite its name)
  if (/\bvisa\b|\bamex\b|\bplatinum\b|\bmastercard\b|\bcredit\b|^popular gold|^popular 1778/i.test(name)) {
    return { type: 'credit_card', currency }
  }
  // Wallet / cash (Depósito D28 is a cash deposit per user, not a savings account)
  if (/^wallet|^cash|depósito d28|deposito d28/i.test(name)) {
    return { type: 'wallet', currency, notes: name.includes('Depósito') ? 'Per user: cash deposit account, not asset' : undefined }
  }
  // Loan account
  if (/^préstamos?$|^prestamos?$/i.test(name)) {
    return { type: 'loan', currency, notes: 'Was "Préstamos" in Money Pro — verify if asset (owed to you) or liability (you owe)' }
  }
  // Savings (by keyword)
  if (/savings|ahorro/i.test(name)) {
    return { type: 'savings', currency }
  }
  // Default: checking
  return { type: 'checking', currency }
}

/**
 * Per-source-name overrides. These take precedence over the heuristics below.
 * Format: sourceName → { type?, systemParent?, parent?, child? }
 * If a field is omitted, the heuristic/raw value is used.
 */
const CATEGORY_OVERRIDES: Record<
  string,
  { type?: 'income' | 'expense'; systemParent?: string | null; parent?: string; child?: string | null }
> = {
  // Mia Valentina → flat "Suriano Siu Carpio Family" parent (drop the "Mia Valentina" middle layer)
  'Mia Valentina: Baby stuff':   { systemParent: 'Suriano Siu Carpio Family', parent: 'Suriano Siu Carpio Family', child: 'Baby stuff' },
  'Mia Valentina: Bautizo':      { systemParent: 'Suriano Siu Carpio Family', parent: 'Suriano Siu Carpio Family', child: 'Bautizo' },
  'Mia Valentina: Childcare':    { systemParent: 'Suriano Siu Carpio Family', parent: 'Suriano Siu Carpio Family', child: 'Childcare' },
  'Mia Valentina: Eye Surgery':  { systemParent: 'Suriano Siu Carpio Family', parent: 'Suriano Siu Carpio Family', child: 'Eye Surgery' },
  'Mia Valentina: Medicine':     { systemParent: 'Suriano Siu Carpio Family', parent: 'Suriano Siu Carpio Family', child: 'Medicine' },
  'Mia Valentina: Vacunas':      { systemParent: 'Suriano Siu Carpio Family', parent: 'Suriano Siu Carpio Family', child: 'Vacunas' },

  // Wedding → Suriano Siu Carpio Family
  'Wedding': { systemParent: 'Suriano Siu Carpio Family', parent: 'Suriano Siu Carpio Family', child: 'Wedding' },

  // Market → Home > Groceries
  'Market': { systemParent: 'Home', parent: 'Home', child: 'Groceries' },

  // Bash → Personal > Party
  'Bash': { systemParent: 'Personal', parent: 'Personal', child: 'Party' },

  // project-r → Suriano Siu Carpio Family > Wedding Ring
  'project-r': { systemParent: 'Suriano Siu Carpio Family', parent: 'Suriano Siu Carpio Family', child: 'Wedding Ring' },

  // Docs → Personal > Personal Documents
  'Docs': { systemParent: 'Personal', parent: 'Personal', child: 'Personal Documents' },

  // Ferromax → Income > Ferromax > Ferromax N (existing parent='Ferromax', child='Ferromax 1'/'Ferromax 2' stays)
  'Ferromax: Ferromax 1': { type: 'income', systemParent: 'Income' },
  'Ferromax: Ferromax 2': { type: 'income', systemParent: 'Income' },
}

function classifyCategory(inv: CategoryInventory): {
  type: 'income' | 'expense'
  systemParent: string | null
} {
  // Determine income vs expense from how Money Pro used it.
  const types = new Set(inv.transactionTypes)
  let type: 'income' | 'expense' = 'expense'
  if (types.has('Income') && !types.has('Expense')) type = 'income'
  else if (types.has('Expense') && !types.has('Income')) type = 'expense'
  else if (types.has('Asset Sale') || (types.has('Balance Adjustment') && !types.has('Expense'))) {
    type = inv.transactionTypes.some((t) => t === 'Income' || t === 'Asset Sale') ? 'income' : 'expense'
  }

  const lower = (inv.parent + ' ' + (inv.child || '')).toLowerCase()

  // Income side: route Padel RD / Ferromax under system "Income" parent so they
  // group as Income > Padel RD > <leaf>.
  if (type === 'income' && /^padel rd|^ferromax/i.test(inv.parent)) {
    return { type, systemParent: 'Income' }
  }
  if (
    /interest income|dividend income|re payment|sky 01|gifts|work|family|favores/i.test(lower) &&
    type === 'income'
  ) {
    return { type, systemParent: 'Income' }
  }

  // Map by Money Pro parent keyword → Life OS system parent
  if (/lifestyle/.test(lower)) return { type, systemParent: 'Travel & Lifestyle' }
  if (/travel/.test(lower)) return { type, systemParent: 'Travel & Lifestyle' }
  if (/carro|uber|peajes|parqueo|llantas|marbete|gas |gasoline/.test(lower)) {
    return { type, systemParent: 'Auto & Transportation' }
  }
  if (/casa|housekeeping|jardine|mobiliario|home stuff|mantenimiento/.test(lower)) {
    return { type, systemParent: 'Housing' }
  }
  if (/electricidad|agua|internet|online services|software/.test(lower)) {
    return { type, systemParent: 'Bills & Utilities' }
  }
  if (/health|fisio|gym|medicina|odontólogo|odontologo|masaje|cuidado dental/.test(lower)) {
    return { type, systemParent: 'Health & Wellness' }
  }
  if (/sports|pádel|padel|golf|surf|yoga|swimming/.test(lower)) {
    return { type, systemParent: 'Health & Wellness' }
  }
  if (/coffee|eating out|food/.test(lower)) {
    return { type, systemParent: 'Food & Dining' }
  }
  if (/clothing|dress|jewelry|electronics|personal care|shipping/.test(lower)) {
    return { type, systemParent: 'Shopping' }
  }
  // No clean system parent — leave as new user-scoped parent
  return { type, systemParent: null }
}

function applyOverride(m: CategoryMapping): CategoryMapping {
  const ov = CATEGORY_OVERRIDES[m.sourceName]
  if (!ov) return m
  return {
    ...m,
    ...(ov.type !== undefined ? { type: ov.type } : {}),
    ...(ov.systemParent !== undefined ? { systemParent: ov.systemParent } : {}),
    ...(ov.parent !== undefined ? { parent: ov.parent } : {}),
    ...(ov.child !== undefined ? { child: ov.child } : {}),
  }
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

async function main() {
  const force = process.argv.includes('--force')
  await fs.mkdir(MAPPINGS_DIR, { recursive: true })

  const accounts: AccountInventory[] = JSON.parse(
    await fs.readFile(path.join(DATA_DIR, 'unique-accounts.json'), 'utf8'),
  )
  const categories: CategoryInventory[] = JSON.parse(
    await fs.readFile(path.join(DATA_DIR, 'unique-categories.json'), 'utf8'),
  )

  // -- Account mappings -------------------------------------------------------
  const accountsPath = path.join(MAPPINGS_DIR, 'accounts.json')
  if (!force && (await exists(accountsPath))) {
    console.log(`[skip] ${path.relative(process.cwd(), accountsPath)} exists. Pass --force to overwrite.`)
  } else {
    // Collapse aliases: bare "Wallet" (from `Account (to)` column with no
    // currency suffix) folds into "Wallet (USD)".
    const aliases: Record<string, string> = { Wallet: 'Wallet (USD)' }
    const absorbed = new Set<string>(Object.keys(aliases))
    const byTarget = new Map<string, AccountInventory[]>()
    for (const a of accounts) {
      const target = aliases[a.name] || a.name
      const list = byTarget.get(target) || []
      list.push(a)
      byTarget.set(target, list)
    }
    const accountMappings: AccountMapping[] = []
    for (const [target, group] of byTarget) {
      const sourceNames = group
        .map((g) => g.name)
        .concat(Object.entries(aliases).filter(([, v]) => v === target).map(([k]) => k))
        .filter((v, i, arr) => arr.indexOf(v) === i)
        .sort()
      const allCurrencies = Array.from(new Set(group.flatMap((g) => g.currencies)))
      const cls = classifyAccount(target, allCurrencies as Currency[])
      accountMappings.push({
        sourceNames,
        targetName: target,
        type: cls.type,
        ...(cls.assetClass ? { assetClass: cls.assetClass } : {}),
        currency: cls.currency,
        ...(cls.notes ? { notes: cls.notes } : {}),
      })
    }
    accountMappings.sort((a, b) => a.targetName.localeCompare(b.targetName))

    // NOTE: verified balances live in the gitignored `balances.local.json`
    // (keyed by targetName), NOT in accounts.json — so regen never touches them.
    await fs.writeFile(accountsPath, JSON.stringify(accountMappings, null, 2), 'utf8')
    console.log(`wrote ${path.relative(process.cwd(), accountsPath)} (${accountMappings.length} accounts)`)
  }

  // -- Category mappings ------------------------------------------------------
  const categoriesPath = path.join(MAPPINGS_DIR, 'categories.json')
  if (!force && (await exists(categoriesPath))) {
    console.log(`[skip] ${path.relative(process.cwd(), categoriesPath)} exists. Pass --force to overwrite.`)
  } else {
    const categoryMappings: CategoryMapping[] = categories.map((c) => {
      const cls = classifyCategory(c)
      const base: CategoryMapping = {
        sourceName: c.name,
        parent: c.parent,
        child: c.child,
        type: cls.type,
        systemParent: cls.systemParent,
      }
      return applyOverride(base)
    })

    // Synthetic categories for Money Pro types that don't carry one
    categoryMappings.push(
      { sourceName: '__balance_adjustment_expense__', parent: 'Balance Adjustment', child: null, type: 'expense', systemParent: null },
      { sourceName: '__balance_adjustment_income__',  parent: 'Balance Adjustment', child: null, type: 'income',  systemParent: null },
      { sourceName: '__asset_purchase__',             parent: 'Asset Purchase',     child: null, type: 'expense', systemParent: null },
      { sourceName: '__asset_sale__',                 parent: 'Asset Sale',         child: null, type: 'income',  systemParent: null },
    )

    await fs.writeFile(categoriesPath, JSON.stringify(categoryMappings, null, 2), 'utf8')
    console.log(`wrote ${path.relative(process.cwd(), categoriesPath)} (${categoryMappings.length} categories)`)
  }

  // -- Summary ----------------------------------------------------------------
  console.log('')
  console.log('=== Summary ===')
  const byType: Record<string, number> = {}
  const byAssetClass: Record<string, number> = {}
  for (const a of accounts) {
    const cls = classifyAccount(a.name, a.currencies)
    byType[cls.type] = (byType[cls.type] || 0) + 1
    if (cls.assetClass) byAssetClass[cls.assetClass] = (byAssetClass[cls.assetClass] || 0) + 1
  }
  console.log('Account types:')
  for (const [k, v] of Object.entries(byType).sort()) console.log(`  ${k.padEnd(15)} ${v}`)
  console.log('Asset classes:')
  for (const [k, v] of Object.entries(byAssetClass).sort()) console.log(`  ${k.padEnd(20)} ${v}`)
  console.log('')
  console.log('System categories on local:', SYSTEM_CATEGORIES.join(', '))
  console.log('')
  console.log('NEXT: review and edit:')
  console.log('  scripts/import/money-pro/mappings/accounts.json')
  console.log('  scripts/import/money-pro/mappings/categories.json')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
