import { describe, it, expect, vi, beforeEach } from 'vitest'
import type Anthropic from '@anthropic-ai/sdk'
import { mockSupabase, opsFor, filterArg } from '@/lib/test-utils/mock-supabase'
import { runWealthAgent, MAX_TOOL_ITERATIONS, type AgentClient } from '../run'

type Params = Anthropic.Beta.MessageCreateParamsNonStreaming
type Msg = Anthropic.Beta.BetaMessage

const NOW = new Date(2026, 8, 15)

function textMessage(text: string, overrides: Partial<Msg> = {}): Msg {
  return {
    id: 'msg_1',
    type: 'message',
    role: 'assistant',
    model: 'claude-opus-5',
    content: [{ type: 'text', text, citations: null }],
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: { input_tokens: 1, output_tokens: 1 } as Msg['usage'],
    ...overrides,
  } as Msg
}

function toolUseMessage(calls: { id: string; name: string; input: unknown }[]): Msg {
  return textMessage('', {
    content: calls.map((c) => ({ type: 'tool_use', id: c.id, name: c.name, input: c.input })) as Msg['content'],
    stop_reason: 'tool_use',
  })
}

/** Scripted fake client: returns the queued messages in order, records params. */
function fakeClient(script: Msg[]): AgentClient & { calls: Params[] } {
  const calls: Params[] = []
  const queue = [...script]
  return {
    calls,
    async createMessage(params) {
      calls.push(params)
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
  it('sends a cached static system prompt, the tool set, prior turns and the question', async () => {
    const client = fakeClient([textMessage('Your net worth is $500.')])
    const { supabase } = db([
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'hello' },
    ])

    const result = await runWealthAgent({ supabase, userId: 'u1', chatId: 100, question: 'net worth?', now: NOW, client })

    expect(result).toEqual({ reply: 'Your net worth is $500.', loggedTransaction: false })
    const [params] = client.calls
    expect(params.model).toBe('claude-opus-5')
    expect(params.max_tokens).toBe(4096)
    expect(params.output_config).toEqual({ effort: 'low' })
    expect(params.betas).toContain('server-side-fallback-2026-07-01')
    expect(params.fallbacks).toBe('default')
    expect(params.tools?.map((t) => (t as { name: string }).name)).toContain('get_accounts')

    const system = params.system as Anthropic.Beta.BetaTextBlockParam[]
    expect(system[0].cache_control).toEqual({ type: 'ephemeral' })
    expect(system[1].text).toContain('2026-09-15')
    expect(system[0].text).not.toContain('2026-09-15')

    expect(params.messages).toEqual([
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'hello' },
      { role: 'user', content: 'net worth?' },
    ])
  })

  it('executes tool calls, returns all results in one user message, and loops until text', async () => {
    const client = fakeClient([
      toolUseMessage([
        { id: 'tu_1', name: 'get_accounts', input: {} },
        { id: 'tu_2', name: 'no_such_tool', input: {} },
      ]),
      textMessage('You have $500 in Checking.'),
    ])
    const { supabase } = db()

    const result = await runWealthAgent({ supabase, userId: 'u1', chatId: 100, question: 'balances?', now: NOW, client })

    expect(result.reply).toBe('You have $500 in Checking.')
    expect(client.calls).toHaveLength(2)
    const second = client.calls[1].messages
    expect(second[1].role).toBe('assistant')
    const toolResults = second[2].content as Anthropic.Beta.BetaToolResultBlockParam[]
    expect(second[2].role).toBe('user')
    expect(toolResults.map((r) => [r.tool_use_id, r.is_error ?? false])).toEqual([
      ['tu_1', false],
      ['tu_2', true],
    ])
    expect(JSON.parse(toolResults[0].content as string).accounts[0].name).toBe('Checking')
  })

  it('persists the question and the final answer, then prunes old turns', async () => {
    const client = fakeClient([textMessage('answer')])
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
      toolUseMessage([{ id: 'tu_1', name: 'log_transaction', input: { text: '$12 coffee' } }]),
      textMessage('Sent you a confirmation card.'),
    ])
    const logTransaction = vi.fn(async () => {})
    const { supabase } = db()

    const result = await runWealthAgent({ supabase, userId: 'u1', chatId: 100, question: '$12 coffee', now: NOW, client, logTransaction })

    expect(logTransaction).toHaveBeenCalledWith('$12 coffee')
    expect(result).toEqual({ reply: '', loggedTransaction: true })
  })

  it('stops after the iteration cap instead of looping forever', async () => {
    const script = Array.from({ length: MAX_TOOL_ITERATIONS + 2 }, () =>
      toolUseMessage([{ id: 'tu', name: 'get_accounts', input: {} }])
    )
    const client = fakeClient(script)
    const { supabase } = db()

    const result = await runWealthAgent({ supabase, userId: 'u1', chatId: 100, question: 'loop', now: NOW, client })

    expect(client.calls).toHaveLength(MAX_TOOL_ITERATIONS)
    expect(result.reply).toMatch(/couldn't finish/i)
  })

  it('returns a plain apology on a refusal instead of reading empty content', async () => {
    const client = fakeClient([textMessage('', { content: [], stop_reason: 'refusal' })])
    const { supabase } = db()

    const result = await runWealthAgent({ supabase, userId: 'u1', chatId: 100, question: 'x', now: NOW, client })

    expect(result.reply).toMatch(/can't help with that/i)
  })
})
