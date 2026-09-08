// Gemini implementation of AgentClient over @google/genai generateContent.
// The pure translators are exported for tests.

import {
  FinishReason,
  GoogleGenAI,
  ThinkingLevel,
  type Content,
  type FunctionDeclaration,
  type GenerateContentResponse,
  type Part,
} from '@google/genai'
import type {
  AgentClient,
  AssistantBlock,
  Effort,
  Message,
  ModelResponse,
  StopReason,
  ToolDefinition,
} from './types'

/** Ids we mint when Gemini omits one; never echoed back to the API. */
const GENERATED_ID_PREFIX = 'gen_'

export function toFunctionDeclarations(tools: ToolDefinition[]): FunctionDeclaration[] {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    parametersJsonSchema: t.input_schema,
  }))
}

export function toThinkingLevel(effort: Effort): ThinkingLevel {
  switch (effort) {
    case 'low':
      return ThinkingLevel.LOW
    case 'medium':
      return ThinkingLevel.MEDIUM
    case 'high':
      return ThinkingLevel.HIGH
  }
}

function withId(id: string): { id?: string } {
  return id.startsWith(GENERATED_ID_PREFIX) ? {} : { id }
}

/** Gemini wants an object in functionResponse.response — unwrap our JSON
 * string, or wrap non-object results / error text. */
function toResponseObject(content: string, isError: boolean | undefined): Record<string, unknown> {
  if (isError) return { error: content }
  try {
    const parsed: unknown = JSON.parse(content)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>
    return { result: parsed }
  } catch {
    return { output: content }
  }
}

export function toGeminiContents(messages: Message[]): Content[] {
  // tool_result blocks only carry the call id; Gemini needs the function name.
  const callNames = new Map<string, string>()
  for (const m of messages) {
    if (m.role !== 'assistant') continue
    for (const b of m.content) if (b.type === 'tool_use') callNames.set(b.id, b.name)
  }

  return messages.map((m): Content => {
    if (m.role === 'assistant') {
      if (m.raw) return { role: 'model', parts: m.raw as Part[] }
      return {
        role: 'model',
        parts: m.content.map((b): Part =>
          b.type === 'text'
            ? { text: b.text }
            : { functionCall: { ...withId(b.id), name: b.name, args: b.input } }
        ),
      }
    }
    if (typeof m.content === 'string') return { role: 'user', parts: [{ text: m.content }] }
    return {
      role: 'user',
      parts: m.content.map((b): Part =>
        b.type === 'text'
          ? { text: b.text }
          : {
              functionResponse: {
                ...withId(b.tool_use_id),
                name: callNames.get(b.tool_use_id) ?? b.tool_use_id,
                response: toResponseObject(b.content, b.is_error),
              },
            }
      ),
    }
  })
}

const REFUSAL_REASONS = new Set<string>([
  FinishReason.SAFETY,
  FinishReason.PROHIBITED_CONTENT,
  FinishReason.BLOCKLIST,
  FinishReason.SPII,
  FinishReason.RECITATION,
])

export function fromGeminiResponse(response: GenerateContentResponse): ModelResponse {
  if (response.promptFeedback?.blockReason) {
    return { content: [], stopReason: 'refusal' }
  }
  const candidate = response.candidates?.[0]
  const parts = candidate?.content?.parts ?? []

  const content: AssistantBlock[] = []
  parts.forEach((p, i) => {
    if (p.thought) return
    if (p.functionCall) {
      const name = p.functionCall.name ?? 'unknown'
      content.push({
        type: 'tool_use',
        id: p.functionCall.id ?? `${GENERATED_ID_PREFIX}${i}_${name}`,
        name,
        input: p.functionCall.args ?? {},
      })
    } else if (p.text) {
      content.push({ type: 'text', text: p.text })
    }
  })

  let stopReason: StopReason = 'end_turn'
  if (content.some((b) => b.type === 'tool_use')) stopReason = 'tool_use'
  else if (candidate?.finishReason === FinishReason.MAX_TOKENS) stopReason = 'max_tokens'
  else if (candidate?.finishReason && REFUSAL_REASONS.has(candidate.finishReason)) stopReason = 'refusal'

  return { content, stopReason, raw: parts }
}

export function createGeminiClient(apiKey: string, model: string): AgentClient {
  // Gemini returns 503 "high demand" / 504 deadline errors under load; retry
  // transient failures with backoff instead of surfacing "hit a snag". The
  // budget is deliberately bounded (≤ ~3.5 min worst case) so a bad day still
  // fits inside the webhook's maxDuration and the user isn't left hanging.
  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      timeout: 60_000,
      retryOptions: { attempts: 3, initialDelay: 2_000, maxDelay: 10_000, httpStatusCodes: [408, 429, 500, 502, 503, 504] },
    },
  })
  return {
    async createMessage(request) {
      const response = await ai.models.generateContent({
        model,
        contents: toGeminiContents(request.messages),
        config: {
          systemInstruction: request.system,
          tools: request.tools?.length ? [{ functionDeclarations: toFunctionDeclarations(request.tools) }] : undefined,
          maxOutputTokens: request.maxTokens,
          thinkingConfig: { thinkingLevel: toThinkingLevel(request.effort) },
        },
      })
      return fromGeminiResponse(response)
    },
  }
}
