import { describe, it, expect } from 'vitest'
import {
  closestCategory,
  matchAccount,
  rankAccountOptions,
  resolveReferences,
  toThirdPartyExpense,
} from '../resolve-references'
import type { ExtractedTransaction } from '../extract-transaction'
import {
  mockSupabase,
  opsFor,
  type Responder,
} from '../telegram/__tests__/mock-supabase'

const BASE: ExtractedTransaction = {
  amount: 3.75,
  currency: 'USD',
  merchant: 'The Coffee Cup',
  categoryHint: null,
  accountHint: null,
  date: null,
  dateAmbiguous: false,
  notes: null,
  direction: 'expense',
  confidence: 0.9,
}

function tables(data: {
  merchants?: unknown[]
  categories?: unknown[]
  accounts?: unknown[]
}): Responder {
  return op => {
    if (op.table === 'merchants') return { data: data.merchants ?? [] }
    if (op.table === 'categories') return { data: data.categories ?? [] }
    if (op.table === 'accounts') return { data: data.accounts ?? [] }
    return { data: [] }
  }
}

describe('resolveReferences', () => {
  it('matches a merchant without ever creating one', async () => {
    const { supabase, ops } = mockSupabase(
      tables({
        merchants: [{ id: 'm1', name: 'The Coffee Cup', default_category_id: null }],
        accounts: [{ id: 'a1', name: 'Cash', last_4_digits: null }],
      })
    )
    const ctx = await resolveReferences(supabase, 'u1', BASE)
    expect(ctx.resolved.merchantId).toBe('m1')
    expect(ctx.resolved.merchantName).toBe('The Coffee Cup')
    expect(opsFor(ops, 'merchants', 'insert')).toHaveLength(0)
  })

  it('returns a trimmed merchantName and null id when unmatched', async () => {
    const { supabase, ops } = mockSupabase(tables({}))
    const ctx = await resolveReferences(supabase, 'u1', {
      ...BASE,
      merchant: '  Blue Bottle  ',
    })
    expect(ctx.resolved.merchantId).toBeNull()
    expect(ctx.resolved.merchantName).toBe('Blue Bottle')
    expect(opsFor(ops, 'merchants', 'insert')).toHaveLength(0)
  })

  it('resolves category from the hint', async () => {
    const { supabase } = mockSupabase(
      tables({
        categories: [{ id: 'c1', name: 'Coffee', type: 'expense' }],
      })
    )
    const ctx = await resolveReferences(supabase, 'u1', {
      ...BASE,
      categoryHint: 'coffee',
    })
    expect(ctx.resolved.categoryId).toBe('c1')
    expect(ctx.resolved.categorySource).toBe('hint')
  })

  it('falls back to the matched merchant default category', async () => {
    const { supabase } = mockSupabase(
      tables({
        merchants: [
          { id: 'm1', name: 'The Coffee Cup', default_category_id: 'c9' },
        ],
        categories: [
          { id: 'c1', name: 'Groceries', type: 'expense' },
          { id: 'c9', name: 'Dining Out', type: 'expense' },
        ],
      })
    )
    const ctx = await resolveReferences(supabase, 'u1', BASE)
    expect(ctx.resolved.categoryId).toBe('c9')
    expect(ctx.resolved.categoryName).toBe('Dining Out')
    expect(ctx.resolved.categorySource).toBe('merchant_default')
  })

  it('leaves category null when hint and merchant default both miss', async () => {
    const { supabase } = mockSupabase(
      tables({
        categories: [{ id: 'c1', name: 'Groceries', type: 'expense' }],
      })
    )
    const ctx = await resolveReferences(supabase, 'u1', BASE)
    expect(ctx.resolved.categoryId).toBeNull()
    expect(ctx.resolved.categorySource).toBeNull()
  })

  it('uses a single account silently as default', async () => {
    const { supabase } = mockSupabase(
      tables({
        accounts: [{ id: 'a1', name: 'Cash', last_4_digits: null }],
      })
    )
    const ctx = await resolveReferences(supabase, 'u1', BASE)
    expect(ctx.resolved.accountId).toBe('a1')
    expect(ctx.resolved.accountSource).toBe('default')
  })

  it('leaves account unresolved with multiple accounts and no hint match', async () => {
    const { supabase } = mockSupabase(
      tables({
        accounts: [
          { id: 'a1', name: 'Cash', last_4_digits: null },
          { id: 'a2', name: 'BAC Visa', last_4_digits: '4521' },
        ],
      })
    )
    const ctx = await resolveReferences(supabase, 'u1', BASE)
    expect(ctx.resolved.accountId).toBeNull()
    expect(ctx.accounts).toHaveLength(2)
  })

  it('matches an account by last-4 digits in the hint', async () => {
    const { supabase } = mockSupabase(
      tables({
        accounts: [
          { id: 'a1', name: 'Cash', last_4_digits: null },
          { id: 'a2', name: 'BAC Visa', last_4_digits: '4521' },
        ],
      })
    )
    const ctx = await resolveReferences(supabase, 'u1', {
      ...BASE,
      accountHint: 'visa 4521',
    })
    expect(ctx.resolved.accountId).toBe('a2')
    expect(ctx.resolved.accountSource).toBe('hint')
  })

  it('orders accounts by created_at for a deterministic default', async () => {
    const { supabase, ops } = mockSupabase(tables({}))
    await resolveReferences(supabase, 'u1', BASE)
    const accountsOp = opsFor(ops, 'accounts')[0]
    expect(accountsOp.filters.order?.[0]?.[0]).toBe('created_at')
  })
})

describe('resolveReferences — transfers', () => {
  const TRANSFER: ExtractedTransaction = {
    ...BASE,
    merchant: null,
    direction: 'transfer',
    amount: 63806.68,
    currency: 'DOP',
    accountHint: 'Cuenta de Ahorros 828289652',
    toAccountHint: 'Tarjeta de crédito / 4857',
    toAmount: 1065.22,
    toCurrency: 'USD',
  }

  const TWO_ACCOUNTS = [
    { id: 'a-dop', name: 'Cuenta de Ahorros', last_4_digits: '9652' },
    { id: 'a-usd', name: 'Visa Infinite', last_4_digits: '4857' },
  ]

  it('resolves both legs via name and last-4 digits', async () => {
    const { supabase } = mockSupabase(tables({ accounts: TWO_ACCOUNTS }))
    const ctx = await resolveReferences(supabase, 'u1', TRANSFER)
    expect(ctx.resolved.accountId).toBe('a-dop')
    expect(ctx.resolved.toAccountId).toBe('a-usd')
    expect(ctx.resolved.toAccountName).toBe('Visa Infinite')
    expect(ctx.resolved.toAccountSource).toBe('hint')
  })

  it('never lets the destination collide with the resolved source', async () => {
    const { supabase } = mockSupabase(tables({ accounts: TWO_ACCOUNTS }))
    const ctx = await resolveReferences(supabase, 'u1', {
      ...TRANSFER,
      toAccountHint: 'cuenta de ahorros', // same account as the source hint
    })
    expect(ctx.resolved.accountId).toBe('a-dop')
    expect(ctx.resolved.toAccountId).toBeNull()
  })

  it('skips the single-account default for transfers', async () => {
    const { supabase } = mockSupabase(
      tables({ accounts: [{ id: 'a1', name: 'Cash', last_4_digits: null }] })
    )
    const ctx = await resolveReferences(supabase, 'u1', {
      ...TRANSFER,
      accountHint: null,
      toAccountHint: null,
    })
    expect(ctx.resolved.accountId).toBeNull()
    expect(ctx.resolved.toAccountId).toBeNull()
  })
})

describe('closestCategory', () => {
  const CATEGORIES = [
    { id: 'c1', name: 'Coffee' },
    { id: 'c2', name: 'Groceries' },
    { id: 'c3', name: 'Food & Dining' },
    { id: 'c4', name: 'Health & Wellness' },
    { id: 'c5', name: 'Café' },
  ]

  it('matches exactly, ignoring case and surrounding whitespace', () => {
    expect(closestCategory(CATEGORIES, '  groceries ')?.id).toBe('c2')
  })

  it('matches a singular/typo variant to the closest name', () => {
    expect(closestCategory(CATEGORIES, 'grocery')?.id).toBe('c2')
    expect(closestCategory(CATEGORIES, 'grocerys')?.id).toBe('c2')
  })

  it('matches a word inside a multi-word category', () => {
    expect(closestCategory(CATEGORIES, 'dining')?.id).toBe('c3')
    expect(closestCategory(CATEGORIES, 'food and dining')?.id).toBe('c3')
  })

  it('matches a typo against a single token of a multi-word name', () => {
    expect(closestCategory(CATEGORIES, 'helth')?.id).toBe('c4')
  })

  it('ignores accents in both directions', () => {
    expect(closestCategory(CATEGORIES, 'cafe')?.id).toBe('c5')
    expect(closestCategory([{ id: 'c9', name: 'Cafe' }], 'café')?.id).toBe('c9')
  })

  it('returns null when nothing is close', () => {
    expect(closestCategory(CATEGORIES, 'Pets')).toBeNull()
    expect(closestCategory([], 'Pets')).toBeNull()
  })

  it('does not let a tiny input substring-match into a longer name', () => {
    expect(closestCategory(CATEGORIES, 'co')).toBeNull()
  })

  it('returns null for empty or whitespace input', () => {
    expect(closestCategory(CATEGORIES, '   ')).toBeNull()
  })
})

describe('matchAccount — ledger-style names', () => {
  // Real-world shape: digits live only in the account NAME, last_4_digits is
  // null, and the bank screen masks the user's own account number.
  const LEDGER = [
    { id: 'pop-dop', name: 'Popular 9652 (DOP)', currency: 'DOP', type: 'checking' },
    { id: 'pop-usd', name: 'Popular 8471 (USD)', currency: 'USD', type: 'checking' },
    { id: 'bac-chk', name: 'BAC Checking XXXXX9114', currency: 'USD', type: 'checking' },
    { id: 'bac-sav', name: 'BAC Savings XXXXX5943', currency: 'USD', type: 'savings' },
    { id: 'visa-usd', name: 'VISA PLATINUM USD', currency: 'USD', type: 'credit_card' },
    { id: 'visa-dop', name: 'VISA PLATINUM DOP', currency: 'DOP', type: 'credit_card' },
    { id: 'wallet-usd', name: 'Wallet (USD)', currency: 'USD', type: 'wallet' },
    { id: 'wallet-dop', name: 'Wallet (DOP)', currency: 'DOP', type: 'wallet' },
  ]

  it('matches a masked bank-screen number against digits in the account name', () => {
    const m = matchAccount(LEDGER, 'Cuenta de ahorros *****9652')
    expect(m.best?.id).toBe('pop-dop')
    expect(m.strong).toBe(true)
  })

  it('treats the tail of an unmasked full account number as weak evidence', () => {
    const m = matchAccount(LEDGER, 'Cuenta De Ahorros 832238471')
    expect(m.best?.id).toBe('pop-usd')
    expect(m.strong).toBe(false)
  })

  it('matches by masked digits in the ledger name', () => {
    expect(matchAccount(LEDGER, 'BAC ****9114').best?.id).toBe('bac-chk')
  })

  it('uses an explicit currency to split twins', () => {
    expect(matchAccount(LEDGER, 'Visa Platinum RD$').best?.id).toBe('visa-dop')
    expect(matchAccount(LEDGER, 'wallet usd').best?.id).toBe('wallet-usd')
  })

  it('refuses to guess between equally likely accounts but suggests both', () => {
    const m = matchAccount(LEDGER, 'Visa Platinum')
    expect(m.best).toBeNull()
    expect(m.suggestions.map(s => s.id).sort()).toEqual(['visa-dop', 'visa-usd'])
  })

  it('returns nothing for an unrelated hint', () => {
    const m = matchAccount(LEDGER, 'Apple Pay')
    expect(m.best).toBeNull()
    expect(m.suggestions).toEqual([])
  })

  it('ranks suggestions first for the keyboard and flags them', () => {
    const m = matchAccount(LEDGER, 'Visa Platinum')
    const ranked = rankAccountOptions(LEDGER, m.suggestions)
    expect(ranked[0].suggested).toBe(true)
    expect(ranked[1].suggested).toBe(true)
    expect(ranked.slice(2).every(o => !o.suggested)).toBe(true)
    expect(ranked).toHaveLength(LEDGER.length)
  })
})

describe('resolveReferences — third-party payments read as transfers', () => {
  const LEDGER = [
    { id: 'pop-dop', name: 'Popular 9652 (DOP)', currency: 'DOP', type: 'checking' },
    { id: 'pop-usd', name: 'Popular 8471 (USD)', currency: 'USD', type: 'checking' },
  ]
  const RENT: ExtractedTransaction = {
    ...BASE,
    merchant: null,
    direction: 'transfer',
    amount: 89850,
    currency: 'DOP',
    accountHint: 'Cuenta de ahorros *****9652',
    toAccountHint: 'Cuenta De Ahorros 832238471',
    toAmount: 1500,
    toCurrency: 'USD',
    counterparty: 'Hubert Wiriath',
  }

  it('does not auto-resolve a destination from the tail of an unmasked number', async () => {
    const { supabase } = mockSupabase(tables({ accounts: LEDGER }))
    const ctx = await resolveReferences(supabase, 'u1', RENT)
    expect(ctx.resolved.accountId).toBe('pop-dop')
    expect(ctx.resolved.toAccountId).toBeNull()
    expect(ctx.toAccountStrong).toBe(false)
    // …but still surfaces the lookalike as the first suggestion.
    expect(ctx.toAccounts[0]).toMatchObject({ id: 'pop-usd', suggested: true })
  })

  it('still auto-resolves a destination from masked digits', async () => {
    const { supabase } = mockSupabase(tables({ accounts: LEDGER }))
    const ctx = await resolveReferences(supabase, 'u1', {
      ...RENT,
      toAccountHint: 'Cuenta de ahorros *****8471',
      counterparty: null,
    })
    expect(ctx.resolved.toAccountId).toBe('pop-usd')
    expect(ctx.toAccountStrong).toBe(true)
  })

  it('toThirdPartyExpense turns the transfer into an expense paid to the counterparty', () => {
    const expense = toThirdPartyExpense(RENT)
    expect(expense.direction).toBe('expense')
    expect(expense.merchant).toBe('Hubert Wiriath')
    expect(expense.toAccountHint).toBeNull()
    expect(expense.accountHint).toBe('Cuenta de ahorros *****9652')
    expect(expense.notes).toContain('832238471')
    // Cross-currency legs survive so confirm can pick the account's currency.
    expect(expense.amount).toBe(89850)
    expect(expense.toAmount).toBe(1500)
  })

  it('toThirdPartyExpense falls back to the merchant when no counterparty was named', () => {
    const expense = toThirdPartyExpense({ ...RENT, counterparty: null, merchant: 'Landlord' })
    expect(expense.merchant).toBe('Landlord')
  })
})
