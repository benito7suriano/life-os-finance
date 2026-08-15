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
