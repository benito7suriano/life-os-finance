// Resolves free-text extractor hints (merchant, category, account names)
// into concrete IDs from the user's finance.* tables.
//
// Strategy: case-insensitive substring match. If no match for merchant,
// auto-create one (matches existing manual-add behavior).

import type { SupabaseClient } from '@supabase/supabase-js'
import type { ExtractedTransaction } from './extract-transaction'

// Accept any supabase-js schema generic — caller may pass a finance-scoped client.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = SupabaseClient<any, any, any>

export interface ResolvedReferences {
  merchantId: string | null
  categoryId: string | null
  accountId: string | null
  /** Resolution notes for the user-facing confirmation message. */
  notes: {
    merchantCreated: boolean
    categoryMatched: boolean
    accountMatched: boolean
  }
}

interface NamedRow {
  id: string
  name: string
}

interface AccountRow extends NamedRow {
  last_4_digits?: string | null
}

function bestMatch<T extends NamedRow>(rows: T[], hint: string | null): T | null {
  if (!hint) return null
  const lower = hint.trim().toLowerCase()
  if (!lower) return null

  // 1. Exact case-insensitive match wins.
  const exact = rows.find(r => r.name.toLowerCase() === lower)
  if (exact) return exact

  // 2. Substring match (either direction).
  const sub = rows.find(
    r => r.name.toLowerCase().includes(lower) || lower.includes(r.name.toLowerCase())
  )
  return sub ?? null
}

/**
 * Account matching is more permissive than generic name matching:
 * - Also matches last-4-digits anywhere in the hint (e.g. "visa gold 4521").
 * - Falls back to substring on name.
 */
function matchAccount(rows: AccountRow[], hint: string | null): AccountRow | null {
  if (!hint) return null
  const lower = hint.trim().toLowerCase()
  if (!lower) return null

  // 1. last_4_digits match
  const byDigits = rows.find(
    r => r.last_4_digits && lower.includes(r.last_4_digits)
  )
  if (byDigits) return byDigits

  // 2. fallback to name match
  return bestMatch(rows, hint)
}

/**
 * @param supabase Finance-scoped Supabase client (createFinanceClient()).
 * @param userId The owning user's id.
 * @param extracted The Gemini extraction result.
 * @param direction 'expense' | 'income' — narrows the category search.
 */
export async function resolveReferences(
  supabase: AnySupabase,
  userId: string,
  extracted: ExtractedTransaction
): Promise<ResolvedReferences> {
  // Pull candidates in parallel.
  const [merchantsRes, categoriesRes, accountsRes] = await Promise.all([
    supabase.from('merchants').select('id, name').eq('user_id', userId),
    supabase
      .from('categories')
      .select('id, name, type')
      .eq('user_id', userId)
      .eq('type', extracted.direction),
    supabase
      .from('accounts')
      .select('id, name, last_4_digits')
      .eq('user_id', userId)
      .is('deleted_at', null),
  ])

  const merchants = (merchantsRes.data ?? []) as NamedRow[]
  const categories = (categoriesRes.data ?? []) as NamedRow[]
  const accounts = (accountsRes.data ?? []) as AccountRow[]

  // Resolve category and account by hint.
  const matchedCategory = bestMatch(categories, extracted.categoryHint)
  const matchedAccount = matchAccount(accounts, extracted.accountHint)

  // Resolve merchant — create if missing and we have a name.
  let merchantId: string | null = null
  let merchantCreated = false

  const matchedMerchant = bestMatch(merchants, extracted.merchant)
  if (matchedMerchant) {
    merchantId = matchedMerchant.id
  } else if (extracted.merchant && extracted.merchant.trim()) {
    const { data: created, error } = await supabase
      .from('merchants')
      .insert({ user_id: userId, name: extracted.merchant.trim() })
      .select('id')
      .single()
    if (!error && created) {
      merchantId = created.id
      merchantCreated = true
    }
  }

  // Fallback: if no account hint matched, pick the user's first account.
  // Single-user app — usually just one or two.
  let accountId = matchedAccount?.id ?? null
  if (!accountId && accounts.length > 0) {
    accountId = accounts[0].id
  }

  return {
    merchantId,
    categoryId: matchedCategory?.id ?? null,
    accountId,
    notes: {
      merchantCreated,
      categoryMatched: !!matchedCategory,
      accountMatched: !!matchedAccount,
    },
  }
}
