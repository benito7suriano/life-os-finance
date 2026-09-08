// Inbound Telegram message handling: linking, /help, and the transaction
// intake flow (extraction → resolution → clarification or confirm card).

import {
  sendMessage,
  editMessageText,
  downloadFile,
  type TelegramMessage,
} from '@/lib/telegram/client'
import {
  extractTransaction,
  mergeClarification,
  type ExtractedTransaction,
  type ExtractorContext,
  type ExtractorInput,
} from '../extract-transaction'
import {
  closestCategory,
  resolveReferences,
  toThirdPartyExpense,
  type OptionItem,
} from '../resolve-references'
import {
  applyAnswer,
  askNextQuestion,
  computeMissingFields,
  supersedeClarifying,
} from './clarification'
import { confirmKeyboard, formatPendingSummary } from './format'
import {
  PENDING_COLUMNS,
  type ChannelInfo,
  type FinanceSupabase,
  type MissingField,
  type PendingRow,
} from './types'

interface ChannelLookup {
  id: string
  user_id: string
  status: 'connected' | 'paused' | 'disconnected'
  telegram_link_code: string | null
  telegram_link_code_expires_at: string | null
}

export async function handleMessage(
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
        '• Photo: snap a receipt or a bank transfer screen',
        '• File: a PDF or image of a receipt/statement',
        '• Transfers: "moved RD$5,000 from savings to my visa" or a payment screenshot',
        '• Paying someone by bank transfer (rent, a person, a bill) is logged as an expense to them',
        '',
        "If something's unclear I'll ask, then show a Confirm/Cancel before saving.",
      ].join('\n')
    )
    return
  }

  // Build the extractor input from whatever modality the user sent.
  const input = await buildExtractorInput(msg)
  if (!input) {
    await sendMessage(
      chatId,
      'I can read text, voice notes, photos, and PDF/image files. Try one of those!'
    )
    return
  }

  await processIncoming(supabase, channel, chatId, input)
}

/**
 * The intake brain. Routes free-text replies into an active clarification
 * when one exists; otherwise (or on a new-transaction reply) supersedes any
 * active clarification and runs a fresh extraction.
 */
export async function processIncoming(
  supabase: FinanceSupabase,
  channel: ChannelInfo,
  chatId: number,
  input: ExtractorInput
): Promise<void> {
  const nowIso = new Date().toISOString()

  // Opportunistic cleanup so expired clarifications can't block the partial
  // unique index or swallow replies.
  await supabase
    .from('pending_telegram_transactions')
    .delete()
    .lt('expires_at', nowIso)

  const { data: activeRow } = await supabase
    .from('pending_telegram_transactions')
    .select(PENDING_COLUMNS)
    .eq('telegram_chat_id', chatId)
    .eq('status', 'clarifying')
    .gt('expires_at', nowIso)
    .maybeSingle()
  const active = (activeRow as PendingRow | null) ?? null

  // Free-text reply to an active clarification question?
  if (active && input.kind === 'text') {
    const head = active.missing_fields[0]
    // After "Other…" was tapped, the reply names the category directly —
    // no extractor round-trip needed.
    if (head === 'category' && active.payload.awaitingCategoryText) {
      const handled = await handleCategoryText(supabase, active, chatId, input.text)
      if (handled) return
      // Looked like a new transaction → fall through to supersede + fresh run.
    }
    if (head === 'amount' || head === 'merchant' || head === 'date') {
      let merge
      try {
        merge = await mergeClarification({
          partial: active.payload.extracted,
          missingField: head,
          userReply: input.text,
        })
      } catch (err) {
        console.error('[telegram-webhook] merge failed', err)
        await sendMessage(
          chatId,
          '⚠️ I had trouble reading that reply. Try again in a moment.'
        )
        return
      }
      if (merge.intent === 'answer') {
        await applyAnswer(supabase, active, {
          kind: 'extracted',
          extracted: merge.extracted,
        })
        return
      }
      // intent === 'new_transaction' → fall through to supersede + fresh run.
    }
  }

  if (active) {
    await supersedeClarifying(supabase, active)
  }

  // Fresh extraction. The user's account list goes along so the model can
  // name the exact account a screen refers to and tell own-account transfers
  // from payments to somebody else.
  let extracted: ExtractedTransaction
  try {
    const { data: accountRows } = await supabase
      .from('accounts')
      .select('name, type, currency')
      .eq('user_id', channel.user_id)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
    extracted = await extractTransaction(input, {
      accounts: (accountRows ?? []) as ExtractorContext['accounts'],
    })
  } catch (err) {
    const cause = err instanceof Error ? err.message : String(err)
    console.error(`[telegram-webhook] extract failed: ${cause}`)
    await sendMessage(
      chatId,
      `⚠️ I couldn't read that${friendlyCause(cause)}. Try again, or send it as text (e.g. "$12 at Blue Bottle").`
    )
    return
  }

  let ctx = await resolveReferences(supabase, channel.user_id, extracted)

  // A "transfer" to a named payee whose destination is not clearly one of the
  // user's own accounts is a payment to that person: log it as an expense
  // from the source account, not as money moving between two of their
  // accounts.
  if (
    extracted.direction === 'transfer' &&
    extracted.counterparty &&
    !ctx.toAccountStrong
  ) {
    extracted = toThirdPartyExpense(extracted)
    ctx = await resolveReferences(supabase, channel.user_id, extracted)
  }

  if (ctx.accounts.length === 0) {
    await sendMessage(
      chatId,
      '⚠️ You don\'t have any accounts yet. Open the app and add an account first — then I can log transactions.'
    )
    return
  }

  if (extracted.direction === 'transfer' && ctx.accounts.length < 2) {
    await sendMessage(
      chatId,
      '⚠️ That looks like a transfer, but you only have one account. Add the other account in the app first — then I can log it.'
    )
    return
  }

  const missing = computeMissingFields(extracted, ctx.resolved, {
    categories: ctx.categories.length,
    accounts: ctx.accounts.length,
  })

  const clarifying = missing.length > 0
  const initialText = clarifying
    ? '🧾 Got it — one moment…'
    : formatPendingSummary(extracted, ctx.resolved)

  // Two-phase: send the card first so we have a message_id to key the row by.
  const sentMessage = (await sendMessage(chatId, initialText, {
    keyboard: clarifying
      ? undefined
      : confirmKeyboard('placeholder', extracted.direction),
  })) as { message_id: number }

  const { data: inserted, error: insertErr } = await supabase
    .from('pending_telegram_transactions')
    .insert({
      user_id: channel.user_id,
      channel_id: channel.id,
      telegram_chat_id: chatId,
      telegram_message_id: sentMessage.message_id,
      payload: {
        extracted,
        resolved: ctx.resolved,
        direction: extracted.direction,
      },
      status: clarifying ? 'clarifying' : 'confirming',
      missing_fields: missing,
    })
    .select('id')
    .single()

  if (insertErr || !inserted) {
    console.error('[telegram-webhook] pending insert failed', insertErr)
    await editMessageText(
      chatId,
      sentMessage.message_id,
      "⚠️ I extracted it but couldn't save the pending state. Try again."
    )
    return
  }

  const pending: PendingRow = {
    id: inserted.id,
    user_id: channel.user_id,
    channel_id: channel.id,
    telegram_chat_id: chatId,
    telegram_message_id: sentMessage.message_id,
    payload: {
      extracted,
      resolved: ctx.resolved,
      direction: extracted.direction,
    },
    status: clarifying ? 'clarifying' : 'confirming',
    missing_fields: missing as MissingField[],
  }

  if (clarifying) {
    await askNextQuestion(supabase, pending, {
      categories: ctx.categories,
      accounts: ctx.accounts,
      toAccounts: ctx.toAccounts,
    })
  } else {
    // Swap the placeholder keyboard for one carrying the real pending id.
    await editMessageText(chatId, sentMessage.message_id, initialText, {
      keyboard: confirmKeyboard(pending.id, extracted.direction),
    })
  }
}

/** Category names are short labels; leading amounts mean a new transaction. */
const MAX_CATEGORY_NAME_LENGTH = 60
const LEADING_AMOUNT = /^[$€£]?\s*\d+(?:[.,]\d+)?\b/

/**
 * Handles the free-text reply after the user tapped "Other…" on the category
 * card: matches the closest existing category for the direction, or queues a
 * brand-new one (created at confirm time). Returns false when the reply looks
 * like a new transaction, so the caller supersedes and re-extracts instead.
 */
async function handleCategoryText(
  supabase: FinanceSupabase,
  pending: PendingRow,
  chatId: number,
  text: string
): Promise<boolean> {
  const name = text.replace(/\s+/g, ' ').trim()

  // "$12 lunch at Subway" is a new transaction, not a category name.
  if (LEADING_AMOUNT.test(name)) return false

  if (!name || name.length > MAX_CATEGORY_NAME_LENGTH) {
    await sendMessage(
      chatId,
      name
        ? `⚠️ That's too long for a category name — try something under ${MAX_CATEGORY_NAME_LENGTH} characters.`
        : '⚠️ I need a name — reply with a short category name (e.g. "Pets").'
    )
    return true
  }

  // Match against ALL of the user's categories for this direction, not just
  // the (possibly capped) button list frozen into the card.
  const { data, error } = await supabase
    .from('categories')
    .select('id, name')
    .eq('user_id', pending.user_id)
    .eq('type', pending.payload.direction)
    .order('name', { ascending: true })
  if (error) {
    throw new Error(`categories lookup failed: ${error.message}`)
  }

  const match = closestCategory((data ?? []) as OptionItem[], name)
  await applyAnswer(
    supabase,
    pending,
    match
      ? { kind: 'choice', field: 'category', option: match }
      : { kind: 'new_category', name }
  )
  return true
}

function friendlyCause(cause: string): string {
  if (cause.includes('gemini-blocked')) return ' (the content was blocked)'
  if (cause.includes('gemini-http')) return ' (the reader service errored)'
  if (cause.includes('gemini-empty') || cause.includes('gemini-nonjson'))
    return ' (I got an unreadable response)'
  if (cause.includes('gemini-network')) return ' (network hiccup)'
  return ''
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
    await sendMessage(
      chatId,
      "I couldn't see your Telegram user. Try again from your own chat."
    )
    return
  }

  // Find the pending channel by link code. A query ERROR (missing table,
  // schema not exposed, bad credentials) must not masquerade as "unknown
  // code" — throw so the top-level handler replies "something went wrong".
  const { data: channel, error: lookupErr } = await supabase
    .from('automation_channels')
    .select(
      'id, user_id, status, telegram_link_code, telegram_link_code_expires_at'
    )
    .eq('telegram_link_code', code)
    .eq('type', 'telegram')
    .maybeSingle()

  if (lookupErr) {
    throw new Error(`link-code lookup failed: ${lookupErr.message}`)
  }

  const found = channel as ChannelLookup | null

  if (!found) {
    await sendMessage(
      chatId,
      "❌ I don't recognize that code. Generate a new one from the Automation page in the app."
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
      "⚠️ I couldn't finish linking. Try generating a new code."
    )
    return
  }

  await sendMessage(
    chatId,
    [
      "✅ Linked! You're all set.",
      '',
      'Send me a transaction to log it:',
      '• "$12 coffee at Blue Bottle"',
      '• A voice note describing the purchase',
      '• A photo of a receipt',
      '',
      "If something's unclear I'll ask, then show a Confirm/Cancel before saving.",
    ].join('\n')
  )
}

// ---------------------------------------------------------------------------
// Helpers

async function findConnectedChannelByChat(
  supabase: FinanceSupabase,
  chatId: number
): Promise<ChannelInfo | null> {
  const { data, error } = await supabase
    .from('automation_channels')
    .select('id, user_id, status')
    .eq('telegram_chat_id', chatId)
    .eq('type', 'telegram')
    .maybeSingle()
  // A query error is not "unknown chat" — surface it to the top-level handler.
  if (error) {
    throw new Error(`channel lookup failed: ${error.message}`)
  }
  return (data as ChannelInfo | null) ?? null
}

export async function buildExtractorInput(
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

  // Files sent uncompressed ("as file"): PDFs and images only.
  if (msg.document) {
    const declared = msg.document.mime_type
    const isPdf = declared === 'application/pdf'
    const isImage = declared?.startsWith('image/') ?? false
    if (!isPdf && !isImage) return null
    const file = await downloadFile(msg.document.file_id)
    return {
      kind: isPdf ? 'pdf' : 'image',
      bytes: file.bytes,
      mimeType: declared ?? file.mimeType,
      caption: msg.caption,
    }
  }

  return null
}
