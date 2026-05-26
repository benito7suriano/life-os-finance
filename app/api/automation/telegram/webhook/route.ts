import { NextRequest, NextResponse } from 'next/server'
import { createFinanceServiceClient } from '@/lib/supabase/server'
import {
  sendMessage,
  editMessageText,
  answerCallbackQuery,
  downloadFile,
  type TelegramUpdate,
  type TelegramMessage,
  type TelegramCallbackQuery,
} from '@/lib/telegram/client'
import {
  extractTransaction,
  type ExtractedTransaction,
  type ExtractorInput,
} from '@/lib/automation/extract-transaction'
import {
  resolveReferences,
  type ResolvedReferences,
} from '@/lib/automation/resolve-references'
import type { SupabaseClient } from '@supabase/supabase-js'

// The finance-schema client narrows the second generic. We don't need
// supabase-js's type tracking inside this handler — accept any schema.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FinanceSupabase = SupabaseClient<any, any, any>

// Telegram retries on non-2xx, so we ALWAYS return 200 — errors are logged
// server-side and reported back to the user via a chat message.
function ok() {
  return NextResponse.json({ ok: true })
}

interface ChannelLookup {
  id: string
  user_id: string
  status: 'connected' | 'paused' | 'disconnected'
  telegram_link_code: string | null
  telegram_link_code_expires_at: string | null
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

  const supabase = createFinanceServiceClient()

  try {
    if (update.callback_query) {
      await handleCallback(supabase, update.callback_query)
    } else if (update.message) {
      await handleMessage(supabase, update.message)
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

// ---------------------------------------------------------------------------
// Message dispatch

async function handleMessage(
  supabase: FinanceSupabase,
  msg: TelegramMessage
) {
  const chatId = msg.chat.id
  const text = msg.text?.trim() ?? ''

  // /start <code>  → linking flow
  if (text.startsWith('/start')) {
    const code = text.slice('/start'.length).trim()
    if (code) {
      await handleLinkCode(supabase, msg, code)
    } else {
      await sendMessage(
        chatId,
        '👋 Hi! To link this chat to your ledger, open the Automation page in the app and follow the instructions to get a /start code.'
      )
    }
    return
  }

  // Look up the channel for this chat. Must already be linked.
  const channel = await findConnectedChannelByChat(supabase, chatId)
  if (!channel) {
    await sendMessage(
      chatId,
      "I don't recognize this chat. Open the Automation page in the app and send me the /start code shown there."
    )
    return
  }

  if (channel.status === 'paused') {
    await sendMessage(
      chatId,
      '⏸ Your Telegram channel is paused. Resume it in the app to start logging transactions again.'
    )
    return
  }

  // /help
  if (text === '/help') {
    await sendMessage(
      chatId,
      [
        'Send me a transaction to log it. Examples:',
        '',
        '• Text: "$12 coffee at Blue Bottle yesterday"',
        '• Voice: hold the mic button and say it',
        '• Photo: snap a receipt',
        '',
        'I\'ll parse it and show a Confirm/Cancel before saving.',
      ].join('\n')
    )
    return
  }

  // Build the extractor input from whatever modality the user sent.
  const input = await buildExtractorInput(msg)
  if (!input) {
    await sendMessage(
      chatId,
      "I can read text, voice notes, and photos. Try one of those!"
    )
    return
  }

  // Extract + resolve.
  let extracted: ExtractedTransaction
  try {
    extracted = await extractTransaction(input)
  } catch (err) {
    console.error('[telegram-webhook] extract failed', err)
    await sendMessage(
      chatId,
      '⚠️ I couldn\'t parse that. Try rephrasing or sending a clearer photo.'
    )
    return
  }

  if (!extracted.amount || !extracted.merchant) {
    await sendMessage(
      chatId,
      [
        'I couldn\'t pick out both an amount and a merchant.',
        '',
        extracted.amount ? `• Amount: $${extracted.amount}` : '• Amount: ❌ missing',
        extracted.merchant ? `• Merchant: ${extracted.merchant}` : '• Merchant: ❌ missing',
        '',
        'Try again with more detail (e.g. "$12 at Blue Bottle").',
      ].join('\n')
    )
    return
  }

  const resolved = await resolveReferences(supabase, channel.user_id, extracted)

  // Store as pending and reply with confirm/cancel.
  const summary = formatPendingSummary(extracted, resolved)

  // First, send a placeholder so we have a message_id to key the pending row by.
  const sentMessage = (await sendMessage(chatId, summary, {
    keyboard: [
      [
        { text: '✅ Confirm', callback_data: 'pending:placeholder' },
        { text: '❌ Cancel', callback_data: 'cancel:placeholder' },
      ],
    ],
  })) as { message_id: number }

  const { data: pending, error: insertErr } = await supabase
    .from('pending_telegram_transactions')
    .insert({
      user_id: channel.user_id,
      channel_id: channel.id,
      telegram_chat_id: chatId,
      telegram_message_id: sentMessage.message_id,
      payload: { extracted, resolved, direction: extracted.direction },
    })
    .select('id')
    .single()

  if (insertErr || !pending) {
    console.error('[telegram-webhook] pending insert failed', insertErr)
    await editMessageText(
      chatId,
      sentMessage.message_id,
      '⚠️ I extracted it but couldn\'t save the pending state. Try again.'
    )
    return
  }

  // Update the keyboard now that we have the pending id.
  await editMessageText(chatId, sentMessage.message_id, summary, {
    keyboard: [
      [
        { text: '✅ Confirm', callback_data: `c:${pending.id}` },
        { text: '❌ Cancel', callback_data: `x:${pending.id}` },
      ],
    ],
  })
}

// ---------------------------------------------------------------------------
// /start <code> linking

async function handleLinkCode(
  supabase: FinanceSupabase,
  msg: TelegramMessage,
  code: string
) {
  const chatId = msg.chat.id
  const tgUser = msg.from
  if (!tgUser) {
    await sendMessage(chatId, 'I couldn\'t see your Telegram user. Try again from your own chat.')
    return
  }

  // Find the pending channel by link code.
  const { data: channel } = await supabase
    .from('automation_channels')
    .select(
      'id, user_id, status, telegram_link_code, telegram_link_code_expires_at'
    )
    .eq('telegram_link_code', code)
    .eq('type', 'telegram')
    .maybeSingle()

  const found = channel as ChannelLookup | null

  if (!found) {
    await sendMessage(
      chatId,
      '❌ I don\'t recognize that code. Generate a new one from the Automation page in the app.'
    )
    return
  }

  if (
    found.telegram_link_code_expires_at &&
    new Date(found.telegram_link_code_expires_at).getTime() < Date.now()
  ) {
    await sendMessage(
      chatId,
      '⌛ That code has expired. Generate a new one from the Automation page in the app.'
    )
    return
  }

  // Bind the chat.
  const { error: updateErr } = await supabase
    .from('automation_channels')
    .update({
      status: 'connected',
      connected_at: new Date().toISOString(),
      telegram_chat_id: chatId,
      telegram_username: tgUser.username ?? null,
      telegram_link_code: null,
      telegram_link_code_expires_at: null,
    })
    .eq('id', found.id)

  if (updateErr) {
    console.error('[telegram-webhook] link failed', updateErr)
    await sendMessage(
      chatId,
      '⚠️ I couldn\'t finish linking. Try generating a new code.'
    )
    return
  }

  await sendMessage(
    chatId,
    [
      '✅ Linked! You\'re all set.',
      '',
      'Send me a transaction to log it:',
      '• "$12 coffee at Blue Bottle"',
      '• A voice note describing the purchase',
      '• A photo of a receipt',
      '',
      'I\'ll show a Confirm/Cancel before saving anything.',
    ].join('\n')
  )
}

// ---------------------------------------------------------------------------
// Callback queries (Confirm / Cancel buttons)

async function handleCallback(
  supabase: FinanceSupabase,
  cb: TelegramCallbackQuery
) {
  await answerCallbackQuery(cb.id)

  const data = cb.data ?? ''
  const [action, pendingId] = data.split(':')
  const chatId = cb.message?.chat.id
  const messageId = cb.message?.message_id
  if (!chatId || !messageId || !pendingId) return

  // Fetch pending row.
  const { data: pending } = await supabase
    .from('pending_telegram_transactions')
    .select('id, user_id, payload, telegram_chat_id')
    .eq('id', pendingId)
    .eq('telegram_chat_id', chatId)
    .maybeSingle()

  if (!pending) {
    await editMessageText(
      chatId,
      messageId,
      '⚠️ This pending transaction is no longer available (expired or already actioned).'
    )
    return
  }

  if (action === 'x') {
    await supabase
      .from('pending_telegram_transactions')
      .delete()
      .eq('id', pending.id)
    await editMessageText(chatId, messageId, '❌ Cancelled. Nothing was saved.')
    return
  }

  if (action === 'c') {
    const payload = pending.payload as {
      extracted: ExtractedTransaction
      resolved: ResolvedReferences
      direction: 'income' | 'expense'
    }
    const { extracted, resolved, direction } = payload

    if (!extracted.amount || !resolved.accountId) {
      await editMessageText(
        chatId,
        messageId,
        '⚠️ Missing required fields (amount or account). Open the app to add an account first.'
      )
      await supabase
        .from('pending_telegram_transactions')
        .delete()
        .eq('id', pending.id)
      return
    }

    const txDate =
      extracted.date && /^\d{4}-\d{2}-\d{2}$/.test(extracted.date)
        ? extracted.date
        : new Date().toISOString().slice(0, 10)

    const insertData: Record<string, unknown> = {
      user_id: pending.user_id,
      type: direction,
      date: txDate,
      description: extracted.merchant ?? 'Telegram entry',
      amount: extracted.amount,
      currency: extracted.currency ?? 'USD',
      merchant_id: resolved.merchantId,
      category_id: resolved.categoryId,
      source: 'telegram',
      source_app: 'telegram-bot',
    }
    if (direction === 'expense') {
      insertData.from_account_id = resolved.accountId
    } else {
      insertData.to_account_id = resolved.accountId
    }

    const { error: txErr } = await supabase
      .from('transactions')
      .insert(insertData)

    if (txErr) {
      console.error('[telegram-webhook] tx insert failed', txErr)
      await editMessageText(
        chatId,
        messageId,
        `⚠️ Save failed: ${txErr.message}`
      )
      return
    }

    // Update channel stats.
    const { data: ch } = await supabase
      .from('automation_channels')
      .select('id, transactions_logged')
      .eq('telegram_chat_id', chatId)
      .maybeSingle()
    if (ch) {
      await supabase
        .from('automation_channels')
        .update({
          transactions_logged: (ch.transactions_logged ?? 0) + 1,
          last_activity_at: new Date().toISOString(),
        })
        .eq('id', ch.id)
    }

    await supabase
      .from('pending_telegram_transactions')
      .delete()
      .eq('id', pending.id)

    await editMessageText(
      chatId,
      messageId,
      `✅ Saved.\n\n${formatPendingSummary(extracted, resolved, { saved: true })}`
    )
  }
}

// ---------------------------------------------------------------------------
// Helpers

async function findConnectedChannelByChat(
  supabase: FinanceSupabase,
  chatId: number
): Promise<{ id: string; user_id: string; status: ChannelLookup['status'] } | null> {
  const { data } = await supabase
    .from('automation_channels')
    .select('id, user_id, status')
    .eq('telegram_chat_id', chatId)
    .eq('type', 'telegram')
    .maybeSingle()
  return (data as { id: string; user_id: string; status: ChannelLookup['status'] } | null) ?? null
}

async function buildExtractorInput(
  msg: TelegramMessage
): Promise<ExtractorInput | null> {
  if (msg.text && !msg.text.startsWith('/')) {
    return { kind: 'text', text: msg.text }
  }

  if (msg.voice) {
    const file = await downloadFile(msg.voice.file_id)
    return {
      kind: 'audio',
      bytes: file.bytes,
      mimeType: msg.voice.mime_type ?? file.mimeType,
    }
  }

  if (msg.audio) {
    const file = await downloadFile(msg.audio.file_id)
    return {
      kind: 'audio',
      bytes: file.bytes,
      mimeType: msg.audio.mime_type ?? file.mimeType,
    }
  }

  if (msg.photo && msg.photo.length > 0) {
    // Pick the largest size.
    const largest = msg.photo.reduce((a, b) =>
      a.width * a.height >= b.width * b.height ? a : b
    )
    const file = await downloadFile(largest.file_id)
    return {
      kind: 'image',
      bytes: file.bytes,
      mimeType: file.mimeType,
      caption: msg.caption,
    }
  }

  return null
}

function formatPendingSummary(
  extracted: ExtractedTransaction,
  resolved: ResolvedReferences,
  opts?: { saved?: boolean }
): string {
  const amountStr = extracted.amount
    ? `$${extracted.amount.toFixed(2)}`
    : '(unknown)'

  const lines = [
    opts?.saved ? '' : '🧾 Confirm this transaction?',
    '',
    `**${extracted.direction === 'income' ? 'Income' : 'Expense'}** ${amountStr}`,
    `Merchant: ${extracted.merchant ?? '—'}${
      resolved.notes.merchantCreated ? ' (new)' : ''
    }`,
    `Category: ${resolved.categoryId ? '✓ matched' : extracted.categoryHint ?? '—'}`,
    `Account:  ${resolved.accountId ? '✓ ' + (resolved.notes.accountMatched ? 'matched' : 'default') : '— (no account!)'}`,
    `Date:     ${extracted.date ?? 'today'}`,
  ]
  if (extracted.notes) lines.push(`Notes:    ${extracted.notes}`)

  return lines.join('\n').trim()
}
