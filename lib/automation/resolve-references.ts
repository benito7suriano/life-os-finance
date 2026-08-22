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
  /** 'user_new' = user named a category that doesn't exist yet; it is created
   *  at confirm time (categoryId stays null until then). */
  categorySource: 'hint' | 'merchant_default' | 'user_choice' | 'user_new' | null
  accountId: string | null
  accountName: string | null
  accountSource: 'hint' | 'default' | 'user_choice' | null
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

const CLOSEST_CATEGORY_THRESHOLD = 0.72

/** Case/diacritic-insensitive, whitespace-collapsed comparison form. */
function normalizeName(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const curr = [i]
    for (let j = 1; j <= b.length; j++) {
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      )
    }
    prev = curr
  }
  return prev[b.length]
}

function similarity(a: string, b: string): number {
  const max = Math.max(a.length, b.length)
  return max === 0 ? 1 : 1 - levenshtein(a, b) / max
}

/** Light plural stemming per token: "groceries"→"grocery", "pets"→"pet". */
function stemToken(t: string): string {
  if (t.length > 4 && t.endsWith('ies')) return `${t.slice(0, -3)}y`
  if (t.length > 3 && t.endsWith('s')) return t.slice(0, -1)
  return t
}

function stemName(s: string): string {
  return s.split(' ').map(stemToken).join(' ')
}

function nameScore(input: string, name: string): number {
  if (input === name) return 1
  // Substring either direction — the contained side must be long enough to be
  // meaningful ("co" must not match into "Coffee").
  if (
    (input.length >= 3 && name.includes(input)) ||
    (name.length >= 3 && input.includes(name))
  ) {
    return 0.95
  }
  let score = similarity(input, name)
  // Token level, so "helth" still finds "Health & Wellness". Slightly
  // discounted: a matching word is weaker evidence than the whole name.
  const inputTokens = input.split(' ').filter(t => t.length >= 3)
  const nameTokens = name.split(' ').filter(t => t.length >= 3)
  for (const it of inputTokens) {
    for (const nt of nameTokens) {
      score = Math.max(score, similarity(it, nt) - 0.05)
    }
  }
  return score
}

/**
 * Finds the category closest to a name the user typed. Tolerates case,
 * accents, typos, and partial names ("grocery" → "Groceries", "dining" →
 * "Food & Dining"). Returns null when nothing clears the acceptance
 * threshold — the caller then treats the input as a brand-new category.
 */
export function closestCategory(
  categories: OptionItem[],
  input: string
): OptionItem | null {
  const needle = normalizeName(input)
  if (!needle) return null
  const stemmedNeedle = stemName(needle)
  let best: OptionItem | null = null
  let bestScore = 0
  for (const c of categories) {
    const name = normalizeName(c.name)
    // Singular/plural variants ("grocery" ↔ "Groceries") should compare as
    // equals, so score the stemmed forms too and keep the better result.
    const score = Math.max(
      nameScore(needle, name),
      nameScore(stemmedNeedle, stemName(name))
    )
    if (score > bestScore) {
      best = c
      bestScore = score
    }
  }
  return bestScore >= CLOSEST_CATEGORY_THRESHOLD ? best : null
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
  const matchedAccount = matchAccount(accounts, extracted.accountHint)
  let accountId: string | null = null
  let accountName: string | null = null
  let accountSource: ResolvedReferences['accountSource'] = null
  if (matchedAccount) {
    accountId = matchedAccount.id
    accountName = matchedAccount.name
    accountSource = 'hint'
  } else if (accounts.length === 1) {
    accountId = accounts[0].id
    accountName = accounts[0].name
    accountSource = 'default'
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
