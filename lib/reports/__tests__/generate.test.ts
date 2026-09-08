import { describe, it, expect, vi, beforeEach } from 'vitest'
import type Anthropic from '@anthropic-ai/sdk'
import { generateReport } from '../generate'
import type { WeeklyReportData } from '../build'
import type { AgentClient } from '@/lib/agent/client'

const data: WeeklyReportData = {
  kind: 'weekly',
  generatedAt: '2026-09-15T11:00:00.000Z',
  window: { from: '2026-09-08', to: '2026-09-14', label: 'Sep 8 – Sep 14, 2026' },
  totals: { incomeUsd: 500, expensesUsd: 165, netUsd: 335 },
  topExpenses: [],
  spendingByCategory: [],
  budget: {
    month: '2026-09',
    overall: { totalBudget: 0, spent: 165, remaining: 0, percentUsed: 0, daysRemaining: 15, projectedOverspend: 0, status: 'on_track' },
    atRisk: [],
  },
  netWorth: { current: null, previous: null, changeUsd: null, historyBeginsAt: null },
  insights: [],
}

function message(text: string, stop: Anthropic.Beta.BetaMessage['stop_reason'] = 'end_turn') {
  return {
    id: 'm',
    type: 'message',
    role: 'assistant',
    model: 'claude-opus-5',
    content: text ? [{ type: 'text', text, citations: null }] : [],
    stop_reason: stop,
    stop_sequence: null,
    usage: { input_tokens: 1, output_tokens: 1 },
  } as unknown as Anthropic.Beta.BetaMessage
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('generateReport', () => {
  it('asks Claude to phrase the JSON data with no tools at high effort', async () => {
    const calls: Anthropic.Beta.MessageCreateParamsNonStreaming[] = []
    const client: AgentClient = {
      async createMessage(params) {
        calls.push(params)
        return message('<b>Weekly report</b>\nSpent $165.')
      },
    }
    const out = await generateReport(data, client)
    expect(out).toBe('<b>Weekly report</b>\nSpent $165.')
    expect(calls[0].model).toBe('claude-opus-5')
    expect(calls[0].output_config).toEqual({ effort: 'high' })
    expect(calls[0].max_tokens).toBe(3000)
    expect(calls[0].tools).toBeUndefined()
    expect(calls[0].fallbacks).toBe('default')
    const userTurn = calls[0].messages[0].content as string
    expect(userTurn).toContain('"expensesUsd":165')
  })

  it('falls back to the deterministic renderer when Claude errors', async () => {
    const client: AgentClient = {
      async createMessage() {
        throw new Error('overloaded')
      },
    }
    const out = await generateReport(data, client)
    expect(out).toContain('<b>Weekly report</b>')
    expect(out).toContain('$165')
  })

  it('falls back on a refusal or an empty answer', async () => {
    const refusing: AgentClient = { async createMessage() { return message('', 'refusal') } }
    const empty: AgentClient = { async createMessage() { return message('') } }
    expect(await generateReport(data, refusing)).toContain('<b>Weekly report</b>')
    expect(await generateReport(data, empty)).toContain('<b>Weekly report</b>')
  })
})
