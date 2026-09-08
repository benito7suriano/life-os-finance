import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateReport } from '../generate'
import type { WeeklyReportData } from '../build'
import type { AgentClient, ModelRequest, ModelResponse } from '@/lib/agent/types'

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

function reply(text: string, stopReason: ModelResponse['stopReason'] = 'end_turn'): ModelResponse {
  return { content: text ? [{ type: 'text', text }] : [], stopReason }
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('generateReport', () => {
  it('asks the model to phrase the JSON data with no tools at high effort', async () => {
    const calls: ModelRequest[] = []
    const client: AgentClient = {
      async createMessage(request) {
        calls.push(request)
        return reply('<b>Weekly report</b>\nSpent $165.')
      },
    }
    const out = await generateReport(data, client)
    expect(out).toBe('<b>Weekly report</b>\nSpent $165.')
    expect(calls[0].effort).toBe('high')
    expect(calls[0].maxTokens).toBe(3000)
    expect(calls[0].tools).toBeUndefined()
    expect(calls[0].messages[0].content).toContain('"expensesUsd":165')
  })

  it('falls back to the deterministic renderer when the model errors', async () => {
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
    const refusing: AgentClient = { async createMessage() { return reply('', 'refusal') } }
    const empty: AgentClient = { async createMessage() { return reply('') } }
    expect(await generateReport(data, refusing)).toContain('<b>Weekly report</b>')
    expect(await generateReport(data, empty)).toContain('<b>Weekly report</b>')
  })
})
