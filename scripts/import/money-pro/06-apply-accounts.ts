/**
 * Phase G: Apply verified account corrections from accounts.json.
 *
 * For each mapping entry, updates the matching finance.accounts row (by name)
 * with its `type`, `currency`, `assetClass`. Verified current balances live in
 * a SEPARATE, gitignored file `mappings/balances.local.json` (an object keyed
 * by targetName → balance in native currency, signed) so balances never enter
 * git. When that file is present, balances are applied too.
 *
 * This does NOT touch transactions; account IDs are stable, so reclassifying a
 * type or fixing a balance needs no reseed.
 *
 * Run: zsh -i -c 'npx tsx scripts/import/money-pro/06-apply-accounts.ts'
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { buildClients, ensureUser, loadEnv } from './lib'

const USER_EMAIL = 'bjsuriano@gmail.com'
const MAPPINGS_DIR = path.resolve(__dirname, 'mappings')
const BALANCES_FILE = path.join(MAPPINGS_DIR, 'balances.local.json')

interface AccountMapping {
  sourceNames: string[]
  targetName: string
  type: string
  assetClass?: string
  currency: string
}

async function main() {
  await loadEnv()
  const clients = buildClients()
  const userId = await ensureUser(clients, USER_EMAIL)
  const f = clients.finance

  const mappings: AccountMapping[] = JSON.parse(
    await fs.readFile(path.join(MAPPINGS_DIR, 'accounts.json'), 'utf8'),
  )

  // Optional, gitignored balances file: { [targetName]: balance }.
  let balances: Record<string, number> = {}
  try {
    balances = JSON.parse(await fs.readFile(BALANCES_FILE, 'utf8'))
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
      console.warn(`[warn] no ${path.basename(BALANCES_FILE)} — applying types/currencies only, balances unchanged.`)
    } else {
      throw e
    }
  }

  let updated = 0
  let balanceUpdates = 0
  const missing: string[] = []

  for (const m of mappings) {
    const update: Record<string, unknown> = {
      type: m.type,
      currency: m.currency,
      asset_class: m.type === 'investment' ? m.assetClass ?? null : null,
    }
    if (Object.prototype.hasOwnProperty.call(balances, m.targetName)) {
      update.balance = balances[m.targetName]
      balanceUpdates++
    }

    const { data, error } = await f
      .from('accounts')
      .update(update)
      .eq('user_id', userId)
      .eq('name', m.targetName)
      .select('id')

    if (error) {
      console.error(`[error] ${m.targetName}: ${error.message}`)
      process.exit(1)
    }
    if (!data || data.length === 0) {
      missing.push(m.targetName)
      continue
    }
    updated += data.length
  }

  console.log(`Updated ${updated} accounts (${balanceUpdates} with explicit currentBalance).`)
  if (missing.length) {
    console.warn(`[warn] no matching account row for: ${missing.join(', ')}`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
