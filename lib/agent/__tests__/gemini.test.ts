import { describe, it, expect } from 'vitest'
import type { GenerateContentResponse } from '@google/genai'
import { fromGeminiResponse, toFunctionDeclarations, toGeminiContents, toThinkingLevel } from '../gemini'
import type { Message, ToolDefinition } from '../types'

describe('toGeminiContents', () => {
  it('maps plain user strings and text blocks to user parts', () => {
    const msgs: Message[] = [
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: [{ type: 'text', text: 'hello' }] },
      { role: 'user', content: [{ type: 'text', text: 'net worth?' }] },
    ]
    expect(toGeminiContents(msgs)).toEqual([
      { role: 'user', parts: [{ text: 'hi' }] },
      { role: 'model', parts: [{ text: 'hello' }] },
      { role: 'user', parts: [{ text: 'net worth?' }] },
    ])
  })

  it('replays the provider parts verbatim for assistant turns that carry them (thought signatures)', () => {
    const raw = [{ thoughtSignature: 'sig', functionCall: { id: 'fc_1', name: 'get_accounts', args: {} } }]
    const msgs: Message[] = [
      { role: 'user', content: 'balances?' },
      { role: 'assistant', content: [{ type: 'tool_use', id: 'fc_1', name: 'get_accounts', input: {} }], raw },
    ]
    expect(toGeminiContents(msgs)[1]).toEqual({ role: 'model', parts: raw })
  })

  it('turns tool results into functionResponse parts, resolving the name from the earlier call', () => {
    const msgs: Message[] = [
      { role: 'user', content: 'balances?' },
      {
        role: 'assistant',
        content: [
          { type: 'tool_use', id: 'fc_1', name: 'get_accounts', input: {} },
          { type: 'tool_use', id: 'gen_2', name: 'get_insights', input: {} },
        ],
      },
      {
        role: 'user',
        content: [
          { type: 'tool_result', tool_use_id: 'fc_1', content: '{"accounts":[]}' },
          { type: 'tool_result', tool_use_id: 'gen_2', content: 'boom', is_error: true },
        ],
      },
    ]
    const contents = toGeminiContents(msgs)
    expect(contents[1]).toEqual({
      role: 'model',
      parts: [
        { functionCall: { id: 'fc_1', name: 'get_accounts', args: {} } },
        { functionCall: { name: 'get_insights', args: {} } },
      ],
    })
    expect(contents[2]).toEqual({
      role: 'user',
      parts: [
        { functionResponse: { id: 'fc_1', name: 'get_accounts', response: { accounts: [] } } },
        { functionResponse: { name: 'get_insights', response: { error: 'boom' } } },
      ],
    })
  })
})

describe('toFunctionDeclarations', () => {
  it('passes the JSON schema through untouched', () => {
    const tools: ToolDefinition[] = [
      {
        name: 'query_transactions',
        description: 'Call this when…',
        input_schema: { type: 'object', properties: { limit: { type: 'integer' } }, required: [], additionalProperties: false },
      },
    ]
    expect(toFunctionDeclarations(tools)).toEqual([
      {
        name: 'query_transactions',
        description: 'Call this when…',
        parametersJsonSchema: tools[0].input_schema,
      },
    ])
  })
})

describe('toThinkingLevel', () => {
  it('maps effort to Gemini thinking levels', () => {
    expect(toThinkingLevel('low')).toBe('LOW')
    expect(toThinkingLevel('medium')).toBe('MEDIUM')
    expect(toThinkingLevel('high')).toBe('HIGH')
  })
})

function response(parts: unknown[], finishReason = 'STOP', extra: Record<string, unknown> = {}): GenerateContentResponse {
  return {
    candidates: [{ content: { role: 'model', parts }, finishReason }],
    ...extra,
  } as unknown as GenerateContentResponse
}

describe('fromGeminiResponse', () => {
  it('returns text with end_turn, skipping thought parts', () => {
    const out = fromGeminiResponse(response([{ text: 'thinking…', thought: true }, { text: 'Your net worth is $500.' }]))
    expect(out.content).toEqual([{ type: 'text', text: 'Your net worth is $500.' }])
    expect(out.stopReason).toBe('end_turn')
  })

  it('returns tool_use blocks (generating ids when Gemini omits them) and keeps the raw parts', () => {
    const parts = [
      { functionCall: { id: 'fc_9', name: 'get_accounts', args: {} }, thoughtSignature: 'sig' },
      { functionCall: { name: 'query_transactions', args: { limit: 5 } } },
    ]
    const out = fromGeminiResponse(response(parts))
    expect(out.stopReason).toBe('tool_use')
    expect(out.content[0]).toEqual({ type: 'tool_use', id: 'fc_9', name: 'get_accounts', input: {} })
    expect(out.content[1]).toMatchObject({ type: 'tool_use', name: 'query_transactions', input: { limit: 5 } })
    expect((out.content[1] as { id: string }).id).toMatch(/^gen_/)
    expect(out.raw).toBe(parts)
  })

  it('maps safety blocks and prompt blocks to refusal, and MAX_TOKENS to max_tokens', () => {
    expect(fromGeminiResponse(response([], 'SAFETY')).stopReason).toBe('refusal')
    expect(fromGeminiResponse(response([{ text: 'partial' }], 'MAX_TOKENS')).stopReason).toBe('max_tokens')
    const blocked = { promptFeedback: { blockReason: 'SAFETY' } } as unknown as GenerateContentResponse
    expect(fromGeminiResponse(blocked).stopReason).toBe('refusal')
  })
})
