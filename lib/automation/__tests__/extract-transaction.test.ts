import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  extractTransaction,
  mergeClarification,
  type ExtractedTransaction,
} from '../extract-transaction'

const SAMPLE: ExtractedTransaction = {
  amount: 3.75,
  currency: 'USD',
  merchant: 'The Coffee Cup',
  categoryHint: 'Coffee',
  accountHint: 'Credomatic',
  date: '2026-08-10',
  dateAmbiguous: false,
  notes: null,
  direction: 'expense',
  confidence: 0.9,
}

function geminiOk(payload: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }],
    }),
    text: async () => '',
  } as unknown as Response
}

function geminiHttpError(status: number) {
  return {
    ok: false,
    status,
    json: async () => ({}),
    text: async () => `error ${status}`,
  } as unknown as Response
}

function geminiEmpty() {
  return {
    ok: true,
    status: 200,
    json: async () => ({ candidates: [{ finishReason: 'MAX_TOKENS' }] }),
    text: async () => '',
  } as unknown as Response
}

describe('extractTransaction', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.useFakeTimers()
    process.env.GEMINI_API_KEY = 'test-key'
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('parses schema output and sends response_schema + receipt rules', async () => {
    fetchMock.mockResolvedValueOnce(geminiOk(SAMPLE))

    const result = await extractTransaction({ kind: 'text', text: 'coffee 3.75' })

    expect(result.amount).toBe(3.75)
    expect(result.merchant).toBe('The Coffee Cup')
    expect(result.dateAmbiguous).toBe(false)

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string)
    expect(body.generation_config.response_schema).toBeDefined()
    expect(body.generation_config.response_schema.type).toBe('OBJECT')
    expect(body.system_instruction.parts[0].text).toContain('VENTA TOTAL')
    expect(body.system_instruction.parts[0].text).toContain('DD/MM/YYYY')
  })

  it('strips accidental code fences', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: '```json\n' + JSON.stringify(SAMPLE) + '\n```' }],
            },
          },
        ],
      }),
      text: async () => '',
    } as unknown as Response)

    const result = await extractTransaction({ kind: 'text', text: 'x' })
    expect(result.amount).toBe(3.75)
  })

  it('retries on 500 then succeeds', async () => {
    fetchMock
      .mockResolvedValueOnce(geminiHttpError(500))
      .mockResolvedValueOnce(geminiOk(SAMPLE))

    const promise = extractTransaction({ kind: 'text', text: 'x' })
    await vi.runAllTimersAsync()
    const result = await promise

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result.amount).toBe(3.75)
  })

  it('retries on network error then succeeds', async () => {
    fetchMock
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValueOnce(geminiOk(SAMPLE))

    const promise = extractTransaction({ kind: 'text', text: 'x' })
    await vi.runAllTimersAsync()
    const result = await promise

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result.merchant).toBe('The Coffee Cup')
  })

  it('does not retry on 400 and throws a classified cause', async () => {
    fetchMock.mockResolvedValue(geminiHttpError(400))

    await expect(
      extractTransaction({ kind: 'text', text: 'x' })
    ).rejects.toThrow(/gemini-http-400/)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('retries empty candidates then throws gemini-empty', async () => {
    fetchMock.mockResolvedValue(geminiEmpty())

    const promise = extractTransaction({ kind: 'text', text: 'x' })
    const assertion = expect(promise).rejects.toThrow(/gemini-empty/)
    await vi.runAllTimersAsync()
    await assertion
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('throws gemini-blocked without retrying', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ promptFeedback: { blockReason: 'SAFETY' } }),
      text: async () => '',
    } as unknown as Response)

    await expect(
      extractTransaction({ kind: 'text', text: 'x' })
    ).rejects.toThrow(/gemini-blocked-SAFETY/)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('mergeClarification', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    process.env.GEMINI_API_KEY = 'test-key'
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('merges an answer and preserves other fields', async () => {
    const partial = { ...SAMPLE, amount: null }
    fetchMock.mockResolvedValueOnce(
      geminiOk({ intent: 'answer', extracted: { ...partial, amount: 4.5 } })
    )

    const result = await mergeClarification({
      partial,
      missingField: 'amount',
      userReply: '4.50',
    })

    expect(result.intent).toBe('answer')
    expect(result.extracted.amount).toBe(4.5)
    expect(result.extracted.merchant).toBe('The Coffee Cup')

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string)
    expect(body.contents[0].parts[0].text).toContain('Missing field')
    expect(body.contents[0].parts[0].text).toContain('amount')
  })

  it('passes through new_transaction intent', async () => {
    fetchMock.mockResolvedValueOnce(
      geminiOk({ intent: 'new_transaction', extracted: SAMPLE })
    )

    const result = await mergeClarification({
      partial: { ...SAMPLE, amount: null },
      missingField: 'amount',
      userReply: '$20 lunch at Subway',
    })

    expect(result.intent).toBe('new_transaction')
  })
})
