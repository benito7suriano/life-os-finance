import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { TelegramCallbackQuery } from '@/lib/telegram/client'
import type { ExtractedTransaction } from '../../extract-transaction'
import type { ResolvedReferences } from '../../resolve-references'
import type { PendingRow } from '../types'
import { mockSupabase, opsFor, type Op } from './mock-supabase'

vi.mock('@/lib/telegram/client', () => ({
  sendMessage: vi.fn(async () => ({ message_id: 42 })),
  editMessageText: vi.fn(async () => ({})),
  answerCallbackQuery: vi.fn(async () => ({})),
  downloadFile: vi.fn(),
}))

vi.mock('@/lib/finance/apply-balances', () => ({
  applyTransactionBalances: vi.fn(async () => {}),
}))

import { editMessageText, answerCallbackQuery } from '@/lib/telegram/client'
import { applyTransactionBalances } from '@/lib/finance/apply-balances'
import { handleCallback } from '../handle-callback'

const EXTRACTED: ExtractedTransaction = {
  amount: 3.75,
  currency: 'USD',
  merchant: 'The Coffee Cup',
  categoryHint: null,
  accountHint: null,
  date: '2026-08-10',
  dateAmbiguous: false,
  notes: null,
  direction: 'expense',
  confidence: 0.9,
}

const RESOLVED: ResolvedReferences = {
  merchantId: 'm1',
  merchantName: 'The Coffee Cup',
  categoryId: 'c1',
  categoryName: 'Coffee',
  categorySource: 'hint',
  accountId: 'a1',
  accountName: 'Cash',
  accountSource: 'default',
  notes: { merchantMatched: true, categoryMatched: true, accountMatched: false },
}

function cbQuery(data: string): TelegramCallbackQuery {
  return {
    id: 'cb1',
    from: { id: 1, is_bot: false, first_name: 'Beno' },
    message: {
      message_id: 7,
      chat: { id: 100, type: 'private' },
      date: 0,
    },
    data,
  }
}

function pendingRow(overrides: Partial<PendingRow> = {}): PendingRow {
  return {
    id: 'p1',
    user_id: 'u1',
    channel_id: 'ch1',
    telegram_chat_id: 100,
    telegram_message_id: 7,
    payload: {
      extracted: EXTRACTED,
      resolved: RESOLVED,
      direction: 'expense',
    },
    status: 'confirming',
    missing_fields: [],
    ...overrides,
  }
}

interface Fixture {
  pending?: PendingRow | null
  merchantCreateError?: { message: string }
  learnError?: { message: string }
  txError?: { message: string }
  categoryCreateError?: { message: string }
  categoryRematch?: { id: string } | null
}

function respondWith(fx: Fixture) {
  return (op: Op) => {
    if (op.table === 'pending_telegram_transactions') {
      if (op.action === 'select') return { data: fx.pending ?? null }
      return {}
    }
    if (op.table === 'accounts') return { data: { currency: 'USD' } }
    if (op.table === 'merchants') {
      if (op.action === 'insert') {
        return fx.merchantCreateError
          ? { data: null, error: fx.merchantCreateError }
          : { data: { id: 'm-new' } }
      }
      if (op.action === 'update') {
        return fx.learnError ? { error: fx.learnError } : {}
      }
      if (op.action === 'select') return { data: null }
      return {}
    }
    if (op.table === 'transactions') {
      if (op.action === 'insert') {
        return fx.txError ? { error: fx.txError } : {}
      }
      return { data: [] }
    }
    if (op.table === 'automation_channels') {
      if (op.action === 'select') return { data: { id: 'ch1', transactions_logged: 3 } }
      return {}
    }
    if (op.table === 'categories') {
      if (op.action === 'insert') {
        return fx.categoryCreateError
          ? { data: null, error: fx.categoryCreateError }
          : { data: { id: 'cat-new' } }
      }
      // ilike marks the race re-match lookup; other selects are list fetches.
      if (op.action === 'select' && op.filters.ilike) {
        return { data: fx.categoryRematch ?? null }
      }
      return { data: [] }
    }
    return { data: [] }
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('handleCallback — clarification buttons', () => {
  it('applies a valid category choice and promotes to the confirm card', async () => {
    const pending = pendingRow({
      status: 'clarifying',
      missing_fields: ['category'],
      payload: {
        extracted: EXTRACTED,
        resolved: { ...RESOLVED, categoryId: null, categoryName: null, categorySource: null },
        direction: 'expense',
        options: {
          categories: [
            { id: 'c1', name: 'Coffee' },
            { id: 'c2', name: 'Groceries' },
          ],
        },
      },
    })
    const { supabase, ops } = mockSupabase(respondWith({ pending }))

    await handleCallback(supabase, cbQuery('cc:p1:1'))

    const update = opsFor(ops, 'pending_telegram_transactions', 'update')[0]
    expect(update.values).toMatchObject({
      status: 'confirming',
      missing_fields: [],
    })
    const payload = update.values as {
      payload: { resolved: ResolvedReferences }
    }
    expect(payload.payload.resolved.categoryId).toBe('c2')
    expect(payload.payload.resolved.categorySource).toBe('user_choice')

    // Confirm card rendered with real Confirm/Cancel buttons.
    const [, , text, opts] = vi.mocked(editMessageText).mock.calls[0]
    expect(text).toContain('Confirm this transaction?')
    expect(opts!.keyboard![0][0].callback_data).toBe('c:p1')
  })

  it('rejects a stale category press with a toast and no state change', async () => {
    const pending = pendingRow({ status: 'confirming', missing_fields: [] })
    const { supabase, ops } = mockSupabase(respondWith({ pending }))

    await handleCallback(supabase, cbQuery('cc:p1:0'))

    expect(answerCallbackQuery).toHaveBeenCalledWith(
      'cb1',
      expect.stringContaining('stale')
    )
    expect(opsFor(ops, 'pending_telegram_transactions', 'update')).toHaveLength(0)
  })

  it('rejects an out-of-range option index', async () => {
    const pending = pendingRow({
      status: 'clarifying',
      missing_fields: ['category'],
      payload: {
        extracted: EXTRACTED,
        resolved: { ...RESOLVED, categoryId: null },
        direction: 'expense',
        options: { categories: [{ id: 'c1', name: 'Coffee' }] },
      },
    })
    const { supabase, ops } = mockSupabase(respondWith({ pending }))

    await handleCallback(supabase, cbQuery('cc:p1:5'))

    expect(answerCallbackQuery).toHaveBeenCalledWith(
      'cb1',
      expect.stringContaining('stale')
    )
    expect(opsFor(ops, 'pending_telegram_transactions', 'update')).toHaveLength(0)
  })

  it('sets today for cd:t', async () => {
    const pending = pendingRow({
      status: 'clarifying',
      missing_fields: ['date'],
      payload: {
        extracted: { ...EXTRACTED, dateAmbiguous: true },
        resolved: RESOLVED,
        direction: 'expense',
      },
    })
    const { supabase, ops } = mockSupabase(respondWith({ pending }))

    await handleCallback(supabase, cbQuery('cd:p1:t'))

    const update = opsFor(ops, 'pending_telegram_transactions', 'update')[0]
    const payload = update.values as {
      payload: { extracted: ExtractedTransaction }
    }
    expect(payload.payload.extracted.date).toBe(
      new Date().toISOString().slice(0, 10)
    )
    expect(payload.payload.extracted.dateAmbiguous).toBe(false)
  })

  it('rejects Confirm while still clarifying', async () => {
    const pending = pendingRow({
      status: 'clarifying',
      missing_fields: ['category'],
    })
    const { supabase, ops } = mockSupabase(respondWith({ pending }))

    await handleCallback(supabase, cbQuery('c:p1'))

    expect(answerCallbackQuery).toHaveBeenCalledWith(
      'cb1',
      expect.stringContaining('Still need more info')
    )
    expect(opsFor(ops, 'transactions', 'insert')).toHaveLength(0)
  })
})

describe('handleCallback — Other… category flow', () => {
  function clarifyingCategoryRow(): PendingRow {
    return pendingRow({
      status: 'clarifying',
      missing_fields: ['category'],
      payload: {
        extracted: EXTRACTED,
        resolved: {
          ...RESOLVED,
          categoryId: null,
          categoryName: null,
          categorySource: null,
        },
        direction: 'expense',
        options: {
          categories: [
            { id: 'c1', name: 'Coffee' },
            { id: 'c2', name: 'Groceries' },
          ],
        },
      },
    })
  }

  it('co switches the card to free-text mode and flags the payload', async () => {
    const pending = clarifyingCategoryRow()
    const { supabase, ops } = mockSupabase(respondWith({ pending }))

    await handleCallback(supabase, cbQuery('co:p1'))

    const update = opsFor(ops, 'pending_telegram_transactions', 'update')[0]
    const values = update.values as {
      payload: { awaitingCategoryText?: boolean }
      expires_at: string
    }
    expect(values.payload.awaitingCategoryText).toBe(true)
    expect(values.expires_at).toBeDefined()

    const [, , text, opts] = vi.mocked(editMessageText).mock.calls[0]
    expect(text).toContain('Reply with a name')
    expect(opts!.keyboard![0][0]).toEqual({
      text: '⬅️ Back to list',
      callback_data: 'cg:p1',
    })
    expect(opts!.keyboard![1][0].callback_data).toBe('x:p1')
  })

  it('rejects co when the category question is not active', async () => {
    const pending = pendingRow({ status: 'confirming', missing_fields: [] })
    const { supabase, ops } = mockSupabase(respondWith({ pending }))

    await handleCallback(supabase, cbQuery('co:p1'))

    expect(answerCallbackQuery).toHaveBeenCalledWith(
      'cb1',
      expect.stringContaining('stale')
    )
    expect(opsFor(ops, 'pending_telegram_transactions', 'update')).toHaveLength(0)
  })

  it('cg clears the flag and re-renders the category grid', async () => {
    const pending = clarifyingCategoryRow()
    pending.payload.awaitingCategoryText = true
    const { supabase, ops } = mockSupabase(respondWith({ pending }))

    await handleCallback(supabase, cbQuery('cg:p1'))

    const update = opsFor(ops, 'pending_telegram_transactions', 'update')[0]
    const values = update.values as { payload: { awaitingCategoryText?: boolean } }
    expect(values.payload.awaitingCategoryText).toBeUndefined()

    const gridEdit = vi
      .mocked(editMessageText)
      .mock.calls.find(c => (c[2] as string).includes('Pick a category'))
    expect(gridEdit).toBeDefined()
    expect(gridEdit![3]!.keyboard![0][0].callback_data).toBe('cc:p1:0')
  })
})

describe('handleCallback — confirm', () => {
  it('creates the merchant when unmatched and saves the transaction', async () => {
    const pending = pendingRow({
      payload: {
        extracted: EXTRACTED,
        resolved: { ...RESOLVED, merchantId: null },
        direction: 'expense',
      },
    })
    const { supabase, ops } = mockSupabase(respondWith({ pending }))

    await handleCallback(supabase, cbQuery('c:p1'))

    const merchantInsert = opsFor(ops, 'merchants', 'insert')[0]
    expect(merchantInsert.values).toMatchObject({
      user_id: 'u1',
      name: 'The Coffee Cup',
    })
    const txInsert = opsFor(ops, 'transactions', 'insert')[0]
    expect(txInsert.values).toMatchObject({
      merchant_id: 'm-new',
      category_id: 'c1',
      amount: 3.75,
      from_account_id: 'a1',
      source: 'telegram',
    })
    expect(applyTransactionBalances).toHaveBeenCalledTimes(1)
  })

  it('creates a brand-new category at confirm time and uses it everywhere', async () => {
    const pending = pendingRow({
      payload: {
        extracted: EXTRACTED,
        resolved: {
          ...RESOLVED,
          categoryId: null,
          categoryName: 'Pets',
          categorySource: 'user_new',
        },
        direction: 'expense',
      },
    })
    const { supabase, ops } = mockSupabase(respondWith({ pending }))

    await handleCallback(supabase, cbQuery('c:p1'))

    const catInsert = opsFor(ops, 'categories', 'insert')[0]
    expect(catInsert.values).toMatchObject({
      user_id: 'u1',
      name: 'Pets',
      type: 'expense',
      is_system: false,
    })
    const txInsert = opsFor(ops, 'transactions', 'insert')[0]
    expect(txInsert.values).toMatchObject({ category_id: 'cat-new' })
    // Merchant learning uses the freshly created id.
    const learn = opsFor(ops, 'merchants', 'update')[0]
    expect(learn.values).toMatchObject({ default_category_id: 'cat-new' })
    const savedEdit = vi
      .mocked(editMessageText)
      .mock.calls.find(c => (c[2] as string).includes('✅ Saved.'))
    expect(savedEdit).toBeDefined()
  })

  it('falls back to a race re-match when the category insert fails', async () => {
    const pending = pendingRow({
      payload: {
        extracted: EXTRACTED,
        resolved: {
          ...RESOLVED,
          categoryId: null,
          categoryName: 'Pets',
          categorySource: 'user_new',
        },
        direction: 'expense',
      },
    })
    const { supabase, ops } = mockSupabase(
      respondWith({
        pending,
        categoryCreateError: { message: 'duplicate key' },
        categoryRematch: { id: 'cat-race' },
      })
    )

    await handleCallback(supabase, cbQuery('c:p1'))

    const txInsert = opsFor(ops, 'transactions', 'insert')[0]
    expect(txInsert.values).toMatchObject({ category_id: 'cat-race' })
  })

  it('writes the confirmed category back as the merchant default', async () => {
    const pending = pendingRow()
    const { supabase, ops } = mockSupabase(respondWith({ pending }))

    await handleCallback(supabase, cbQuery('c:p1'))

    const learn = opsFor(ops, 'merchants', 'update')[0]
    expect(learn.values).toMatchObject({ default_category_id: 'c1' })
    expect(learn.filters.eq).toContainEqual(['id', 'm1'])
  })

  it('still reports Saved when merchant learning fails', async () => {
    const pending = pendingRow()
    const { supabase } = mockSupabase(
      respondWith({ pending, learnError: { message: 'rls' } })
    )

    await handleCallback(supabase, cbQuery('c:p1'))

    const savedEdit = vi
      .mocked(editMessageText)
      .mock.calls.find(c => (c[2] as string).includes('✅ Saved.'))
    expect(savedEdit).toBeDefined()
  })

  it('confirms a legacy payload without merchantName or sources', async () => {
    const legacyResolved = {
      merchantId: 'm1',
      categoryId: 'c1',
      accountId: 'a1',
      notes: { merchantCreated: false, categoryMatched: true, accountMatched: true },
    } as unknown as ResolvedReferences
    const pending = pendingRow({
      payload: { extracted: EXTRACTED, resolved: legacyResolved, direction: 'expense' },
    })
    const { supabase, ops } = mockSupabase(respondWith({ pending }))

    await handleCallback(supabase, cbQuery('c:p1'))

    const txInsert = opsFor(ops, 'transactions', 'insert')[0]
    expect(txInsert.values).toMatchObject({
      description: 'The Coffee Cup', // falls back to extracted.merchant
      merchant_id: 'm1',
    })
    const savedEdit = vi
      .mocked(editMessageText)
      .mock.calls.find(c => (c[2] as string).includes('✅ Saved.'))
    expect(savedEdit).toBeDefined()
  })

  it('cancels from any state', async () => {
    const pending = pendingRow({ status: 'clarifying', missing_fields: ['amount'] })
    const { supabase, ops } = mockSupabase(respondWith({ pending }))

    await handleCallback(supabase, cbQuery('x:p1'))

    const deletes = opsFor(ops, 'pending_telegram_transactions', 'delete')
    expect(deletes.some(d => d.filters.eq?.some(a => a[1] === 'p1'))).toBe(true)
    expect(vi.mocked(editMessageText).mock.calls[0][2]).toContain('Cancelled')
  })

  it('shows the expired message when the pending row is gone', async () => {
    const { supabase } = mockSupabase(respondWith({ pending: null }))

    await handleCallback(supabase, cbQuery('c:p1'))

    expect(vi.mocked(editMessageText).mock.calls[0][2]).toContain(
      'no longer available'
    )
  })
})

describe('handleCallback — transfers', () => {
  const TRANSFER_EXTRACTED: ExtractedTransaction = {
    amount: 63806.68,
    currency: 'DOP',
    merchant: null,
    categoryHint: null,
    accountHint: 'Cuenta de Ahorros 828289652',
    date: '2026-08-22',
    dateAmbiguous: false,
    notes: null,
    direction: 'transfer',
    confidence: 0.9,
    toAccountHint: 'Tarjeta de crédito / 4857',
    toAmount: 1065.22,
    toCurrency: 'USD',
  }

  const TRANSFER_RESOLVED: ResolvedReferences = {
    merchantId: null,
    merchantName: null,
    categoryId: null,
    categoryName: null,
    categorySource: null,
    accountId: 'a-dop',
    accountName: 'Cuenta de Ahorros',
    accountSource: 'hint',
    toAccountId: 'a-usd',
    toAccountName: 'Visa Infinite',
    toAccountSource: 'hint',
    notes: { merchantMatched: false, categoryMatched: false, accountMatched: true },
  }

  function transferPending(overrides: Partial<PendingRow> = {}): PendingRow {
    return pendingRow({
      payload: {
        extracted: TRANSFER_EXTRACTED,
        resolved: TRANSFER_RESOLVED,
        direction: 'transfer',
      },
      ...overrides,
    })
  }

  /** accounts.currency lookups answer per queried id. */
  function transferResponder(fx: { pending: PendingRow; txError?: { message: string } }) {
    return (op: Op) => {
      if (op.table === 'accounts') {
        const id = op.filters.eq?.find(args => args[0] === 'id')?.[1]
        return { data: { currency: id === 'a-dop' ? 'DOP' : 'USD' } }
      }
      return respondWith({ pending: fx.pending, txError: fx.txError })(op)
    }
  }

  it('confirm inserts one cross-currency transfer row and applies both legs', async () => {
    const pending = transferPending()
    const { supabase, ops } = mockSupabase(transferResponder({ pending }))

    await handleCallback(supabase, cbQuery('c:p1'))

    const insert = opsFor(ops, 'transactions', 'insert')[0]
    expect(insert.values).toMatchObject({
      type: 'transfer',
      amount: 63806.68,
      currency: 'DOP',
      to_amount: 1065.22,
      to_currency: 'USD',
      from_account_id: 'a-dop',
      to_account_id: 'a-usd',
      date: '2026-08-22',
      source: 'telegram',
      source_app: 'telegram-bot',
    })
    expect((insert.values as Record<string, unknown>).category_id).toBeUndefined()

    // No merchant creation or learning for transfers.
    expect(opsFor(ops, 'merchants', 'insert')).toHaveLength(0)
    expect(opsFor(ops, 'merchants', 'update')).toHaveLength(0)

    expect(applyTransactionBalances).toHaveBeenCalledWith(
      supabase,
      {
        type: 'transfer',
        amount: 63806.68,
        toAmount: 1065.22,
        fromAccountId: 'a-dop',
        toAccountId: 'a-usd',
      },
      1
    )

    const finalText = vi.mocked(editMessageText).mock.calls.at(-1)?.[2] as string
    expect(finalText).toContain('✅ Saved.')
    expect(finalText).toContain('63,806.68 DOP → $1,065.22')
  })

  it('confirm swaps the legs when the extractor read them backwards', async () => {
    const pending = transferPending()
    pending.payload.extracted = {
      ...TRANSFER_EXTRACTED,
      amount: 1065.22,
      currency: 'USD',
      toAmount: 63806.68,
      toCurrency: 'DOP',
    }
    const { supabase, ops } = mockSupabase(transferResponder({ pending }))

    await handleCallback(supabase, cbQuery('c:p1'))

    const insert = opsFor(ops, 'transactions', 'insert')[0]
    expect(insert.values).toMatchObject({
      amount: 63806.68,
      currency: 'DOP',
      to_amount: 1065.22,
      to_currency: 'USD',
    })
  })

  it('confirm refuses a transfer whose destination is unresolved', async () => {
    const pending = transferPending()
    pending.payload.resolved = { ...TRANSFER_RESOLVED, toAccountId: null }
    const { supabase, ops } = mockSupabase(transferResponder({ pending }))

    await handleCallback(supabase, cbQuery('c:p1'))

    expect(opsFor(ops, 'transactions', 'insert')).toHaveLength(0)
    const text = vi.mocked(editMessageText).mock.calls.at(-1)?.[2] as string
    expect(text).toContain('two different accounts')
  })

  it('ct button applies the destination account choice', async () => {
    const pending = transferPending({
      status: 'clarifying',
      missing_fields: ['to_account'],
    })
    pending.payload.resolved = { ...TRANSFER_RESOLVED, toAccountId: null, toAccountName: null, toAccountSource: null }
    pending.payload.options = {
      accounts: [
        { id: 'a-dop', name: 'Cuenta de Ahorros' },
        { id: 'a-usd', name: 'Visa Infinite' },
      ],
    }
    const { supabase, ops } = mockSupabase(transferResponder({ pending }))

    await handleCallback(supabase, cbQuery('ct:p1:1'))

    const update = opsFor(ops, 'pending_telegram_transactions', 'update')[0]
    const values = update.values as {
      status: string
      payload: { resolved: ResolvedReferences }
    }
    expect(values.status).toBe('confirming')
    expect(values.payload.resolved.toAccountId).toBe('a-usd')
    expect(values.payload.resolved.toAccountSource).toBe('user_choice')
  })

  it('ct button rejects picking the source account as the destination', async () => {
    const pending = transferPending({
      status: 'clarifying',
      missing_fields: ['to_account'],
    })
    pending.payload.resolved = { ...TRANSFER_RESOLVED, toAccountId: null }
    pending.payload.options = {
      accounts: [
        { id: 'a-dop', name: 'Cuenta de Ahorros' },
        { id: 'a-usd', name: 'Visa Infinite' },
      ],
    }
    const { supabase, ops } = mockSupabase(transferResponder({ pending }))

    await handleCallback(supabase, cbQuery('ct:p1:0'))

    expect(vi.mocked(answerCallbackQuery)).toHaveBeenCalledWith(
      'cb1',
      expect.stringContaining('source account')
    )
    expect(opsFor(ops, 'pending_telegram_transactions', 'update')).toHaveLength(0)
  })
})

describe('handleCallback — changing pre-selected accounts', () => {
  const LEDGER = [
    { id: 'a-dop', name: 'Cuenta de Ahorros', last_4_digits: '9652', currency: 'DOP' },
    { id: 'a-usd', name: 'Visa Infinite', last_4_digits: '4857', currency: 'USD' },
    { id: 'a-cash', name: 'Cash', last_4_digits: null, currency: 'USD' },
  ]
  const TRANSFER_EXTRACTED: ExtractedTransaction = {
    amount: 63806.68,
    currency: 'DOP',
    merchant: null,
    categoryHint: null,
    accountHint: 'Cuenta de Ahorros 828289652',
    date: '2026-08-22',
    dateAmbiguous: false,
    notes: null,
    direction: 'transfer',
    confidence: 0.9,
    toAccountHint: 'Tarjeta de crédito / 4857',
    toAmount: 1065.22,
    toCurrency: 'USD',
  }
  const TRANSFER_RESOLVED: ResolvedReferences = {
    merchantId: null,
    merchantName: null,
    categoryId: null,
    categoryName: null,
    categorySource: null,
    accountId: 'a-dop',
    accountName: 'Cuenta de Ahorros',
    accountSource: 'hint',
    toAccountId: 'a-usd',
    toAccountName: 'Visa Infinite',
    toAccountSource: 'hint',
    notes: { merchantMatched: false, categoryMatched: false, accountMatched: true },
  }

  function responder(fx: Fixture) {
    return (op: Op) => {
      if (op.table === 'accounts') {
        // Per-id currency lookups (confirm) vs list fetches (resolve).
        const id = op.filters.eq?.find(args => args[0] === 'id')?.[1]
        if (id) return { data: { currency: id === 'a-dop' ? 'DOP' : 'USD' } }
        return { data: LEDGER }
      }
      if (op.table === 'categories' && op.action === 'select' && !op.filters.ilike) {
        return { data: [{ id: 'c-rent', name: 'Rent', type: 'expense' }] }
      }
      return respondWith(fx)(op)
    }
  }

  it('et reopens the destination question from the confirm card with a ranked list', async () => {
    const pending = pendingRow({
      payload: {
        extracted: TRANSFER_EXTRACTED,
        resolved: TRANSFER_RESOLVED,
        direction: 'transfer',
      },
    })
    const { supabase, ops } = mockSupabase(responder({ pending }))

    await handleCallback(supabase, cbQuery('et:p1'))

    const update = opsFor(ops, 'pending_telegram_transactions', 'update')[0]
    const values = update.values as {
      status: string
      missing_fields: string[]
      payload: { resolved: ResolvedReferences }
    }
    expect(values.status).toBe('clarifying')
    expect(values.missing_fields).toEqual(['to_account'])
    expect(values.payload.resolved.toAccountId).toBeNull()
    // Source stays untouched.
    expect(values.payload.resolved.accountId).toBe('a-dop')

    const [, , text, opts] = vi.mocked(editMessageText).mock.calls.at(-1)!
    expect(text).toContain('To which account?')
    expect(opts!.keyboard![0][0].text).toBe('⭐ Visa Infinite')
    expect(opts!.keyboard![0][0].callback_data).toBe('ct:p1:0')
  })

  it('ea reopens the account question on an expense card', async () => {
    const pending = pendingRow()
    const { supabase, ops } = mockSupabase(responder({ pending }))

    await handleCallback(supabase, cbQuery('ea:p1'))

    const update = opsFor(ops, 'pending_telegram_transactions', 'update')[0]
    expect(update.values).toMatchObject({ status: 'clarifying', missing_fields: ['account'] })
    const [, , text] = vi.mocked(editMessageText).mock.calls.at(-1)!
    expect(text).toContain('Which account?')
  })

  it('et is rejected on a non-transfer card', async () => {
    const pending = pendingRow()
    const { supabase, ops } = mockSupabase(responder({ pending }))

    await handleCallback(supabase, cbQuery('et:p1'))

    expect(vi.mocked(answerCallbackQuery)).toHaveBeenCalledWith('cb1', expect.stringContaining('stale'))
    expect(opsFor(ops, 'pending_telegram_transactions', 'update')).toHaveLength(0)
  })

  it('ca rejects picking the destination as the source of a transfer', async () => {
    const pending = pendingRow({
      status: 'clarifying',
      missing_fields: ['account'],
      payload: {
        extracted: TRANSFER_EXTRACTED,
        resolved: { ...TRANSFER_RESOLVED, accountId: null, accountName: null, accountSource: null },
        direction: 'transfer',
        options: { accounts: LEDGER.map(({ id, name }) => ({ id, name })) },
      },
    })
    const { supabase, ops } = mockSupabase(responder({ pending }))

    await handleCallback(supabase, cbQuery('ca:p1:1'))

    expect(vi.mocked(answerCallbackQuery)).toHaveBeenCalledWith(
      'cb1',
      expect.stringContaining('destination account')
    )
    expect(opsFor(ops, 'pending_telegram_transactions', 'update')).toHaveLength(0)
  })

  it('cp turns the transfer into an expense paid to the counterparty', async () => {
    const pending = pendingRow({
      status: 'clarifying',
      missing_fields: ['to_account'],
      payload: {
        extracted: {
          ...TRANSFER_EXTRACTED,
          toAccountHint: 'Cuenta De Ahorros 832238471',
          counterparty: 'Hubert Wiriath',
          categoryHint: 'Rent',
        },
        resolved: { ...TRANSFER_RESOLVED, toAccountId: null, toAccountName: null, toAccountSource: null },
        direction: 'transfer',
        options: { toAccounts: LEDGER.map(({ id, name }) => ({ id, name })) },
      },
    })
    const { supabase, ops } = mockSupabase(responder({ pending }))

    await handleCallback(supabase, cbQuery('cp:p1'))

    const update = opsFor(ops, 'pending_telegram_transactions', 'update')[0]
    const values = update.values as {
      status: string
      payload: { direction: string; resolved: ResolvedReferences; extracted: ExtractedTransaction }
    }
    expect(values.status).toBe('confirming')
    expect(values.payload.direction).toBe('expense')
    expect(values.payload.resolved.merchantName).toBe('Hubert Wiriath')
    expect(values.payload.resolved.categoryName).toBe('Rent')
    expect(values.payload.resolved.accountId).toBe('a-dop')
    expect(values.payload.extracted.toAccountHint).toBeNull()

    const [, , text] = vi.mocked(editMessageText).mock.calls.at(-1)!
    expect(text).toContain('Confirm this transaction?')
    expect(text).toContain('Merchant: Hubert Wiriath (new)')
  })

  it('cp is rejected outside the destination question', async () => {
    const pending = pendingRow()
    const { supabase, ops } = mockSupabase(responder({ pending }))

    await handleCallback(supabase, cbQuery('cp:p1'))

    expect(vi.mocked(answerCallbackQuery)).toHaveBeenCalledWith('cb1', expect.stringContaining('stale'))
    expect(opsFor(ops, 'pending_telegram_transactions', 'update')).toHaveLength(0)
  })

  it('confirm books a two-currency payment in the account currency', async () => {
    const pending = pendingRow({
      payload: {
        extracted: {
          ...EXTRACTED,
          merchant: 'Hubert Wiriath',
          amount: 1500,
          currency: 'USD',
          toAmount: 89850,
          toCurrency: 'DOP',
        },
        resolved: { ...RESOLVED, accountId: 'a-dop', accountName: 'Cuenta de Ahorros', accountSource: 'hint' },
        direction: 'expense',
      },
    })
    const { supabase, ops } = mockSupabase(responder({ pending }))

    await handleCallback(supabase, cbQuery('c:p1'))

    const insert = opsFor(ops, 'transactions', 'insert')[0]
    expect(insert.values).toMatchObject({
      type: 'expense',
      amount: 89850,
      currency: 'DOP',
      from_account_id: 'a-dop',
    })
    expect(applyTransactionBalances).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({ type: 'expense', amount: 89850, fromAccountId: 'a-dop' }),
      1
    )
    const finalText = vi.mocked(editMessageText).mock.calls.at(-1)?.[2] as string
    expect(finalText).toContain('✅ Saved.')
    expect(finalText).toContain('Expense: 89,850.00 DOP')
    expect(finalText).not.toContain('$1,500.00')
  })
})
