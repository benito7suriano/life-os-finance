// Resolves free-text extractor hints (merchant, category, account names)
// into concrete IDs from the user's finance.* tables.
//
// Strategy: case-insensitive substring match. Merchants are NEVER created
// here — creation happens at confirm time so cancelled transactions don't
// leave orphan merchants behind.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { ExtractedTransaction } from './extract-transaction'

// Accept any supabase-js schema generic — caller may pass a finance-scoped client.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = SupabaseClient<any, any, any>

export interface ResolvedReferences {
  /** Matched merchant id — null when unmatched (created at confirm time). */
  merchantId: string | null
  /** Trimmed merchant name for display and confirm-time creation. */
  merchantName: string | null
  categoryId: string | null
  categoryName: string | null
  categorySource: 'hint' | 'merchant_default' | 'user_choice' | null
  accountId: string | null
  accountName: string | null
  accountSource: 'hint' | 'default' | 'user_choice' | null
  /** Transfers only: destination account. Optional so legacy stored payloads
   * (pre-transfer) still typecheck. */
  toAccountId?: string | null
  toAccountName?: string | null
  toAccountSource?: 'hint' | 'user_choice' | null
  /** Resolution notes for the user-facing confirmation message. */
  notes: {
    merchantMatched: boolean
    categoryMatched: boolean
    accountMatched: boolean
  }
}

export interface OptionItem {
  id: string
  name: string
}

export interface ResolutionContext {
  resolved: ResolvedReferences
  /** Direction-filtered, name-ordered — used to build clarification keyboards. */
  categories: OptionItem[]
  /** created_at-ordered (default account first). */
  accounts: OptionItem[]
}

interface NamedRow {
  id: string
  name: string
}

interface MerchantRow extends NamedRow {
  default_category_id?: string | null
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
 * @param supabase Finance-scoped Supabase client.
 * @param userId The owning user's id.
 * @param extracted The Gemini extraction result (direction narrows categories).
 */
export async function resolveReferences(
  supabase: AnySupabase,
  userId: string,
  extracted: ExtractedTransaction
): Promise<ResolutionContext> {
  // Pull candidates in parallel.
  const [merchantsRes, categoriesRes, accountsRes] = await Promise.all([
    supabase
      .from('merchants')
      .select('id, name, default_category_id')
      .eq('user_id', userId),
    supabase
      .from('categories')
      .select('id, name, type')
      .eq('user_id', userId)
      .eq('type', extracted.direction)
      .order('name', { ascending: true }),
    supabase
      .from('accounts')
      .select('id, name, last_4_digits')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true }),
  ])

  const merchants = (merchantsRes.data ?? []) as MerchantRow[]
  const categories = (categoriesRes.data ?? []) as NamedRow[]
  const accounts = (accountsRes.data ?? []) as AccountRow[]

  // Merchant: match only — creation is deferred to confirm time.
  const matchedMerchant = bestMatch(merchants, extracted.merchant)
  const merchantName =
    matchedMerchant?.name ?? (extracted.merchant?.trim() || null)

  // Category: hint match → matched merchant's default → null (ask the user).
  let categoryId: string | null = null
  let categoryName: string | null = null
  let categorySource: ResolvedReferences['categorySource'] = null

  const matchedCategory = bestMatch(categories, extracted.categoryHint)
  if (matchedCategory) {
    categoryId = matchedCategory.id
    categoryName = matchedCategory.name
    categorySource = 'hint'
  } else if (matchedMerchant?.default_category_id) {
    const fallback = categories.find(
      c => c.id === matchedMerchant.default_category_id
    )
    if (fallback) {
      categoryId = fallback.id
      categoryName = fallback.name
      categorySource = 'merchant_default'
    }
  }

  // Account: hint match → single-account default → null (ask the user).
  // Transfers skip the single-account default — they need two distinct accounts.
  const matchedAccount = matchAccount(accounts, extracted.accountHint)
  let accountId: string | null = null
  let accountName: string | null = null
  let accountSource: ResolvedReferences['accountSource'] = null
  if (matchedAccount) {
    accountId = matchedAccount.id
    accountName = matchedAccount.name
    accountSource = 'hint'
  } else if (accounts.length === 1 && extracted.direction !== 'transfer') {
    accountId = accounts[0].id
    accountName = accounts[0].name
    accountSource = 'default'
  }

  // Destination account (transfers only). Never allowed to collide with the
  // resolved source account — a bad hint match there means "ask the user".
  let toAccountId: string | null = null
  let toAccountName: string | null = null
  let toAccountSource: ResolvedReferences['toAccountSource'] = null
  if (extracted.direction === 'transfer') {
    const matchedTo = matchAccount(accounts, extracted.toAccountHint ?? null)
    if (matchedTo && matchedTo.id !== accountId) {
      toAccountId = matchedTo.id
      toAccountName = matchedTo.name
      toAccountSource = 'hint'
    }
  }

  return {
    resolved: {
      merchantId: matchedMerchant?.id ?? null,
      merchantName,
      categoryId,
      categoryName,
      categorySource,
      accountId,
      accountName,
      accountSource,
      toAccountId,
      toAccountName,
      toAccountSource,
      notes: {
        merchantMatched: !!matchedMerchant,
        categoryMatched: !!matchedCategory,
        accountMatched: !!matchedAccount,
      },
    },
    categories: categories.map(({ id, name }) => ({ id, name })),
    accounts: accounts.map(({ id, name }) => ({ id, name })),
  }
}
