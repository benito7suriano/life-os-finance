import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../client', () => ({
  sendMessage: vi.fn(async () => ({ message_id: 1 })),
}))

import { sendMessage } from '../client'
import { sendHtml, stripHtml } from '../send-html'

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('stripHtml', () => {
  it('drops tags and unescapes entities', () => {
    expect(stripHtml('<b>Spent</b> $1 &amp; &lt;more&gt;\n<pre>a  b</pre>')).toBe('Spent $1 & <more>\na  b')
  })
})

describe('sendHtml', () => {
  it('splits long messages and sends each chunk in HTML mode', async () => {
    const html = Array.from({ length: 100 }, () => 'x'.repeat(45)).join('\n')
    const chunks = await sendHtml(100, html)
    expect(chunks).toBe(2)
    expect(sendMessage).toHaveBeenCalledTimes(2)
    expect(vi.mocked(sendMessage).mock.calls[0][2]).toEqual({ parseMode: 'HTML' })
  })

  it('resends a chunk as plain text when Telegram rejects the markup', async () => {
    vi.mocked(sendMessage).mockRejectedValueOnce(new Error("Telegram sendMessage failed: Bad Request: can't parse entities: Unsupported start tag"))
    await sendHtml(100, '<b>ok</b> <span>bad</span>')
    expect(sendMessage).toHaveBeenCalledTimes(2)
    expect(vi.mocked(sendMessage).mock.calls[1]).toEqual([100, 'ok bad'])
  })

  it('propagates other send failures', async () => {
    vi.mocked(sendMessage).mockRejectedValueOnce(new Error('Telegram sendMessage failed: 429'))
    await expect(sendHtml(100, '<b>hi</b>')).rejects.toThrow('429')
  })
})
