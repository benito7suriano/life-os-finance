// The model phrases the deterministic report data as a Telegram HTML message.
// Any failure (API error, refusal, empty answer) falls back to the plain
// renderer so a report always goes out.

import { getAgentClient, hasAgentKey, type AgentClient } from '@/lib/agent/client'
import type { ReportData } from './build'
import { renderPlainReport } from './render'

const REPORT_SYSTEM_PROMPT = `You write short personal-finance reports for one client, delivered as a single Telegram message.

Rules
- Use ONLY the numbers in the JSON you are given. Never invent, estimate or extrapolate a figure that isn't there; if a section has no data, skip it.
- Output Telegram HTML only: <b>, <i>, <code>, <pre>. No Markdown, no headings with #, no bullet walls. Escape literal &, < and > as &amp; &lt; &gt;.
- Start with a one-line title in <b> naming the report and period, then the headline numbers (spent, earned, net), then the two or three things worth knowing this period. Tables (categories, biggest expenses) go inside <pre></pre> as fixed-width columns, numbers right-aligned, exactly one line per row (abbreviate names to fit), no wider than ~36 characters per line.
- Keep it under 2,500 characters. Warm, direct, no filler and no sign-off. Whole dollars unless cents matter.
- If the JSON says net-worth history begins after the period start, say so in one clause rather than inventing a comparison.
- Do not give investment advice; observations about the client's own numbers are fine.`

const MAX_TOKENS = 3000

export async function generateReport(data: ReportData, client?: AgentClient): Promise<string> {
  const fallback = () => renderPlainReport(data)
  if (!client && !hasAgentKey()) return fallback()

  try {
    const response = await (client ?? getAgentClient()).createMessage({
      system: REPORT_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Write the ${data.kind} report for ${data.window.label} from this data:\n${JSON.stringify(data)}`,
        },
      ],
      maxTokens: MAX_TOKENS,
      effort: 'high',
    })

    if (response.stopReason === 'refusal') return fallback()

    const text = response.content
      .filter((b): b is Extract<(typeof response.content)[number], { type: 'text' }> => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .replace(/^```(?:html)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim()
    return text || fallback()
  } catch (err) {
    console.error('[reports] model phrasing failed, using plain renderer', err)
    return fallback()
  }
}
