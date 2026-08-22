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
  /** True only when a stated date genuinely cannot be disambiguated. */
  dateAmbiguous: boolean
  /** Anything the user said that doesn't fit other fields. */
  notes: string | null
  /** 'income' | 'expense' | 'transfer' — defaults to 'expense' when uncertain. */
  direction: 'income' | 'expense' | 'transfer'
  /** 0-1, the extractor's confidence in `amount` and `merchant`. */
  confidence: number
  /** Transfers only: destination account hint (e.g. "Tarjeta de crédito 4857").
   * Optional so legacy stored payloads (pre-transfer) still typecheck. */
  toAccountHint?: string | null
  /** Transfers only: amount credited to the destination when it differs from
   * `amount` (cross-currency). Positive. */
  toAmount?: number | null
  /** Transfers only: ISO currency of `toAmount`. */
  toCurrency?: string | null
}

export type ExtractorInput =
  | { kind: 'text'; text: string }
  | { kind: 'audio'; bytes: ArrayBuffer; mimeType: string }
  | { kind: 'image'; bytes: ArrayBuffer; mimeType: string; caption?: string }
  | { kind: 'pdf'; bytes: ArrayBuffer; mimeType: string; caption?: string }

const SYSTEM_PROMPT = `You extract personal-finance transactions from a single message.
Output STRICT JSON matching the response schema. Use null for missing fields.

Fields:
- amount: positive number; the transaction total. Direction (income/expense) is captured separately.
- currency: ISO 4217 (e.g. "USD", "EUR").
- merchant: where the money was spent or received.
- categoryHint: brief category guess: "Coffee", "Groceries", "Salary".
- accountHint: payment source mentioned: "Chase Visa", "Cash", "Apple Pay". On receipts, card network / bank lines like "T/C CREDOMATIC" are account hints.
- date: YYYY-MM-DD; null if not stated. "yesterday" → resolve relative to today.
- dateAmbiguous: see date rules below.
- notes: anything that doesn't fit other fields.
- direction: "expense" unless clearly income or a transfer between the user's own accounts.
- confidence: 0-1, your confidence in amount + merchant.
- toAccountHint / toAmount / toCurrency: transfers only (see transfer rules). Null otherwise.

Rules:
- Receipts may be in ANY language, commonly Spanish (El Salvador / Latin America). The amount is the grand total: labels like TOTAL, VENTA TOTAL, TOTAL A PAGAR, GRAN TOTAL. NEVER use SUB-TOTAL/SUBTOTAL, IVA (tax), or PROPINA (tip) as the amount. If both a subtotal and a total appear, use the total.
- Printed dates on Latin American receipts are DD/MM/YYYY (e.g. 10/08/2026 = 2026-08-10). US receipts use MM/DD/YYYY. Prefer DD/MM when the receipt language is Spanish or the day field exceeds 12. Always convert to YYYY-MM-DD.
- Set dateAmbiguous=true ONLY when a stated date genuinely cannot be disambiguated (both parts ≤ 12 AND language/context gives no signal, or an unclear relative phrase). When no date is stated at all, return date=null and dateAmbiguous=false.
- merchant is the business name, usually the largest text at the top of a receipt. Strip branch/location suffixes when they are clearly a location (e.g. "THE COFFEE CUP COL. MEDICA" → "The Coffee Cup"). Return normal title case, not ALL CAPS.
- currency: "$" amounts on Salvadoran receipts are USD. Infer from country/language context; null if truly unknown.
Transfer rules:
- direction="transfer" when money moves between the user's OWN accounts: bank transfer confirmations, credit-card payments from a bank account (e.g. "PAGO A TARJETAS DE CRÉDITO", "PAGO DE TARJETA", "TRANSFERENCIA ENTRE CUENTAS", "pay my visa from savings"). A credit-card payment is a transfer TO the card account, NOT an expense.
- accountHint = the SOURCE account (labels like "Desde cuenta", "Cuenta origen", "From account"). toAccountHint = the DESTINATION (labels like "Beneficiario", "Hacia", "Cuenta destino", "Tarjeta de crédito"). Include any account/card numbers shown — last digits help match the user's accounts.
- amount = what leaves the source account, in the source account's currency. toAmount/toCurrency = what arrives at the destination, when the two currencies differ; null for same-currency transfers.
- Bank apps often show both currencies with a "Tasa de cambio"/exchange-rate line (e.g. US$1,065.22 and RD$63,806.68 at RD$59.90/US$1.00). Use the rate line and account labels to assign each amount to the correct leg: a Dominican savings account ("Cuenta de Ahorros", RD$) is the DOP leg; a USD card is the USD leg. If unsure which leg is the source, still return both amounts — pick the more likely assignment and lower confidence.
- Transfers usually have no merchant or category — return null for both.
- Thermal receipts are often low-contrast, skewed, or partly cut off — read carefully. Prefer returning partial fields (amount only, merchant only) over failing. Only return null amount if no plausible total is visible.
- Never invent merchants — return null if unclear.`

const EXTRACTED_SCHEMA = {
  type: 'OBJECT',
  properties: {
    amount: { type: 'NUMBER', nullable: true },
    currency: { type: 'STRING', nullable: true },
    merchant: { type: 'STRING', nullable: true },
    categoryHint: { type: 'STRING', nullable: true },
    accountHint: { type: 'STRING', nullable: true },
    date: { type: 'STRING', nullable: true },
    dateAmbiguous: { type: 'BOOLEAN' },
    notes: { type: 'STRING', nullable: true },
    direction: { type: 'STRING', enum: ['expense', 'income', 'transfer'] },
    confidence: { type: 'NUMBER' },
    toAccountHint: { type: 'STRING', nullable: true },
    toAmount: { type: 'NUMBER', nullable: true },
    toCurrency: { type: 'STRING', nullable: true },
  },
  required: ['direction', 'confidence', 'dateAmbiguous'],
}

const MERGE_SYSTEM_PROMPT = `You are merging a user's follow-up reply into a partially-extracted personal-finance transaction.
The bot previously asked the user for a specific missing field. Given the partial transaction JSON and the user's reply, return the fully updated transaction.

Rules:
- Preserve all existing non-null fields unless the reply explicitly corrects them ("actually 4.50 not 3.75" corrects the amount).
- Short replies are answers to the question: "3.75", "it was $3.75", "coffee cup", "yesterday", "last friday".
- Set intent="new_transaction" ONLY if the reply describes a COMPLETELY DIFFERENT transaction — it mentions its own amount AND merchant unrelated to the partial one — rather than answering the question. Otherwise intent="answer".
- Dates: resolve relative phrases against today; output YYYY-MM-DD; set dateAmbiguous=false once resolved.
- amount is always positive.`

const MERGE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    intent: { type: 'STRING', enum: ['answer', 'new_transaction'] },
    extracted: EXTRACTED_SCHEMA,
  },
  required: ['intent', 'extracted'],
}

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
    finishReason?: string
  }>
  promptFeedback?: { blockReason?: string }
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
    const medium = input.kind === 'pdf' ? 'receipt or statement PDF' : 'receipt photo'
    parts.push({
      text:
        `Today is ${today}. The user sent a ${medium}` +
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

const RETRY_DELAYS_MS = [500, 1500]

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

class RetryableError extends Error {}

/**
 * Calls Gemini generateContent with retry/backoff and returns the parsed JSON
 * from the first candidate's text. Retries on network errors, 429, 5xx, empty
 * candidates, and non-JSON output; fails fast on 4xx config errors.
 * Thrown errors carry a classified cause: gemini-http-<n> | gemini-blocked-<reason>
 * | gemini-empty | gemini-nonjson.
 */
async function callGemini(body: object): Promise<unknown> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set')

  let lastError: Error = new Error('gemini-unknown')

  for (let attempt = 1; attempt <= RETRY_DELAYS_MS.length + 1; attempt++) {
    try {
      let res: Response
      try {
        res = await fetch(`${ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      } catch (netErr) {
        throw new RetryableError(
          `gemini-network: ${netErr instanceof Error ? netErr.message : String(netErr)}`
        )
      }

      if (!res.ok) {
        const errText = await res.text()
        console.error(
          `[extract-transaction] attempt ${attempt}: HTTP ${res.status} — ${errText.slice(0, 500)}`
        )
        if (res.status === 429 || res.status >= 500) {
          throw new RetryableError(`gemini-http-${res.status}`)
        }
        throw new Error(`gemini-http-${res.status}: ${errText.slice(0, 300)}`)
      }

      const json = (await res.json()) as GeminiResponse
      const blockReason = json.promptFeedback?.blockReason
      if (blockReason) {
        console.error(
          `[extract-transaction] attempt ${attempt}: blocked — ${blockReason}`
        )
        throw new Error(`gemini-blocked-${blockReason}`)
      }

      const candidate = json.candidates?.[0]
      const text = candidate?.content?.parts?.[0]?.text
      if (!text) {
        console.error(
          `[extract-transaction] attempt ${attempt}: no candidate text (finishReason=${candidate?.finishReason ?? 'none'}) — ${JSON.stringify(json).slice(0, 500)}`
        )
        throw new RetryableError('gemini-empty')
      }

      // Strip code fences just in case the model includes them.
      const cleaned = text
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/```\s*$/, '')
        .trim()

      try {
        return JSON.parse(cleaned)
      } catch {
        console.error(
          `[extract-transaction] attempt ${attempt}: non-JSON output — ${text.slice(0, 500)}`
        )
        throw new RetryableError(`gemini-nonjson: ${text.slice(0, 200)}`)
      }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      if (!(err instanceof RetryableError)) throw lastError
      const delay = RETRY_DELAYS_MS[attempt - 1]
      if (delay === undefined) break
      await sleep(delay)
    }
  }

  console.error(`[extract-transaction] all attempts failed: ${lastError.message}`)
  throw lastError
}

function coerceExtracted(parsed: Partial<ExtractedTransaction>): ExtractedTransaction {
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
    dateAmbiguous: parsed.dateAmbiguous === true,
    notes: typeof parsed.notes === 'string' ? parsed.notes : null,
    direction:
      parsed.direction === 'income' || parsed.direction === 'transfer'
        ? parsed.direction
        : 'expense',
    confidence:
      typeof parsed.confidence === 'number'
        ? Math.max(0, Math.min(1, parsed.confidence))
        : 0.5,
    toAccountHint:
      typeof parsed.toAccountHint === 'string' ? parsed.toAccountHint : null,
    toAmount:
      typeof parsed.toAmount === 'number' && parsed.toAmount > 0
        ? parsed.toAmount
        : null,
    toCurrency: typeof parsed.toCurrency === 'string' ? parsed.toCurrency : null,
  }
}

export async function extractTransaction(
  input: ExtractorInput
): Promise<ExtractedTransaction> {
  const today = new Date().toISOString().slice(0, 10)

  const body = {
    system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [buildUserContent(input, today)],
    generation_config: {
      response_mime_type: 'application/json',
      response_schema: EXTRACTED_SCHEMA,
      temperature: 0.2,
    },
  }

  const parsed = (await callGemini(body)) as Partial<ExtractedTransaction>
  return coerceExtracted(parsed)
}

export interface MergeResult {
  intent: 'answer' | 'new_transaction'
  extracted: ExtractedTransaction
}

/**
 * Merges a free-text clarification reply into a partial transaction.
 * Returns intent 'new_transaction' when the reply describes a different
 * transaction instead of answering the pending question.
 */
export async function mergeClarification(args: {
  partial: ExtractedTransaction
  missingField: 'amount' | 'merchant' | 'date'
  userReply: string
}): Promise<MergeResult> {
  const today = new Date().toISOString().slice(0, 10)

  const body = {
    system_instruction: { parts: [{ text: MERGE_SYSTEM_PROMPT }] },
    contents: [
      {
        role: 'user',
        parts: [
          {
            text:
              `Today is ${today}.\n` +
              `Partial transaction: ${JSON.stringify(args.partial)}\n` +
              `Missing field the user was asked for: ${args.missingField}\n` +
              `User reply: "${args.userReply}"`,
          },
        ],
      },
    ],
    generation_config: {
      response_mime_type: 'application/json',
      response_schema: MERGE_SCHEMA,
      temperature: 0.2,
    },
  }

  const parsed = (await callGemini(body)) as {
    intent?: string
    extracted?: Partial<ExtractedTransaction>
  }

  return {
    intent: parsed.intent === 'new_transaction' ? 'new_transaction' : 'answer',
    extracted: coerceExtracted(parsed.extracted ?? {}),
  }
}
