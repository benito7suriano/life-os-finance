/**
 * Phase 3: Wipe finance.* data for the target user.
 *
 * Drops every transaction, account, budget, merchant, and user-scoped category
 * belonging to `bjsuriano@gmail.com`. System categories (is_system=true) are
 * preserved. Auth user is also preserved (and created if missing).
 *
 * Run: npx tsx scripts/import/money-pro/03-wipe.ts
 */
import { buildClients, ensureUser, loadEnv } from './lib'

const USER_EMAIL = 'bjsuriano@gmail.com'

async function main() {
  await loadEnv()
  const clients = buildClients()
  const userId = await ensureUser(clients, USER_EMAIL)
  console.log(`user_id: ${userId}`)

  const f = clients.finance

  // Order matters because of FKs. Deleting transactions cascades into
  // goal_contributions (ON DELETE CASCADE on transaction_id).
  // Supabase query builders are thenable (PromiseLike) rather than real
  // Promises, so type the callback return as PromiseLike to satisfy `await`.
  const steps: Array<{ label: string; run: () => PromiseLike<{ count?: number | null; error: { message: string } | null }> }> = [
    { label: 'transactions',             run: () => f.from('transactions').delete({ count: 'exact' }).eq('user_id', userId) },
    { label: 'budget_monthly_snapshots', run: () => f.from('budget_monthly_snapshots').delete({ count: 'exact' }).eq('user_id', userId) },
    { label: 'budgets',                  run: () => f.from('budgets').delete({ count: 'exact' }).eq('user_id', userId) },
    { label: 'goals',                    run: () => f.from('goals').delete({ count: 'exact' }).eq('user_id', userId) },
    { label: 'merchants',                run: () => f.from('merchants').delete({ count: 'exact' }).eq('user_id', userId) },
    { label: 'categories (user)',        run: () => f.from('categories').delete({ count: 'exact' }).eq('user_id', userId).eq('is_system', false) },
    { label: 'accounts',                 run: () => f.from('accounts').delete({ count: 'exact' }).eq('user_id', userId) },
  ]

  for (const step of steps) {
    const { count, error } = await step.run()
    if (error) {
      console.error(`[error] ${step.label}: ${error.message}`)
      process.exit(1)
    }
    console.log(`  cleared ${step.label.padEnd(28)} (${count ?? 0} rows)`)
  }

  console.log('')
  console.log('Wipe complete.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
