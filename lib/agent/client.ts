// Model client for the wealth-manager agent and report phrasing. Gemini 3.8
// Flash, reusing the GEMINI_API_KEY that already powers receipt extraction.
// The tool loop only depends on the AgentClient interface, so tests inject a
// scripted fake and a provider swap touches this file + one adapter.

import { createGeminiClient } from './gemini'
import type { AgentClient } from './types'

export type { AgentClient } from './types'

export const DEFAULT_AGENT_MODEL = 'gemini-3.8-flash'

/** Override with GEMINI_AGENT_MODEL to swap models without a deploy. */
export function agentModel(): string {
  return process.env.GEMINI_AGENT_MODEL || DEFAULT_AGENT_MODEL
}

export function hasAgentKey(): boolean {
  return Boolean(process.env.GEMINI_API_KEY)
}

let cached: AgentClient | null = null

export function getAgentClient(): AgentClient {
  if (cached) return cached
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set')
  cached = createGeminiClient(apiKey, agentModel())
  return cached
}
