import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mockSupabase } from '@/lib/test-utils/mock-supabase'
import type { TelegramMessage } from '@/lib/telegram/client'

vi.mock('@/lib/telegram/client', () => ({
  sendMessage: vi.fn(async () => ({ message_id: 42 })),
  editMessageText: vi.fn(async () => ({})),
  answerCallbackQuery: vi.fn(async () => ({})),
  sendChatAction: vi.fn(async () => true),
  downloadFile: vi.fn(async () => ({ bytes: new ArrayBuffer(8), mimeType: 'image/jpeg', filename: 'p.jpg' })),
}))
vi.mock('../../extract-transaction', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../extract-transaction')>()
  return { ...actual, extractTransaction: vi.fn(), mergeClarification: vi.fn() }
})
vi.mock('@/lib/agent/run', () => ({
  runWealthAgent: vi.fn(async () => ({ reply: '<b>$1,000</b>', loggedTransaction: false })),
}))
vi.mock('@/lib/reports/deliver', () => ({
  runReportForChannel: vi.fn(async () => ({ chatId: 100, chunks: 1 })),
}))

import { sendMessage, sendChatAction } from '@/lib/telegram/client'
import { extractTransaction, mergeClarification } from '../../extract-transaction'
import { runWealthAgent } from '@/lib/agent/run'
import { runReportForChannel } from '@/lib/reports/deliver'
import { classifyIncoming, handleMessage } from '../handle-message'

const CHAT = 100

function textMessage(text: string): TelegramMessage {
  return { message_id: 1, chat: { id: CHAT, type: 'private' }, date: 0, text, from: { id: 7, is_bot: false, first_name: 'B' } }
}

function db(opts: { activeClarifying?: boolean } = {}) {
  return mockSupabase((op) => {
    if (op.table === 'automation_channels') return { data: { id: 'ch1', user_id: 'u1', status: 'connected' } }
    if (op.table === 'pending_telegram_transactions' && op.action === 'select') {
      return {
        data: opts.activeClarifying
          ? {
              id: 'p1', user_id: 'u1', channel_id: 'ch1', telegram_chat_id: CHAT, telegram_message_id: 5,
              payload: { extracted: { amount: null, currency: 'USD', merchant: 'Cafe', direction: 'expense' }, resolved: {}, direction: 'expense' },
              status: 'clarifying', missing_fields: ['amount'],
            }
          : null,
      }
    }
    if (op.table === 'accounts') return { data: [{ id: 'a1', name: 'Cash', last_4_digits: null }] }
    if (op.table === 'categories') return { data: [] }
    return { data: [] }
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.stubEnv('GEMINI_API_KEY', 'sk-test')
  vi.mocked(extractTransaction).mockResolvedValue({
    amount: 5, currency: 'USD', merchant: 'Cafe', categoryHint: null, accountHint: null,
    date: '2026-09-15', dateAmbiguous: false, notes: null, direction: 'expense', confidence: 0.9,
  } as never)
  vi.mocked(mergeClarification).mockResolvedValue({ intent: 'answer', extracted: { amount: 3.75 } } as never)
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('classifyIncoming', () => {
  it('sends media to capture, questions to the agent, and clarification replies to capture', () => {
    expect(classifyIncoming({ kind: 'image' }, { hasActiveClarification: false, hasAgentKey: true })).toBe('capture')
    expect(classifyIncoming({ kind: 'text' }, { hasActiveClarification: true, hasAgentKey: true })).toBe('capture')
    expect(classifyIncoming({ kind: 'text' }, { hasActiveClarification: false, hasAgentKey: true })).toBe('agent')
    expect(classifyIncoming({ kind: 'text' }, { hasActiveClarification: false, hasAgentKey: false })).toBe('capture')
  })
})

describe('handleMessage routing', () => {
  it('answers a question through the wealth agent as HTML', async () => {
    const { supabase } = db()
    await handleMessage(supabase, textMessage('what is my net worth?'))

    expect(sendChatAction).toHaveBeenCalledWith(CHAT, 'typing')
    expect(runWealthAgent).toHaveBeenCalledWith(
      expect.objectContaining({ supabase, userId: 'u1', chatId: CHAT, question: 'what is my net worth?' })
    )
    expect(sendMessage).toHaveBeenCalledWith(CHAT, '<b>$1,000</b>', { parseMode: 'HTML' })
    expect(extractTransaction).not.toHaveBeenCalled()
  })

  it('keeps a reply to an open clarification question in the extraction flow', async () => {
    const { supabase } = db({ activeClarifying: true })
    await handleMessage(supabase, textMessage('3.75'))

    expect(runWealthAgent).not.toHaveBeenCalled()
    expect(mergeClarification).toHaveBeenCalled()
  })

  it('falls back to extraction when no Gemini key is configured', async () => {
    vi.stubEnv('GEMINI_API_KEY', '')
    const { supabase } = db()
    await handleMessage(supabase, textMessage('$12 coffee'))

    expect(runWealthAgent).not.toHaveBeenCalled()
    expect(extractTransaction).toHaveBeenCalled()
  })

  it('runs the agent through the deferral hook so the webhook can ack first', async () => {
    const { supabase } = db()
    const deferred: (() => Promise<void>)[] = []
    await handleMessage(supabase, textMessage('net worth?'), { defer: (fn) => deferred.push(fn) })

    expect(runWealthAgent).not.toHaveBeenCalled()
    expect(deferred).toHaveLength(1)
    await deferred[0]()
    expect(runWealthAgent).toHaveBeenCalledTimes(1)
  })

  it('gives the agent a hook that hands transaction text to the extraction pipeline', async () => {
    vi.mocked(runWealthAgent).mockImplementationOnce(async (input) => {
      await input.logTransaction!('$12 coffee at Blue Bottle')
      return { reply: '', loggedTransaction: true }
    })
    const { supabase } = db()
    await handleMessage(supabase, textMessage('$12 coffee at Blue Bottle'))

    expect(extractTransaction).toHaveBeenCalledWith({ kind: 'text', text: '$12 coffee at Blue Bottle' })
    // The confirm card is the reply — the agent's empty reply is not sent.
    const texts = vi.mocked(sendMessage).mock.calls.map((c) => c[1])
    expect(texts).not.toContain('')
  })

  it('tells the user when the agent fails instead of going silent', async () => {
    vi.mocked(runWealthAgent).mockRejectedValueOnce(new Error('api down'))
    const { supabase } = db()
    await handleMessage(supabase, textMessage('net worth?'))

    expect(sendMessage).toHaveBeenCalledWith(CHAT, expect.stringMatching(/snag/i))
  })

  it('sends an on-demand report for /report monthly', async () => {
    const { supabase } = db()
    await handleMessage(supabase, textMessage('/report monthly'))

    expect(runReportForChannel).toHaveBeenCalledWith(
      supabase,
      { id: 'ch1', user_id: 'u1', telegram_chat_id: CHAT },
      'monthly',
      expect.any(Date)
    )
    expect(runWealthAgent).not.toHaveBeenCalled()
  })

  it('defaults /report to weekly and rejects unknown kinds', async () => {
    const { supabase } = db()
    await handleMessage(supabase, textMessage('/report'))
    expect(runReportForChannel).toHaveBeenLastCalledWith(expect.anything(), expect.anything(), 'weekly', expect.any(Date))

    await handleMessage(supabase, textMessage('/report yearly'))
    expect(sendMessage).toHaveBeenLastCalledWith(CHAT, expect.stringMatching(/weekly|monthly/))
    expect(runReportForChannel).toHaveBeenCalledTimes(1)
  })

  it('advertises questions and /report in /help', async () => {
    const { supabase } = db()
    await handleMessage(supabase, textMessage('/help'))
    const text = vi.mocked(sendMessage).mock.calls[0][1]
    expect(text).toMatch(/ask me/i)
    expect(text).toContain('/report')
  })
})
