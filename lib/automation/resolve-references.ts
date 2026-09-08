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
  /** Ranked account lists flag the matcher's best guesses so the keyboard can
   *  surface them first. Frozen into the pending payload with the list. */
  suggested?: boolean
}

export interface ResolutionContext {
  resolved: ResolvedReferences
  /** Direction-filtered, name-ordered — used to build clarification keyboards. */
  categories: OptionItem[]
  /** Ranked for the SOURCE account question: best guesses for the account
   *  hint first (flagged `suggested`), then the rest in created_at order. */
  accounts: OptionItem[]
  /** Ranked for the DESTINATION account question (transfers). */
  toAccounts: OptionItem[]
  /** True when the destination resolved from strong evidence (exact name,
   *  masked or standalone last-4 digits) rather than the tail of an unmasked
   *  full account number — the latter is how a third party's account can
   *  collide with the user's own. */
  toAccountStrong: boolean
}

interface NamedRow {
  id: string
  name: string
}

interface MerchantRow extends NamedRow {
  default_category_id?: string | null
}

export interface AccountRow extends NamedRow {
  last_4_digits?: string | null
  account_number?: string | null
  currency?: string | null
  type?: string | null
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

// ---------------------------------------------------------------------------
// Account matching
//
// Bank screens describe accounts loosely ("Cuenta de ahorros *****9652",
// "Tarjeta de crédito / 4857", "Visa Gold USD") while the ledger names them
// however the user likes ("Popular 9652 (DOP)", "BAC Checking XXXXX9114").
// Each account is scored against the hint on digits, name tokens, currency
// and type; the unique top scorer above the threshold resolves, everything
// above it is surfaced as a suggestion.

/** Digits that appear after a masking run: "*****9652", "XXXX3782", "•••• 1234". */
const MASKED_TAIL = /[*xX•●#]+\s*-?\s*(\d{4})(?!\d)/g
/** A standalone 4-digit group: "visa 4521", "/ 4857". */
const STANDALONE_FOUR = /(?<![\d*xX•●#])(\d{4})(?!\d)/g
/** An unmasked run of 5+ digits — a full account number. */
const LONG_NUMBER = /(?<![\d*xX•●#])(\d{5,})(?!\d)/g

const STRONG_DIGITS = 10
const WEAK_DIGITS = 6
const FULL_NUMBER = 12
/** Minimum score for a hint to resolve or be suggested. */
const ACCOUNT_MATCH_THRESHOLD = 3

const NAME_STOPWORDS = new Set([
  'cuenta', 'account', 'acct', 'the', 'del', 'las', 'los', 'mi', 'my',
  'tarjeta', 'card', 'banco', 'bank', 'number', 'numero', 'num', 'no',
])

const CURRENCY_WORDS: Array<[RegExp, string]> = [
  [/\b(usd|us\$|d[oó]lares?|dollars?)\b|us\$/i, 'USD'],
  [/\b(dop|rd\$|pesos?)\b|rd\$/i, 'DOP'],
  [/\b(eur|euros?)\b|€/i, 'EUR'],
]

const TYPE_WORDS: Array<[RegExp, string]> = [
  [/ahorros?|savings?/i, 'savings'],
  [/corriente|checking|cheques?/i, 'checking'],
  [/cr[eé]dito|credit|visa|amex|mastercard|tarjeta|card/i, 'credit_card'],
  [/efectivo|cash|wallet|billetera/i, 'wallet'],
  [/pr[eé]stamo|loan/i, 'loan'],
]

interface DigitToken {
  tail: string
  full: string
  strong: boolean
}

function digitTokens(hint: string): DigitToken[] {
  const tokens: DigitToken[] = []
  for (const m of hint.matchAll(MASKED_TAIL)) {
    tokens.push({ tail: m[1], full: m[1], strong: true })
  }
  for (const m of hint.matchAll(STANDALONE_FOUR)) {
    tokens.push({ tail: m[1], full: m[1], strong: true })
  }
  for (const m of hint.matchAll(LONG_NUMBER)) {
    tokens.push({ tail: m[1].slice(-4), full: m[1], strong: false })
  }
  return tokens
}

/** Every 4-digit identifier the ledger knows for an account. */
function accountDigitIds(row: AccountRow): Set<string> {
  const ids = new Set<string>()
  if (row.last_4_digits) ids.add(row.last_4_digits.slice(-4))
  if (row.account_number) ids.add(row.account_number.replace(/\D/g, '').slice(-4))
  for (const run of row.name.match(/\d{4,}/g) ?? []) ids.add(run.slice(-4))
  ids.delete('')
  return ids
}

function nameTokens(s: string): string[] {
  return normalizeName(s)
    .split(/[^a-z0-9]+/)
    .filter(t => t.length >= 3 && !/^\d+$/.test(t) && !NAME_STOPWORDS.has(t))
}

function currencyMentioned(hint: string): string | null {
  for (const [re, code] of CURRENCY_WORDS) if (re.test(hint)) return code
  return null
}

function typeMentioned(hint: string): string | null {
  for (const [re, type] of TYPE_WORDS) if (re.test(hint)) return type
  return null
}

interface AccountScore {
  row: AccountRow
  score: number
  strong: boolean
}

function scoreAccount(row: AccountRow, hint: string): AccountScore {
  let score = 0
  let strong = false

  // Digits.
  const ids = accountDigitIds(row)
  const accountNumber = row.account_number?.replace(/\D/g, '') ?? null
  for (const tok of digitTokens(hint)) {
    if (accountNumber && tok.full === accountNumber) {
      score = Math.max(score, FULL_NUMBER)
      strong = true
    } else if (ids.has(tok.tail)) {
      score = Math.max(score, tok.strong ? STRONG_DIGITS : WEAK_DIGITS)
      strong = strong || tok.strong
    }
  }

  // Name.
  const name = normalizeName(row.name)
  const needle = normalizeName(hint)
  if (name && name === needle) {
    score += 8
    strong = true
  } else if (name.length >= 3 && needle.includes(name)) {
    score += 6
    strong = true
  } else if (needle.length >= 3 && name.includes(needle)) {
    score += 5
    strong = true
  } else {
    const rowTokens = new Set(nameTokens(row.name))
    for (const t of nameTokens(hint)) if (rowTokens.has(t)) score += 3
  }

  // Currency: an explicit mention is decisive between twins ("Wallet (USD)"
  // vs "Wallet (DOP)") and rules out cross-currency lookalikes.
  const currency = currencyMentioned(hint)
  if (currency && row.currency) {
    score += currency === row.currency.toUpperCase() ? 2 : -3
  }

  // Type: weak bonus only — banks and the ledger disagree on labels
  // ("Cuenta de ahorros" may well be a checking account in the ledger).
  const type = typeMentioned(hint)
  if (type && row.type === type) score += 1

  return { row, score, strong }
}

export interface AccountMatch {
  /** Unique top scorer above the threshold, or null (no match / ambiguous). */
  best: AccountRow | null
  /** True when `best` resolved from strong evidence (see ResolutionContext). */
  strong: boolean
  /** All candidates above the threshold, best first. */
  suggestions: AccountRow[]
}

/**
 * Scores every account against a free-text hint. Resolves to the unique top
 * scorer; two accounts tied at the top (e.g. sharing last-4 digits) resolve to
 * nothing and are both suggested so the user picks.
 */
export function matchAccount(rows: AccountRow[], hint: string | null): AccountMatch {
  const trimmed = hint?.trim() ?? ''
  if (!trimmed) return { best: null, strong: false, suggestions: [] }

  const scored = rows
    .map(r => scoreAccount(r, trimmed))
    .filter(s => s.score >= ACCOUNT_MATCH_THRESHOLD)
    .sort((a, b) => b.score - a.score)

  const suggestions = scored.map(s => s.row)
  if (scored.length === 0) return { best: null, strong: false, suggestions }
  if (scored.length > 1 && scored[0].score === scored[1].score) {
    return { best: null, strong: false, suggestions }
  }
  return { best: scored[0].row, strong: scored[0].strong, suggestions }
}

/**
 * Orders accounts for a keyboard: suggestions first (flagged), then the rest
 * in their original order.
 */
export function rankAccountOptions(
  rows: AccountRow[],
  suggestions: AccountRow[]
): OptionItem[] {
  const suggestedIds = new Set(suggestions.map(s => s.id))
  const head = suggestions.map(({ id, name }) => ({ id, name, suggested: true }))
  const tail = rows
    .filter(r => !suggestedIds.has(r.id))
    .map(({ id, name }) => ({ id, name }))
  return [...head, ...tail]
}

/**
 * Re-frames a "transfer" the extractor read off a payment screen as what it
 * is when the money is going to somebody else: an expense paid to the
 * counterparty from the source account. The destination account number is
 * kept in the notes for the record.
 */
export function toThirdPartyExpense(
  extracted: ExtractedTransaction
): ExtractedTransaction {
  const payee = extracted.counterparty?.trim() || extracted.merchant?.trim() || null
  const destination = extracted.toAccountHint?.trim() || null
  const notes = [extracted.notes?.trim() || null, destination ? `To: ${destination}` : null]
    .filter((n): n is string => !!n && !(extracted.notes ?? '').includes(n))
  return {
    ...extracted,
    direction: 'expense',
    merchant: payee,
    counterparty: payee,
    toAccountHint: null,
    notes: notes.length > 0 ? notes.join(' · ') : null,
  }
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

/** Columns the account matcher needs. */
export const ACCOUNT_MATCH_COLUMNS =
  'id, name, last_4_digits, account_number, currency, type'

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
      .select(ACCOUNT_MATCH_COLUMNS)
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
  const fromMatch = matchAccount(accounts, extracted.accountHint)
  const matchedAccount = fromMatch.best
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
  // Only STRONG evidence resolves the destination: the tail of an unmasked
  // full account number is exactly how somebody else's account collides with
  // one of the user's own, so that stays a suggestion for the user to confirm.
  let toAccountId: string | null = null
  let toAccountName: string | null = null
  let toAccountSource: ResolvedReferences['toAccountSource'] = null
  let toAccountStrong = false
  let toSuggestions: AccountRow[] = []
  if (extracted.direction === 'transfer') {
    const toMatch = matchAccount(accounts, extracted.toAccountHint ?? null)
    toSuggestions = toMatch.suggestions.filter(s => s.id !== accountId)
    const matchedTo = toMatch.best
    if (matchedTo && matchedTo.id !== accountId && toMatch.strong) {
      toAccountId = matchedTo.id
      toAccountName = matchedTo.name
      toAccountSource = 'hint'
      toAccountStrong = true
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
    accounts: rankAccountOptions(accounts, fromMatch.suggestions),
    toAccounts: rankAccountOptions(accounts, toSuggestions),
    toAccountStrong,
  }
}
