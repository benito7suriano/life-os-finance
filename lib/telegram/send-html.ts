// Sends a Telegram-HTML message, splitting at the 4096-char cap. If Telegram
// rejects the markup (a model-written tag it doesn't support), the chunk is
// resent as plain text rather than lost.

import { sendMessage } from './client'
import { splitMessage } from './html'

const PARSE_ERROR = /can't parse entities|can't find end of the entity|unsupported start tag/i

export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

/** Returns the number of messages sent. */
export async function sendHtml(chatId: number, html: string): Promise<number> {
  const chunks = splitMessage(html)
  for (const chunk of chunks) {
    try {
      await sendMessage(chatId, chunk, { parseMode: 'HTML' })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (!PARSE_ERROR.test(message)) throw err
      console.error('[telegram] HTML rejected, resending as plain text:', message)
      await sendMessage(chatId, stripHtml(chunk))
    }
  }
  return chunks.length
}
