/**
 * Shared helpers for the Money Pro import scripts.
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

/** Load .env.local into process.env (zero-dep parser). */
export async function loadEnv() {
  const envPath = path.resolve(__dirname, '..', '..', '..', '.env.local')
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
    console.warn(`[warn] no .env.local at ${envPath}`)
  }
}

// Loose alias: the `finance` client is scoped to a non-`public` schema, which
// otherwise trips the default SupabaseClient<_, 'public'> generic.
type AnySupabaseClient = SupabaseClient<any, any, any>

export interface FinanceClients {
  /** Service-role client scoped to the `finance` schema. Bypasses RLS. */
  finance: AnySupabaseClient
  /** Service-role client on the default `public` schema (for auth + users). */
  publicSr: AnySupabaseClient
  /** Auth admin client (service role, default schema). */
  authAdmin: AnySupabaseClient
}

export function buildClients(): FinanceClients {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set in .env.local')
  if (!serviceKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not set in .env.local. Get it from the output of `supabase start`.',
    )
  }
  const finance = createClient(url, serviceKey, {
    db: { schema: 'finance' },
    auth: { persistSession: false },
  })
  const publicSr = createClient(url, serviceKey, { auth: { persistSession: false } })
  const authAdmin = publicSr
  return { finance, publicSr, authAdmin }
}

/**
 * Find an auth user by email; create them via the admin API if missing.
 * Relies on the `on_auth_user_created` trigger to populate public.users.
 */
export async function ensureUser(clients: FinanceClients, email: string): Promise<string> {
  // Page through the (small) user list.
  const { data, error } = await clients.authAdmin.auth.admin.listUsers({ page: 1, perPage: 200 })
  if (error) throw new Error(`listUsers failed: ${error.message}`)
  const existing = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
  if (existing) return existing.id

  console.log(`[ensureUser] creating user ${email}`)
  const { data: created, error: createErr } = await clients.authAdmin.auth.admin.createUser({
    email,
    email_confirm: true,
    password: crypto.randomUUID(),
  })
  if (createErr || !created.user) {
    throw new Error(`createUser failed: ${createErr?.message ?? 'no user returned'}`)
  }
  return created.user.id
}
