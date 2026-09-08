// Anthropic client for the wealth-manager agent and report phrasing.
// Wrapped behind a tiny interface so the tool loop is unit-testable with a
// scripted fake instead of the SDK.

import Anthropic from '@anthropic-ai/sdk'

export const AGENT_MODEL = 'claude-opus-5'

/** Server-side refusal fallback: a safety-classifier decline is transparently
 * re-run on Anthropic's recommended fallback model. Delete these two fields
 * from every request if you'd rather see refusals directly. */
export const FALLBACK_BETAS = ['server-side-fallback-2026-07-01'] as const

export interface AgentClient {
  createMessage(
    params: Anthropic.Beta.MessageCreateParamsNonStreaming
  ): Promise<Anthropic.Beta.BetaMessage>
}

export function hasAnthropicKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY)
}

let cached: AgentClient | null = null

export function getAgentClient(): AgentClient {
  if (cached) return cached
  if (!hasAnthropicKey()) {
    throw new Error('ANTHROPIC_API_KEY is not set')
  }
  const anthropic = new Anthropic()
  cached = {
    createMessage: (params) => anthropic.beta.messages.create(params),
  }
  return cached
}
