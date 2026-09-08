// The wealth-manager conversation: a manual tool loop over the read-only
// tools, with per-chat memory of prior text turns. Tool calls and results are
// not persisted — every question re-fetches fresh data.

import type Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'
import { AGENT_MODEL, FALLBACK_BETAS, getAgentClient, type AgentClient } from './client'
import { buildSystemBlocks } from './system-prompt'
import { TOOL_DEFINITIONS, executeTool, type ToolContext } from './tools'
import { reportTimezone } from '@/lib/reports/schedule'

export type { AgentClient } from './client'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FinanceSupabase = SupabaseClient<any, any, any>

export const MAX_TOOL_ITERATIONS = 8
const HISTORY_TURNS = 20
const HISTORY_KEEP = 50
const MAX_TOKENS = 4096

export const REFUSAL_REPLY = "I can't help with that one. Ask me about your accounts, spending, budgets or net worth."
const ITERATION_CAP_REPLY = "I couldn't finish working that out — try asking a narrower question."
const EMPTY_REPLY = "I didn't get an answer back. Try again in a moment."

export interface RunAgentInput {
  supabase: FinanceSupabase
  userId: string
  chatId: number
  question: string
  now?: Date
  timeZone?: string
  /** Injected in tests; defaults to the real Anthropic client. */
  client?: AgentClient
  logTransaction?: ToolContext['logTransaction']
}

export interface RunAgentResult {
  /** Telegram-HTML reply. Empty when the transaction pipeline already replied. */
  reply: string
  loggedTransaction: boolean
}

export async function runWealthAgent(input: RunAgentInput): Promise<RunAgentResult> {
  const now = input.now ?? new Date()
  const client = input.client ?? getAgentClient()
  const ctx: ToolContext = {
    supabase: input.supabase,
    userId: input.userId,
    now,
    logTransaction: input.logTransaction,
  }

  const history = await loadHistory(input.supabase, input.chatId)
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    ...history,
    { role: 'user', content: input.question },
  ]

  let loggedTransaction = false
  let reply: string | null = null

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const response = await client.createMessage({
      model: AGENT_MODEL,
      max_tokens: MAX_TOKENS,
      output_config: { effort: 'low' },
      betas: [...FALLBACK_BETAS],
      fallbacks: 'default',
      system: buildSystemBlocks(now, input.timeZone ?? reportTimezone()),
      tools: TOOL_DEFINITIONS,
      messages,
    })

    if (response.stop_reason === 'refusal') {
      reply = REFUSAL_REPLY
      break
    }

    const toolUses = response.content.filter(
      (b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use'
    )
    if (response.stop_reason !== 'tool_use' || toolUses.length === 0) {
      reply = textOf(response.content) || EMPTY_REPLY
      break
    }

    messages.push({ role: 'assistant', content: response.content })

    // Run every requested tool concurrently and return ALL results in one
    // user turn — splitting them teaches the model to stop parallelising.
    const results = await Promise.all(
      toolUses.map(async (tu): Promise<Anthropic.Beta.BetaToolResultBlockParam> => {
        try {
          const output = await executeTool(tu.name, tu.input, ctx)
          if (tu.name === 'log_transaction') loggedTransaction = true
          return { type: 'tool_result', tool_use_id: tu.id, content: JSON.stringify(output) }
        } catch (err) {
          console.error(`[wealth-agent] tool ${tu.name} failed`, err)
          const message = err instanceof Error ? err.message : String(err)
          return { type: 'tool_result', tool_use_id: tu.id, content: message, is_error: true }
        }
      })
    )
    messages.push({ role: 'user', content: results })
  }

  if (reply === null) reply = ITERATION_CAP_REPLY

  // The confirmation card IS the reply when a transaction was handed off.
  if (loggedTransaction) reply = ''

  await persistTurn(input, reply)
  return { reply, loggedTransaction }
}

function textOf(content: Anthropic.Beta.BetaContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim()
}

async function loadHistory(
  supabase: FinanceSupabase,
  chatId: number
): Promise<Anthropic.Beta.BetaMessageParam[]> {
  const { data, error } = await supabase
    .from('telegram_agent_messages')
    .select('role, content')
    .eq('telegram_chat_id', chatId)
    .order('created_at', { ascending: false })
    .limit(HISTORY_TURNS)
  if (error) {
    console.error('[wealth-agent] history load failed', error)
    return []
  }
  const rows = ((data ?? []) as { role: 'user' | 'assistant'; content: string }[]).reverse()
  // The API requires the first message to be a user turn.
  const firstUser = rows.findIndex((r) => r.role === 'user')
  if (firstUser < 0) return []
  return rows.slice(firstUser).map((r) => ({ role: r.role, content: r.content }))
}

async function persistTurn(input: RunAgentInput, reply: string): Promise<void> {
  const base = { user_id: input.userId, telegram_chat_id: input.chatId }
  const rows = [
    { ...base, role: 'user', content: input.question },
    ...(reply ? [{ ...base, role: 'assistant', content: reply }] : []),
  ]
  const { error } = await input.supabase.from('telegram_agent_messages').insert(rows)
  if (error) {
    console.error('[wealth-agent] history insert failed', error)
    return
  }
  // Keep the newest HISTORY_KEEP rows per chat; delete anything older.
  const { data: stale } = await input.supabase
    .from('telegram_agent_messages')
    .select('id')
    .eq('telegram_chat_id', input.chatId)
    .order('created_at', { ascending: false })
    .range(HISTORY_KEEP, HISTORY_KEEP + 999)
  const ids = ((stale ?? []) as { id: string }[]).map((r) => r.id)
  if (ids.length > 0) {
    await input.supabase.from('telegram_agent_messages').delete().in('id', ids)
  }
}
