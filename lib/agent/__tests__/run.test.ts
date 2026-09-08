import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockSupabase, opsFor, filterArg } from '@/lib/test-utils/mock-supabase'
import { runWealthAgent, MAX_TOOL_ITERATIONS } from '../run'
import type { AgentClient, ModelRequest, ModelResponse } from '../types'

const NOW = new Date(2026, 8, 15)

function textResponse(text: string): ModelResponse {
  return { content: text ? [{ type: 'text', text }] : [], stopReason: 'end_turn' }
}

function toolUseResponse(calls: { id: string; name: string; input: Record<string, unknown> }[]): ModelResponse {
  return {
    content: calls.map((c) => ({ type: 'tool_use', id: c.id, name: c.name, input: c.input })),
    stopReason: 'tool_use',
    raw: [{ marker: 'provider-parts' }],
  }
}

/** Scripted fake client: returns the queued responses in order, records requests. */
function fakeClient(script: ModelResponse[]): AgentClient & { calls: ModelRequest[] } {
  const calls: ModelRequest[] = []
  const queue = [...script]
  return {
    calls,
    async createMessage(request) {
      calls.push(request)
      const next = queue.shift()
      if (!next) throw new Error('fake client: script exhausted')
      return next
    },
  }
}

function db(history: { role: 'user' | 'assistant'; content: string }[] = []) {
  return mockSupabase((op) => {
    if (op.table === 'telegram_agent_messages' && op.action === 'select') {
      // The query asks newest-first; return it that way.
      return { data: [...history].reverse() }
    }
    if (op.table === 'accounts') {
      return { data: [{ id: 'a1', name: 'Checking', type: 'checking', balance: 500, currency: 'USD', credit_limit: null, payment_date: null, institution: null }] }
    }
    return { data: [] }
  })
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('runWealthAgent', () => {
  it('sends the system prompt with the date, the tool set, prior turns and the question at low effort', async () => {
    const client = fakeClient([textResponse('Your net worth is $500.')])
    const { supabase } = db([
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'hello' },
    ])

    const result = await runWealthAgent({ supabase, userId: 'u1', chatId: 100, question: 'net worth?', now: NOW, client })

    expect(result).toEqual({ reply: 'Your net worth is $500.', loggedTransaction: false })
    const [request] = client.calls
    expect(request.maxTokens).toBe(4096)
    expect(request.effort).toBe('low')
    expect(request.tools?.map((t) => t.name)).toContain('get_accounts')
    // Static prompt first (cache-friendly), today's date at the end.
    expect(request.system.indexOf('personal wealth manager')).toBeLessThan(request.system.indexOf('2026-09-15'))
    expect(request.messages).toEqual([
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: [{ type: 'text', text: 'hello' }] },
      { role: 'user', content: 'net worth?' },
    ])
  })

  it('executes tool calls, returns all results in one user message, and loops until text', async () => {
    const client = fakeClient([
      toolUseResponse([
        { id: 'tu_1', name: 'get_accounts', input: {} },
        { id: 'tu_2', name: 'no_such_tool', input: {} },
      ]),
      textResponse('You have $500 in Checking.'),
    ])
    const { supabase } = db()

    const result = await runWealthAgent({ supabase, userId: 'u1', chatId: 100, question: 'balances?', now: NOW, client })

    expect(result.reply).toBe('You have $500 in Checking.')
    expect(client.calls).toHaveLength(2)
    const second = client.calls[1].messages
    expect(second[1]).toMatchObject({ role: 'assistant', raw: [{ marker: 'provider-parts' }] })
    expect(second[2].role).toBe('user')
    const toolResults = second[2].content as { tool_use_id: string; is_error?: boolean; content: string }[]
    expect(toolResults.map((r) => [r.tool_use_id, r.is_error ?? false])).toEqual([
      ['tu_1', false],
      ['tu_2', true],
    ])
    expect(JSON.parse(toolResults[0].content).accounts[0].name).toBe('Checking')
  })

  it('persists the question and the final answer, then prunes old turns', async () => {
    const client = fakeClient([textResponse('answer')])
    const { supabase, ops } = db()

    await runWealthAgent({ supabase, userId: 'u1', chatId: 100, question: 'q', now: NOW, client })

    const inserts = opsFor(ops, 'telegram_agent_messages', 'insert')
    expect(inserts).toHaveLength(1)
    expect(inserts[0].values).toEqual([
      { user_id: 'u1', telegram_chat_id: 100, role: 'user', content: 'q' },
      { user_id: 'u1', telegram_chat_id: 100, role: 'assistant', content: 'answer' },
    ])
    const select = opsFor(ops, 'telegram_agent_messages', 'select')[0]
    expect(filterArg(select, 'eq', 'telegram_chat_id')).toBe(100)
  })

  it('suppresses its own reply when the transaction pipeline sent a card', async () => {
    const client = fakeClient([
      toolUseResponse([{ id: 'tu_1', name: 'log_transaction', input: { text: '$12 coffee' } }]),
      textResponse('Sent you a confirmation card.'),
    ])
    const logTransaction = vi.fn(async () => {})
    const { supabase } = db()

    const result = await runWealthAgent({ supabase, userId: 'u1', chatId: 100, question: '$12 coffee', now: NOW, client, logTransaction })

    expect(logTransaction).toHaveBeenCalledWith('$12 coffee')
    expect(result).toEqual({ reply: '', loggedTransaction: true })
  })

  it('stops after the iteration cap instead of looping forever', async () => {
    const script = Array.from({ length: MAX_TOOL_ITERATIONS + 2 }, () =>
      toolUseResponse([{ id: 'tu', name: 'get_accounts', input: {} }])
    )
    const client = fakeClient(script)
    const { supabase } = db()

    const result = await runWealthAgent({ supabase, userId: 'u1', chatId: 100, question: 'loop', now: NOW, client })

    expect(client.calls).toHaveLength(MAX_TOOL_ITERATIONS)
    expect(result.reply).toMatch(/couldn't finish/i)
  })

  it('returns a plain apology on a refusal instead of reading empty content', async () => {
    const client = fakeClient([{ content: [], stopReason: 'refusal' }])
    const { supabase } = db()

    const result = await runWealthAgent({ supabase, userId: 'u1', chatId: 100, question: 'x', now: NOW, client })

    expect(result.reply).toMatch(/can't help with that/i)
  })
})
