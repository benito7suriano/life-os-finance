// Provider-neutral message model for the wealth-manager agent. The tool loop
// (run.ts) and report phrasing (lib/reports/generate.ts) speak only these
// shapes; lib/agent/gemini.ts translates them to the Gemini SDK.

export interface ToolDefinition {
  name: string
  description: string
  /** JSON Schema for the tool's input object. */
  input_schema: Record<string, unknown>
}

export interface TextBlock {
  type: 'text'
  text: string
}

export interface ToolUseBlock {
  type: 'tool_use'
  id: string
  name: string
  input: Record<string, unknown>
}

export interface ToolResultBlock {
  type: 'tool_result'
  tool_use_id: string
  /** JSON string of the tool output, or an error message when is_error. */
  content: string
  is_error?: boolean
}

export type AssistantBlock = TextBlock | ToolUseBlock
export type UserBlock = TextBlock | ToolResultBlock

export type Message =
  | { role: 'user'; content: string | UserBlock[] }
  | {
      role: 'assistant'
      content: AssistantBlock[]
      /** Provider-native parts for lossless replay (e.g. Gemini thought
       * signatures). Opaque to everything except the adapter that set it. */
      raw?: unknown
    }

export type Effort = 'low' | 'medium' | 'high'

export interface ModelRequest {
  system: string
  messages: Message[]
  tools?: ToolDefinition[]
  maxTokens: number
  effort: Effort
}

export type StopReason = 'end_turn' | 'tool_use' | 'max_tokens' | 'refusal'

export interface ModelResponse {
  content: AssistantBlock[]
  stopReason: StopReason
  raw?: unknown
}

export interface AgentClient {
  createMessage(request: ModelRequest): Promise<ModelResponse>
}
