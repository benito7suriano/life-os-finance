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
