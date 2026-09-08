// Telegram webhook — thin dispatcher. All handling logic lives in
// lib/automation/telegram/* so it can be unit-tested.

import { NextRequest, NextResponse, after } from 'next/server'
import { createFinanceServiceClient } from '@/lib/supabase/server'
import { sendMessage, type TelegramUpdate } from '@/lib/telegram/client'
import { handleMessage } from '@/lib/automation/telegram/handle-message'
import { handleCallback } from '@/lib/automation/telegram/handle-callback'

// Agent answers and on-demand reports run in after() once the 200 is sent;
// they need more than the default function timeout. (Requires fluid compute;
// drop to 60 if the project runs classic functions on the Hobby plan.)
export const maxDuration = 300

// Telegram retries on non-2xx, so we ALWAYS return 200 — errors are logged
// server-side and reported back to the user via a chat message.
function ok() {
  return NextResponse.json({ ok: true })
}

// Best-effort dedupe of redelivered updates within one warm instance.
const SEEN_TTL_MS = 5 * 60_000
const seenUpdates = new Map<number, number>()

function alreadySeen(updateId: number): boolean {
  const now = Date.now()
  for (const [id, at] of seenUpdates) {
    if (now - at > SEEN_TTL_MS) seenUpdates.delete(id)
  }
  if (seenUpdates.has(updateId)) return true
  seenUpdates.set(updateId, now)
  return false
}

export async function POST(request: NextRequest) {
  // 1. Verify Telegram secret token.
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET
  if (!expected) {
    console.error('[telegram-webhook] TELEGRAM_WEBHOOK_SECRET not configured')
    return ok()
  }
  const provided = request.headers.get('x-telegram-bot-api-secret-token')
  if (provided !== expected) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let update: TelegramUpdate
  try {
    update = (await request.json()) as TelegramUpdate
  } catch {
    return ok()
  }

  if (typeof update.update_id === 'number' && alreadySeen(update.update_id)) {
    return ok()
  }

  const supabase = createFinanceServiceClient()

  try {
    if (update.callback_query) {
      await handleCallback(supabase, update.callback_query)
    } else if (update.message) {
      await handleMessage(supabase, update.message, { defer: after })
    }
  } catch (err) {
    console.error('[telegram-webhook] handler error', err)
    // Best-effort error notification to the user.
    const chatId =
      update.message?.chat.id ?? update.callback_query?.message?.chat.id
    if (chatId) {
      try {
        await sendMessage(
          chatId,
          '⚠️ Something went wrong on my end. Try again in a moment.'
        )
      } catch {
        // swallow — we still want to ack the webhook
      }
    }
  }

  return ok()
}
