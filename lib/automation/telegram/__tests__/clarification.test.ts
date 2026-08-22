import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  computeMissingFields,
  rankCategoriesForKeyboard,
  askNextQuestion,
  MAX_CATEGORY_BUTTONS,
} from '../clarification'
import type { ExtractedTransaction } from '../../extract-transaction'
import type { ResolvedReferences } from '../../resolve-references'
import type { PendingRow } from '../types'
import { mockSupabase, opsFor } from './mock-supabase'

vi.mock('@/lib/telegram/client', () => ({
  sendMessage: vi.fn(async () => ({ message_id: 1 })),
  editMessageText: vi.fn(async () => ({})),
  answerCallbackQuery: vi.fn(async () => ({})),
  downloadFile: vi.fn(),
}))

import { editMessageText } from '@/lib/telegram/client'

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

describe('computeMissingFields', () => {
  const counts = { categories: 5, accounts: 2 }

  it('returns nothing when everything is resolved', () => {
    expect(computeMissingFields(EXTRACTED, RESOLVED, counts)).toEqual([])
  })

  it('orders missing fields amount → merchant → category → account → date', () => {
    const extracted = { ...EXTRACTED, amount: null, dateAmbiguous: true }
    const resolved = {
      ...RESOLVED,
      merchantName: null,
      categoryId: null,
      accountId: null,
    }
    expect(computeMissingFields(extracted, resolved, counts)).toEqual([
      'amount',
      'merchant',
      'category',
      'account',
      'date',
    ])
  })

  it('skips category when the user has no categories', () => {
    const resolved = { ...RESOLVED, categoryId: null }
    expect(
      computeMissingFields(EXTRACTED, resolved, { categories: 0, accounts: 2 })
    ).toEqual([])
  })

  it('does not ask for account when only one exists', () => {
    const resolved = { ...RESOLVED, accountId: null }
    expect(
      computeMissingFields(EXTRACTED, resolved, { categories: 5, accounts: 1 })
    ).toEqual([])
  })

  it('asks for date only when the extractor flagged ambiguity', () => {
    expect(
      computeMissingFields({ ...EXTRACTED, date: null }, RESOLVED, counts)
    ).toEqual([])
    expect(
      computeMissingFields(
        { ...EXTRACTED, dateAmbiguous: true },
        RESOLVED,
        counts
      )
    ).toEqual(['date'])
  })
})

describe('rankCategoriesForKeyboard', () => {
  it('returns the list untouched when under the cap', async () => {
    const { supabase, ops } = mockSupabase(() => ({ data: [] }))
    const categories = [
      { id: 'c1', name: 'A' },
      { id: 'c2', name: 'B' },
    ]
    const result = await rankCategoriesForKeyboard(supabase, 'u1', categories)
    expect(result).toEqual(categories)
    expect(opsFor(ops, 'transactions')).toHaveLength(0)
  })

  it('caps at MAX_CATEGORY_BUTTONS ranked by usage', async () => {
    const categories = Array.from({ length: 15 }, (_, i) => ({
      id: `c${i}`,
      name: `Cat ${String.fromCharCode(65 + i)}`,
    }))
    const { supabase } = mockSupabase(op => {
      if (op.table === 'transactions') {
        return {
          data: [
            { category_id: 'c14' },
            { category_id: 'c14' },
            { category_id: 'c13' },
          ],
        }
      }
      return { data: [] }
    })
    const result = await rankCategoriesForKeyboard(supabase, 'u1', categories)
    expect(result).toHaveLength(MAX_CATEGORY_BUTTONS)
    expect(result[0].id).toBe('c14')
    expect(result[1].id).toBe('c13')
  })
})

describe('askNextQuestion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function pendingWith(
    missing: PendingRow['missing_fields'],
    resolvedOverrides: Partial<ResolvedReferences> = {}
  ): PendingRow {
    return {
      id: 'p1',
      user_id: 'u1',
      channel_id: 'ch1',
      telegram_chat_id: 100,
      telegram_message_id: 7,
      payload: {
        extracted: EXTRACTED,
        resolved: { ...RESOLVED, ...resolvedOverrides },
        direction: 'expense',
      },
      status: 'clarifying',
      missing_fields: missing,
    }
  }

  it('freezes category options into the payload and renders buttons', async () => {
    const { supabase, ops } = mockSupabase(() => ({ data: [] }))
    const pending = pendingWith(['category'], { categoryId: null })
    const categories = [
      { id: 'c1', name: 'Coffee' },
      { id: 'c2', name: 'Groceries' },
    ]

    await askNextQuestion(supabase, pending, { categories, accounts: [] })

    const update = opsFor(ops, 'pending_telegram_transactions', 'update')[0]
    expect(update).toBeDefined()
    const payload = update.values as { payload: { options: { categories: unknown[] } } }
    expect(payload.payload.options.categories).toEqual(categories)

    const edit = vi.mocked(editMessageText)
    expect(edit).toHaveBeenCalledTimes(1)
    const [chatId, messageId, text, opts] = edit.mock.calls[0]
    expect(chatId).toBe(100)
    expect(messageId).toBe(7)
    expect(text).toContain('Pick a category')
    const keyboard = opts!.keyboard!
    expect(keyboard[0][0]).toEqual({ text: 'Coffee', callback_data: 'cc:p1:0' })
    expect(keyboard[0][1]).toEqual({ text: 'Groceries', callback_data: 'cc:p1:1' })
    // Last row is Cancel.
    expect(keyboard[keyboard.length - 1][0].callback_data).toBe('x:p1')
  })

  it('renders free-text amount question with only a cancel button', async () => {
    const { supabase, ops } = mockSupabase(() => ({ data: [] }))
    const pending = pendingWith(['amount'])

    await askNextQuestion(supabase, pending, { categories: [], accounts: [] })

    // No options to freeze → no payload update.
    expect(opsFor(ops, 'pending_telegram_transactions', 'update')).toHaveLength(0)
    const [, , text, opts] = vi.mocked(editMessageText).mock.calls[0]
    expect(text).toContain('What was the amount?')
    expect(opts!.keyboard).toEqual([[{ text: '❌ Cancel', callback_data: 'x:p1' }]])
  })

  it('renders date question with Today/Yesterday buttons', async () => {
    const { supabase } = mockSupabase(() => ({ data: [] }))
    const pending = pendingWith(['date'])

    await askNextQuestion(supabase, pending, { categories: [], accounts: [] })

    const [, , text, opts] = vi.mocked(editMessageText).mock.calls[0]
    expect(text).toContain('Which date?')
    expect(opts!.keyboard![0]).toEqual([
      { text: '📅 Today', callback_data: 'cd:p1:t' },
      { text: 'Yesterday', callback_data: 'cd:p1:y' },
    ])
  })
})

describe('computeMissingFields — transfers', () => {
  const counts = { categories: 5, accounts: 3 }
  const TRANSFER: ExtractedTransaction = {
    ...EXTRACTED,
    merchant: null,
    categoryHint: null,
    direction: 'transfer',
    toAccountHint: 'Visa 4857',
    toAmount: 1065.22,
    toCurrency: 'USD',
  }
  const TRANSFER_RESOLVED: ResolvedReferences = {
    ...RESOLVED,
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
  }

  it('asks for nothing when both accounts and the amount are resolved', () => {
    expect(computeMissingFields(TRANSFER, TRANSFER_RESOLVED, counts)).toEqual([])
  })

  it('never asks for merchant or category, and orders amount → account → to_account → date', () => {
    const extracted = { ...TRANSFER, amount: null, dateAmbiguous: true }
    const resolved = {
      ...TRANSFER_RESOLVED,
      accountId: null,
      toAccountId: null,
    }
    expect(computeMissingFields(extracted, resolved, counts)).toEqual([
      'amount',
      'account',
      'to_account',
      'date',
    ])
  })

  it('asks only for the unresolved destination', () => {
    const resolved = { ...TRANSFER_RESOLVED, toAccountId: null }
    expect(computeMissingFields(TRANSFER, resolved, counts)).toEqual(['to_account'])
  })
})
