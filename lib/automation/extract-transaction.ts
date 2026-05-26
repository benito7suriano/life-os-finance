// Gemini-powered transaction extractor.
// Takes text, audio, or image input and returns a structured ExtractedTransaction.
// Calls the Gemini REST API directly — no SDK dependency.

const MODEL = 'gemini-2.5-flash'
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`

export interface ExtractedTransaction {
  /** Positive number. */
  amount: number | null
  /** ISO currency code, e.g. "USD". Falls back to user default if null. */
  currency: string | null
  /** Free-text merchant name as the user said/wrote it. */
  merchant: string | null
  /** Free-text category hint (e.g. "Coffee", "Groceries"). */
  categoryHint: string | null
  /** Free-text account hint (e.g. "Chase Visa", "Cash"). */
  accountHint: string | null
  /** ISO date (YYYY-MM-DD) — null if not stated. */
  date: string | null
  /** Anything the user said that doesn't fit other fields. */
  notes: string | null
  /** 'income' | 'expense' — defaults to 'expense' when uncertain. */
  direction: 'income' | 'expense'
  /** 0-1, the extractor's confidence in `amount` and `merchant`. */
  confidence: number
}

export type ExtractorInput =
  | { kind: 'text'; text: string }
  | { kind: 'audio'; bytes: ArrayBuffer; mimeType: string }
  | { kind: 'image'; bytes: ArrayBuffer; mimeType: string; caption?: string }

const SYSTEM_PROMPT = `You extract personal-finance transactions from a single message.
Output STRICT JSON matching this TypeScript type. Use null for missing fields.

{
  "amount": number | null,            // positive; the transaction total
  "currency": string | null,          // ISO 4217 (e.g. "USD", "EUR")
  "merchant": string | null,          // where the money was spent or received
  "categoryHint": string | null,      // brief category guess: "Coffee", "Groceries", "Salary"
  "accountHint": string | null,       // payment source mentioned: "Chase Visa", "Cash", "Apple Pay"
  "date": string | null,              // YYYY-MM-DD; null if not stated. "yesterday" → resolve relative to today.
  "notes": string | null,             // anything that doesn't fit other fields
  "direction": "expense" | "income",  // default "expense" unless clearly income
  "confidence": number                // 0-1, your confidence in amount + merchant
}

Rules:
- amount is always positive. Direction (income/expense) is captured separately.
- For receipt photos, prefer the TOTAL, not subtotal.
- If date is ambiguous, use null. Don't guess.
- Never invent merchants — return null if unclear.
- Output ONLY the JSON object, no markdown fences, no commentary.`

interface GeminiPart {
  text?: string
  inline_data?: { mime_type: string; data: string }
}

interface GeminiContent {
  role?: string
  parts: GeminiPart[]
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> }
  }>
}

function bytesToBase64(bytes: ArrayBuffer): string {
  // Avoid btoa(String.fromCharCode(...)) recursion issues on large buffers.
  const buf = Buffer.from(new Uint8Array(bytes))
  return buf.toString('base64')
}

function buildUserContent(input: ExtractorInput, today: string): GeminiContent {
  const parts: GeminiPart[] = []

  if (input.kind === 'text') {
    parts.push({
      text: `Today is ${today}. Extract the transaction from this message:\n\n${input.text}`,
    })
  } else if (input.kind === 'audio') {
    parts.push({
      text: `Today is ${today}. The user sent a voice note describing a transaction. Transcribe and extract.`,
    })
    parts.push({
      inline_data: {
        mime_type: input.mimeType,
        data: bytesToBase64(input.bytes),
      },
    })
  } else {
    parts.push({
      text:
        `Today is ${today}. The user sent a receipt photo` +
        (input.caption ? ` with caption: "${input.caption}".` : '.') +
        ' Extract the transaction.',
    })
    parts.push({
      inline_data: {
        mime_type: input.mimeType,
        data: bytesToBase64(input.bytes),
      },
    })
  }

  return { role: 'user', parts }
}

function parseJsonResponse(raw: string): ExtractedTransaction {
  // Strip code fences just in case the model includes them.
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '')
    .trim()

  let parsed: Partial<ExtractedTransaction>
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    throw new Error(`Gemini returned non-JSON: ${raw.slice(0, 200)}`)
  }

  return {
    amount:
      typeof parsed.amount === 'number' && parsed.amount > 0
        ? parsed.amount
        : null,
    currency: typeof parsed.currency === 'string' ? parsed.currency : null,
    merchant: typeof parsed.merchant === 'string' ? parsed.merchant : null,
    categoryHint:
      typeof parsed.categoryHint === 'string' ? parsed.categoryHint : null,
    accountHint:
      typeof parsed.accountHint === 'string' ? parsed.accountHint : null,
    date: typeof parsed.date === 'string' ? parsed.date : null,
    notes: typeof parsed.notes === 'string' ? parsed.notes : null,
    direction: parsed.direction === 'income' ? 'income' : 'expense',
    confidence:
      typeof parsed.confidence === 'number'
        ? Math.max(0, Math.min(1, parsed.confidence))
        : 0.5,
  }
}

export async function extractTransaction(
  input: ExtractorInput
): Promise<ExtractedTransaction> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set')

  const today = new Date().toISOString().slice(0, 10)

  const body = {
    system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [buildUserContent(input, today)],
    generation_config: {
      response_mime_type: 'application/json',
      temperature: 0.2,
    },
  }

  const res = await fetch(`${ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Gemini error ${res.status}: ${errText.slice(0, 300)}`)
  }

  const json = (await res.json()) as GeminiResponse
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) {
    throw new Error(`Gemini returned no text: ${JSON.stringify(json).slice(0, 200)}`)
  }

  return parseJsonResponse(text)
}
