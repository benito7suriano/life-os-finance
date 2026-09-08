import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockSupabase, opsFor, filterArg } from '@/lib/test-utils/mock-supabase'

vi.mock('@/lib/telegram/client', () => ({
  sendMessage: vi.fn(async () => ({ message_id: 1 })),
}))
vi.mock('../build', () => ({
  buildReportData: vi.fn(async (_s: unknown, userId: string, kind: string) => ({ kind, userId })),
}))
vi.mock('../generate', () => ({
  // ~4,600 chars over many lines → must split into exactly two Telegram messages.
  generateReport: vi.fn(
    async (data: { kind: string; userId: string }) =>
      `<b>${data.kind} for ${data.userId}</b>\n` + Array.from({ length: 100 }, () => 'x'.repeat(45)).join('\n')
  ),
}))

import { sendMessage } from '@/lib/telegram/client'
import { buildReportData } from '../build'
import { runReportForAllChannels, runReportForChannel } from '../deliver'

const NOW = new Date(2026, 8, 15)

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('runReportForChannel', () => {
  it('builds, phrases, splits and sends the report as HTML to that chat', async () => {
    const { supabase } = mockSupabase(() => ({ data: [] }))
    const result = await runReportForChannel(supabase, { id: 'ch1', user_id: 'u1', telegram_chat_id: 100 }, 'weekly', NOW)

    expect(buildReportData).toHaveBeenCalledWith(supabase, 'u1', 'weekly', NOW)
    expect(result).toEqual({ chatId: 100, chunks: 2 })
    expect(sendMessage).toHaveBeenCalledTimes(2)
    const [chatId, text, opts] = vi.mocked(sendMessage).mock.calls[0]
    expect(chatId).toBe(100)
    expect(text).toContain('<b>weekly for u1</b>')
    expect(opts).toEqual({ parseMode: 'HTML' })
  })
})

describe('runReportForAllChannels', () => {
  it('sends to every connected Telegram channel and keeps going after a failure', async () => {
    const { supabase, ops } = mockSupabase((op) => {
      if (op.table === 'automation_channels') {
        return {
          data: [
            { id: 'ch1', user_id: 'u1', telegram_chat_id: 100 },
            { id: 'ch2', user_id: 'u2', telegram_chat_id: 200 },
          ],
        }
      }
      return { data: [] }
    })
    vi.mocked(buildReportData).mockRejectedValueOnce(new Error('boom'))

    const results = await runReportForAllChannels(supabase, 'monthly', NOW)

    const op = opsFor(ops, 'automation_channels')[0]
    expect(filterArg(op, 'eq', 'type')).toBe('telegram')
    expect(filterArg(op, 'eq', 'status')).toBe('connected')
    expect(results).toEqual([
      { chatId: 100, error: 'boom' },
      { chatId: 200, chunks: 2 },
    ])
  })
})
