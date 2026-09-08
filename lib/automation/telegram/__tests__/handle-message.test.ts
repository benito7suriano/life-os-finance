import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ExtractedTransaction } from '../../extract-transaction'
import type { ResolvedReferences } from '../../resolve-references'
import type { PendingRow } from '../types'
import { mockSupabase, opsFor, type Op } from './mock-supabase'

vi.mock('@/lib/telegram/client', () => ({
  sendMessage: vi.fn(async () => ({ message_id: 42 })),
  editMessageText: vi.fn(async () => ({})),
  answerCallbackQuery: vi.fn(async () => ({})),
  downloadFile: vi.fn(async () => ({
    bytes: new ArrayBuffer(8),
    mimeType: 'image/jpeg',
    filename: 'photo.jpg',
  })),
}))

vi.mock('../../extract-transaction', async importOriginal => {
  const actual = await importOriginal<typeof import('../../extract-transaction')>()
  return {
    ...actual,
    extractTransaction: vi.fn(),
    mergeClarification: vi.fn(),
  }
})

import { sendMessage, editMessageText, downloadFile } from '@/lib/telegram/client'
import {
  extractTransaction,
  mergeClarification,
} from '../../extract-transaction'
import { processIncoming, buildExtractorInput } from '../handle-message'

const CHANNEL = { id: 'ch1', user_id: 'u1', status: 'connected' as const }

const EXTRACTED: ExtractedTransaction = {
  amount: 3.75,
  currency: 'USD',
  merchant: 'The Coffee Cup',
  categoryHint: 'Coffee',
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

interface Fixture {
  activeClarifying?: PendingRow | null
  merchants?: unknown[]
  categories?: unknown[]
  accounts?: unknown[]
  insertError?: { message: string }
}

function respondWith(fx: Fixture) {
  return (op: Op) => {
    if (op.table === 'pending_telegram_transactions') {
      if (op.action === 'select') return { data: fx.activeClarifying ?? null }
      if (op.action === 'insert') {
        return fx.insertError
          ? { data: null, error: fx.insertError }
          : { data: { id: 'p-new' } }
      }
      return {}
    }
    if (op.table === 'merchants') return { data: fx.merchants ?? [] }
    if (op.table === 'categories') {
      return {
        data: fx.categories ?? [{ id: 'c1', name: 'Coffee', type: 'expense' }],
      }
    }
    if (op.table === 'accounts') {
      return {
        data: fx.accounts ?? [{ id: 'a1', name: 'Cash', last_4_digits: null }],
      }
    }
    return { data: [] }
  }
}

function clarifyingRow(
  missing: PendingRow['missing_fields'],
  extractedOverrides: Partial<ExtractedTransaction> = {}
): PendingRow {
  return {
    id: 'p-old',
    user_id: 'u1',
    channel_id: 'ch1',
    telegram_chat_id: 100,
    telegram_message_id: 7,
    payload: {
      extracted: { ...EXTRACTED, ...extractedOverrides },
      resolved: { ...RESOLVED, categoryId: null, categorySource: null },
      direction: 'expense',
    },
    status: 'clarifying',
    missing_fields: missing,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('processIncoming — fresh extraction', () => {
  it('goes straight to the confirm card when nothing is missing', async () => {
    vi.mocked(extractTransaction).mockResolvedValueOnce(EXTRACTED)
    const { supabase, ops } = mockSupabase(
      respondWith({
        merchants: [
          { id: 'm1', name: 'The Coffee Cup', default_category_id: null },
        ],
      })
    )

    await processIncoming(supabase, CHANNEL, 100, { kind: 'text', text: 'x' })

    const insert = opsFor(ops, 'pending_telegram_transactions', 'insert')[0]
    expect(insert.values).toMatchObject({
      status: 'confirming',
      missing_fields: [],
    })
    // Keyboard swap carries the real pending id.
    const edit = vi.mocked(editMessageText).mock.calls[0]
    expect(edit[3]!.keyboard![0][0].callback_data).toBe('c:p-new')
    expect(vi.mocked(sendMessage).mock.calls[0][1]).toContain('Confirm this transaction?')
  })

  it('inserts a clarifying row and asks for the missing category', async () => {
    vi.mocked(extractTransaction).mockResolvedValueOnce({
      ...EXTRACTED,
      categoryHint: null,
    })
    const { supabase, ops } = mockSupabase(
      respondWith({
        categories: [
          { id: 'c1', name: 'Coffee', type: 'expense' },
          { id: 'c2', name: 'Groceries', type: 'expense' },
        ],
      })
    )

    await processIncoming(supabase, CHANNEL, 100, { kind: 'text', text: 'x' })

    const insert = opsFor(ops, 'pending_telegram_transactions', 'insert')[0]
    expect(insert.values).toMatchObject({
      status: 'clarifying',
      missing_fields: ['category'],
    })
    // The question is rendered onto the card.
    const questionEdit = vi
      .mocked(editMessageText)
      .mock.calls.find(c => (c[2] as string).includes('Pick a category'))
    expect(questionEdit).toBeDefined()
  })

  it('replies with a classified error and stores nothing when extraction throws', async () => {
    vi.mocked(extractTransaction).mockRejectedValueOnce(
      new Error('gemini-http-500')
    )
    const { supabase, ops } = mockSupabase(respondWith({}))

    await processIncoming(supabase, CHANNEL, 100, { kind: 'text', text: 'x' })

    expect(vi.mocked(sendMessage).mock.calls[0][1]).toContain(
      "I couldn't read that (the reader service errored)"
    )
    expect(opsFor(ops, 'pending_telegram_transactions', 'insert')).toHaveLength(0)
  })

  it('hard-stops when the user has no accounts', async () => {
    vi.mocked(extractTransaction).mockResolvedValueOnce(EXTRACTED)
    const { supabase, ops } = mockSupabase(respondWith({ accounts: [] }))

    await processIncoming(supabase, CHANNEL, 100, { kind: 'text', text: 'x' })

    expect(vi.mocked(sendMessage).mock.calls[0][1]).toContain(
      "don't have any accounts"
    )
    expect(opsFor(ops, 'pending_telegram_transactions', 'insert')).toHaveLength(0)
  })
})

describe('processIncoming — active clarification routing', () => {
  it('routes a text reply through mergeClarification, not extractTransaction', async () => {
    const active = clarifyingRow(['amount'], { amount: null })
    const originalExtracted = active.payload.extracted
    vi.mocked(mergeClarification).mockResolvedValueOnce({
      intent: 'answer',
      extracted: { ...EXTRACTED, amount: 8.5, categoryHint: null },
    })
    const { supabase } = mockSupabase(respondWith({ activeClarifying: active }))

    await processIncoming(supabase, CHANNEL, 100, { kind: 'text', text: '8.50' })

    expect(mergeClarification).toHaveBeenCalledWith({
      partial: originalExtracted,
      missingField: 'amount',
      userReply: '8.50',
    })
    expect(extractTransaction).not.toHaveBeenCalled()
  })

  it('supersedes the old clarification when the reply is a new transaction', async () => {
    const active = clarifyingRow(['amount'], { amount: null })
    vi.mocked(mergeClarification).mockResolvedValueOnce({
      intent: 'new_transaction',
      extracted: EXTRACTED,
    })
    vi.mocked(extractTransaction).mockResolvedValueOnce(EXTRACTED)
    const { supabase, ops } = mockSupabase(respondWith({ activeClarifying: active }))

    await processIncoming(supabase, CHANNEL, 100, {
      kind: 'text',
      text: '$20 lunch at Subway',
    })

    // Old row deleted by id + card marked skipped, then fresh extraction ran.
    const deletes = opsFor(ops, 'pending_telegram_transactions', 'delete')
    expect(deletes.some(d => d.filters.eq?.some(a => a[1] === 'p-old'))).toBe(true)
    const skipEdit = vi
      .mocked(editMessageText)
      .mock.calls.find(c => (c[2] as string).includes('Skipped'))
    expect(skipEdit).toBeDefined()
    expect(extractTransaction).toHaveBeenCalledTimes(1)
  })

  it('supersedes on a photo sent mid-clarification', async () => {
    const active = clarifyingRow(['merchant'], { merchant: null })
    vi.mocked(extractTransaction).mockResolvedValueOnce(EXTRACTED)
    const { supabase, ops } = mockSupabase(respondWith({ activeClarifying: active }))

    await processIncoming(supabase, CHANNEL, 100, {
      kind: 'image',
      bytes: new ArrayBuffer(8),
      mimeType: 'image/jpeg',
    })

    expect(mergeClarification).not.toHaveBeenCalled()
    const deletes = opsFor(ops, 'pending_telegram_transactions', 'delete')
    expect(deletes.some(d => d.filters.eq?.some(a => a[1] === 'p-old'))).toBe(true)
    expect(extractTransaction).toHaveBeenCalledTimes(1)
  })

  it('replies gracefully when the merge call fails', async () => {
    const active = clarifyingRow(['amount'], { amount: null })
    vi.mocked(mergeClarification).mockRejectedValueOnce(new Error('gemini-http-500'))
    const { supabase, ops } = mockSupabase(respondWith({ activeClarifying: active }))

    await processIncoming(supabase, CHANNEL, 100, { kind: 'text', text: '8.50' })

    expect(vi.mocked(sendMessage).mock.calls[0][1]).toContain(
      'trouble reading that reply'
    )
    // The clarification row survives for a retry.
    const deletes = opsFor(ops, 'pending_telegram_transactions', 'delete')
    expect(deletes.some(d => d.filters.eq?.some(a => a[1] === 'p-old'))).toBe(false)
  })
})

describe('processIncoming — Other… free-text category', () => {
  function awaitingCategoryRow(): PendingRow {
    const row = clarifyingRow(['category'])
    row.payload.awaitingCategoryText = true
    row.payload.options = {
      categories: [
        { id: 'c1', name: 'Coffee' },
        { id: 'c2', name: 'Groceries' },
      ],
    }
    return row
  }

  it('fuzzy-matches the reply to the closest existing category', async () => {
    const active = awaitingCategoryRow()
    const { supabase, ops } = mockSupabase(
      respondWith({
        activeClarifying: active,
        categories: [
          { id: 'c1', name: 'Coffee', type: 'expense' },
          { id: 'c2', name: 'Groceries', type: 'expense' },
        ],
      })
    )

    await processIncoming(supabase, CHANNEL, 100, { kind: 'text', text: 'grocery' })

    expect(mergeClarification).not.toHaveBeenCalled()
    expect(extractTransaction).not.toHaveBeenCalled()
    const update = opsFor(ops, 'pending_telegram_transactions', 'update')[0]
    expect(update.values).toMatchObject({
      status: 'confirming',
      missing_fields: [],
    })
    const values = update.values as {
      payload: { resolved: ResolvedReferences; awaitingCategoryText?: boolean }
    }
    expect(values.payload.resolved.categoryId).toBe('c2')
    expect(values.payload.resolved.categoryName).toBe('Groceries')
    expect(values.payload.resolved.categorySource).toBe('user_choice')
    expect(values.payload.awaitingCategoryText).toBeUndefined()
  })

  it('queues a brand-new category when nothing matches', async () => {
    const active = awaitingCategoryRow()
    const { supabase, ops } = mockSupabase(respondWith({ activeClarifying: active }))

    await processIncoming(supabase, CHANNEL, 100, {
      kind: 'text',
      text: '  Pet   Supplies ',
    })

    const update = opsFor(ops, 'pending_telegram_transactions', 'update')[0]
    const values = update.values as { payload: { resolved: ResolvedReferences } }
    expect(values.payload.resolved.categoryId).toBeNull()
    expect(values.payload.resolved.categoryName).toBe('Pet Supplies')
    expect(values.payload.resolved.categorySource).toBe('user_new')
    // Confirm card marks the category as new.
    const confirmEdit = vi
      .mocked(editMessageText)
      .mock.calls.find(c => (c[2] as string).includes('Confirm this transaction?'))
    expect(confirmEdit).toBeDefined()
    expect(confirmEdit![2]).toContain('Pet Supplies (new)')
  })

  it('treats an amount-looking reply as a new transaction instead', async () => {
    const active = awaitingCategoryRow()
    vi.mocked(extractTransaction).mockResolvedValueOnce(EXTRACTED)
    const { supabase, ops } = mockSupabase(respondWith({ activeClarifying: active }))

    await processIncoming(supabase, CHANNEL, 100, {
      kind: 'text',
      text: '$20 lunch at Subway',
    })

    const deletes = opsFor(ops, 'pending_telegram_transactions', 'delete')
    expect(deletes.some(d => d.filters.eq?.some(a => a[1] === 'p-old'))).toBe(true)
    expect(extractTransaction).toHaveBeenCalledTimes(1)
  })

  it('re-prompts on an empty reply without losing the clarification', async () => {
    const active = awaitingCategoryRow()
    const { supabase, ops } = mockSupabase(respondWith({ activeClarifying: active }))

    await processIncoming(supabase, CHANNEL, 100, { kind: 'text', text: '   ' })

    expect(vi.mocked(sendMessage).mock.calls[0][1]).toContain('I need a name')
    const deletes = opsFor(ops, 'pending_telegram_transactions', 'delete')
    expect(deletes.some(d => d.filters.eq?.some(a => a[1] === 'p-old'))).toBe(false)
    expect(opsFor(ops, 'pending_telegram_transactions', 'update')).toHaveLength(0)
  })

  it('leaves category texts alone when Other… was not tapped', async () => {
    const active = clarifyingRow(['category'])
    vi.mocked(extractTransaction).mockResolvedValueOnce(EXTRACTED)
    const { supabase, ops } = mockSupabase(respondWith({ activeClarifying: active }))

    await processIncoming(supabase, CHANNEL, 100, { kind: 'text', text: 'Groceries' })

    // Unchanged behavior: a plain text with no flag supersedes + re-extracts.
    const deletes = opsFor(ops, 'pending_telegram_transactions', 'delete')
    expect(deletes.some(d => d.filters.eq?.some(a => a[1] === 'p-old'))).toBe(true)
    expect(extractTransaction).toHaveBeenCalledTimes(1)
  })
})

describe('buildExtractorInput — documents', () => {
  const baseMsg = { message_id: 1, chat: { id: 100, type: 'private' as const }, date: 0 }

  it('routes a PDF document to the pdf kind with its declared mime type', async () => {
    const input = await buildExtractorInput({
      ...baseMsg,
      caption: 'lunch receipt',
      document: { file_id: 'f1', file_unique_id: 'u1', file_name: 'receipt.pdf', mime_type: 'application/pdf' },
    })
    expect(input).toMatchObject({
      kind: 'pdf',
      mimeType: 'application/pdf',
      caption: 'lunch receipt',
    })
    expect(downloadFile).toHaveBeenCalledWith('f1')
  })

  it('routes an image document to the image kind', async () => {
    const input = await buildExtractorInput({
      ...baseMsg,
      document: { file_id: 'f2', file_unique_id: 'u2', file_name: 'shot.png', mime_type: 'image/png' },
    })
    expect(input).toMatchObject({ kind: 'image', mimeType: 'image/png' })
  })

  it('rejects unsupported document types without downloading', async () => {
    const input = await buildExtractorInput({
      ...baseMsg,
      document: { file_id: 'f3', file_unique_id: 'u3', file_name: 'notes.docx', mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
    })
    expect(input).toBeNull()
    expect(downloadFile).not.toHaveBeenCalled()
  })

  it('uses the downloaded mime guess when the document declares none', async () => {
    const input = await buildExtractorInput({
      ...baseMsg,
      document: { file_id: 'f4', file_unique_id: 'u4', file_name: 'img' },
    })
    // No declared mime type → not identifiable as pdf/image → rejected.
    expect(input).toBeNull()
  })
})

describe('processIncoming — transfers', () => {
  const TRANSFER: ExtractedTransaction = {
    ...EXTRACTED,
    merchant: null,
    categoryHint: null,
    direction: 'transfer',
    amount: 63806.68,
    currency: 'DOP',
    accountHint: 'Cuenta de Ahorros 828289652',
    toAccountHint: 'Tarjeta de crédito / 4857',
    toAmount: 1065.22,
    toCurrency: 'USD',
    date: '2026-08-22',
  }

  it('rejects a transfer when the user has fewer than two accounts', async () => {
    vi.mocked(extractTransaction).mockResolvedValueOnce(TRANSFER)
    const { supabase, ops } = mockSupabase(respondWith({}))

    await processIncoming(supabase, CHANNEL, 100, {
      kind: 'text',
      text: 'pay my visa from savings',
    })

    expect(vi.mocked(sendMessage).mock.calls[0][1]).toContain('transfer')
    expect(opsFor(ops, 'pending_telegram_transactions', 'insert')).toHaveLength(0)
  })

  it('goes straight to the transfer confirm card when both accounts match', async () => {
    vi.mocked(extractTransaction).mockResolvedValueOnce(TRANSFER)
    const { supabase, ops } = mockSupabase(
      respondWith({
        accounts: [
          { id: 'a-dop', name: 'Cuenta de Ahorros', last_4_digits: '9652' },
          { id: 'a-usd', name: 'Visa Infinite', last_4_digits: '4857' },
        ],
      })
    )

    await processIncoming(supabase, CHANNEL, 100, {
      kind: 'image',
      bytes: new ArrayBuffer(8),
      mimeType: 'image/jpeg',
    })

    const card = vi.mocked(sendMessage).mock.calls[0][1] as string
    expect(card).toContain('Confirm this transfer')
    expect(card).toContain('63,806.68 DOP')
    expect(card).toContain('$1,065.22')
    expect(card).toContain('From: Cuenta de Ahorros')
    expect(card).toContain('To:   Visa Infinite')

    const insert = opsFor(ops, 'pending_telegram_transactions', 'insert')[0]
    const values = insert.values as { status: string; missing_fields: string[] }
    expect(values.status).toBe('confirming')
    expect(values.missing_fields).toEqual([])
  })

  it('asks for the destination account when only the source matches', async () => {
    vi.mocked(extractTransaction).mockResolvedValueOnce({
      ...TRANSFER,
      toAccountHint: null,
      toAmount: null,
      toCurrency: null,
    })
    const { supabase, ops } = mockSupabase(
      respondWith({
        accounts: [
          { id: 'a-dop', name: 'Cuenta de Ahorros', last_4_digits: '9652' },
          { id: 'a-usd', name: 'Visa Infinite', last_4_digits: '4857' },
        ],
      })
    )

    await processIncoming(supabase, CHANNEL, 100, {
      kind: 'text',
      text: 'moved RD$63,806.68 from savings',
    })

    const insert = opsFor(ops, 'pending_telegram_transactions', 'insert')[0]
    const values = insert.values as { status: string; missing_fields: string[] }
    expect(values.status).toBe('clarifying')
    expect(values.missing_fields).toEqual(['to_account'])

    // The question card asks for the destination with account buttons.
    const edit = vi.mocked(editMessageText).mock.calls.at(-1)
    expect(edit?.[2]).toContain('To which account?')
  })
})

describe('processIncoming — account pre-selection', () => {
  const LEDGER = [
    { id: 'pop-dop', name: 'Popular 9652 (DOP)', currency: 'DOP', type: 'checking' },
    { id: 'pop-usd', name: 'Popular 8471 (USD)', currency: 'USD', type: 'checking' },
    { id: 'visa-usd', name: 'VISA PLATINUM USD', currency: 'USD', type: 'credit_card' },
    { id: 'visa-dop', name: 'VISA PLATINUM DOP', currency: 'DOP', type: 'credit_card' },
  ]
  const OWN_TRANSFER: ExtractedTransaction = {
    ...EXTRACTED,
    merchant: null,
    categoryHint: null,
    direction: 'transfer',
    amount: 63806.68,
    currency: 'DOP',
    accountHint: 'Cuenta de ahorros *****9652',
    toAccountHint: 'Tarjeta de crédito *****8471',
    toAmount: 1065.22,
    toCurrency: 'USD',
    date: '2026-08-22',
  }

  it('hands the extractor the account list for context', async () => {
    vi.mocked(extractTransaction).mockResolvedValueOnce(OWN_TRANSFER)
    const { supabase } = mockSupabase(respondWith({ accounts: LEDGER }))

    await processIncoming(supabase, CHANNEL, 100, { kind: 'text', text: 'x' })

    const ctx = vi.mocked(extractTransaction).mock.calls[0][1]
    expect(ctx?.accounts?.map(a => a.name)).toEqual(LEDGER.map(a => a.name))
  })

  it('pre-selects both accounts from masked digits in the ledger names and offers edit buttons', async () => {
    vi.mocked(extractTransaction).mockResolvedValueOnce(OWN_TRANSFER)
    const { supabase, ops } = mockSupabase(respondWith({ accounts: LEDGER }))

    await processIncoming(supabase, CHANNEL, 100, {
      kind: 'image',
      bytes: new ArrayBuffer(8),
      mimeType: 'image/jpeg',
    })

    const card = vi.mocked(sendMessage).mock.calls[0][1] as string
    expect(card).toContain('From: Popular 9652 (DOP)')
    expect(card).toContain('To:   Popular 8471 (USD)')
    const insert = opsFor(ops, 'pending_telegram_transactions', 'insert')[0]
    expect(insert.values).toMatchObject({ status: 'confirming', missing_fields: [] })

    const keyboard = vi.mocked(editMessageText).mock.calls[0][3]!.keyboard!
    expect(keyboard[0][0].callback_data).toBe('c:p-new')
    expect(keyboard[1]).toEqual([
      { text: '✏️ From account', callback_data: 'ea:p-new' },
      { text: '✏️ To account', callback_data: 'et:p-new' },
    ])
  })

  it('asks for an ambiguous destination with the best guesses starred first and a "not my account" escape', async () => {
    vi.mocked(extractTransaction).mockResolvedValueOnce({
      ...OWN_TRANSFER,
      toAccountHint: 'Visa Platinum',
    })
    const { supabase, ops } = mockSupabase(respondWith({ accounts: LEDGER }))

    await processIncoming(supabase, CHANNEL, 100, { kind: 'text', text: 'x' })

    const insert = opsFor(ops, 'pending_telegram_transactions', 'insert')[0]
    expect(insert.values).toMatchObject({ status: 'clarifying', missing_fields: ['to_account'] })

    const [, , text, opts] = vi.mocked(editMessageText).mock.calls.at(-1)!
    expect(text).toContain('To which account?')
    expect(text).toContain('⭐ = my best guess')
    const keyboard = opts!.keyboard!
    expect(keyboard[0][0].text).toBe('⭐ VISA PLATINUM USD')
    expect(keyboard[0][1].text).toBe('⭐ VISA PLATINUM DOP')
    expect(keyboard.at(-2)![0]).toEqual({
      text: "🙅 Not my account — it's a payment",
      callback_data: 'cp:p-new',
    })
    // Destination list frozen separately from the source list.
    const update = opsFor(ops, 'pending_telegram_transactions', 'update')[0]
    const payload = update.values as { payload: { options: { toAccounts: unknown[] } } }
    expect(payload.payload.options.toAccounts).toHaveLength(LEDGER.length)
  })
})

describe('processIncoming — payments to somebody else', () => {
  const LEDGER = [
    { id: 'pop-dop', name: 'Popular 9652 (DOP)', currency: 'DOP', type: 'checking' },
    { id: 'pop-usd', name: 'Popular 8471 (USD)', currency: 'USD', type: 'checking' },
  ]
  const RENT_AS_TRANSFER: ExtractedTransaction = {
    ...EXTRACTED,
    merchant: null,
    categoryHint: 'Rent',
    direction: 'transfer',
    amount: 89850,
    currency: 'DOP',
    accountHint: 'Cuenta de ahorros *****9652',
    toAccountHint: 'Cuenta De Ahorros 832238471',
    toAmount: 1500,
    toCurrency: 'USD',
    counterparty: 'Hubert Wiriath',
    date: '2026-09-08',
  }

  it('re-frames a transfer to a named payee as an expense from the source account', async () => {
    vi.mocked(extractTransaction).mockResolvedValueOnce(RENT_AS_TRANSFER)
    const { supabase, ops } = mockSupabase(
      respondWith({
        accounts: LEDGER,
        categories: [{ id: 'c-rent', name: 'Rent', type: 'expense' }],
      })
    )

    await processIncoming(supabase, CHANNEL, 100, {
      kind: 'image',
      bytes: new ArrayBuffer(8),
      mimeType: 'image/jpeg',
    })

    // Categories were re-fetched for the new direction.
    const categoryOps = opsFor(ops, 'categories', 'select')
    expect(categoryOps.map(o => o.filters.eq?.find(a => a[0] === 'type')?.[1])).toEqual([
      'transfer',
      'expense',
    ])

    const card = vi.mocked(sendMessage).mock.calls[0][1] as string
    expect(card).toContain('Confirm this transaction?')
    expect(card).toContain('Expense: 89,850.00 DOP (= $1,500.00)')
    expect(card).toContain('Merchant: Hubert Wiriath (new)')
    expect(card).toContain('Category: Rent')
    expect(card).toContain('Account:  Popular 9652 (DOP)')
    expect(card).toContain('832238471')

    const insert = opsFor(ops, 'pending_telegram_transactions', 'insert')[0]
    const values = insert.values as {
      status: string
      payload: { direction: string; extracted: ExtractedTransaction }
    }
    expect(values.status).toBe('confirming')
    expect(values.payload.direction).toBe('expense')
    expect(values.payload.extracted.toAccountHint).toBeNull()

    const keyboard = vi.mocked(editMessageText).mock.calls[0][3]!.keyboard!
    expect(keyboard[1]).toEqual([{ text: '✏️ Change account', callback_data: 'ea:p-new' }])
  })

  it('keeps a transfer whose destination is unmistakably the user\'s own account', async () => {
    vi.mocked(extractTransaction).mockResolvedValueOnce({
      ...RENT_AS_TRANSFER,
      toAccountHint: 'Cuenta de ahorros *****8471',
      counterparty: 'Beno Suriano',
    })
    const { supabase, ops } = mockSupabase(respondWith({ accounts: LEDGER }))

    await processIncoming(supabase, CHANNEL, 100, { kind: 'text', text: 'x' })

    const insert = opsFor(ops, 'pending_telegram_transactions', 'insert')[0]
    expect(insert.values).toMatchObject({
      status: 'confirming',
      payload: { direction: 'transfer' },
    })
  })
})
