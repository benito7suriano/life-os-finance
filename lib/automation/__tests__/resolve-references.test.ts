import { describe, it, expect } from 'vitest'
import { closestCategory, resolveReferences } from '../resolve-references'
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
