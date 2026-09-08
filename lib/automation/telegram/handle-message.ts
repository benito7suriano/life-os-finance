// Inbound Telegram message handling: linking, /help, /report, the wealth-
// manager agent for questions, and the transaction intake flow (extraction →
// resolution → clarification or confirm card).

import {
  sendMessage,
  sendChatAction,
  editMessageText,
  downloadFile,
  type TelegramMessage,
} from '@/lib/telegram/client'
import { sendHtml } from '@/lib/telegram/send-html'
import { hasAnthropicKey } from '@/lib/agent/client'
import { runWealthAgent } from '@/lib/agent/run'
import { runReportForChannel } from '@/lib/reports/deliver'
import type { ReportKind } from '@/lib/reports/schedule'
import {
  extractTransaction,
  mergeClarification,
  type ExtractedTransaction,
  type ExtractorInput,
} from '../extract-transaction'
import {
  closestCategory,
  resolveReferences,
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

/** Runs slow work (agent answers, reports) after the webhook has replied 200.
 * The route passes Next's `after`; tests omit it and the work runs inline. */
export type Defer = (fn: () => Promise<void>) => void

export type IncomingRoute = 'capture' | 'agent'

/** Media always goes to extraction. Text goes to the agent unless the bot is
 * mid-clarification (the reply is an answer, not a question) or no Anthropic
 * key is configured (today's behaviour). */
export function classifyIncoming(
  input: { kind: ExtractorInput['kind'] },
  flags: { hasActiveClarification: boolean; hasAnthropicKey: boolean }
): IncomingRoute {
  if (input.kind !== 'text') return 'capture'
  if (flags.hasActiveClarification) return 'capture'
  return flags.hasAnthropicKey ? 'agent' : 'capture'
}

const HELP_TEXT = [
  'Ask me anything about your money, or send me a transaction to log it.',
  '',
  'Questions:',
  '• "What were my biggest expenses last month?"',
  '• "Show my net worth"',
  '• "Income for the past 12 months"',
  '• "Which budgets are at risk?"',
  '',
  'Logging:',
  '• Text: "$12 coffee at Blue Bottle yesterday"',
  '• Voice: hold the mic button and say it',
  '• Photo or file: a receipt, statement, or transfer screen',
  '• Transfers: "moved RD$5,000 from savings to my visa"',
  '',
  'Reports: /report weekly · /report monthly (also sent automatically every Monday and on the 1st).',
  '',
  "If something's unclear I'll ask, then show a Confirm/Cancel before saving.",
].join('\n')

export async function handleMessage(
  supabase: FinanceSupabase,
  msg: TelegramMessage,
  opts: { defer?: Defer } = {}
) {
  // Without a deferral hook the slow work runs inline and is awaited here.
  const inline: Promise<void>[] = []
  const defer: Defer = opts.defer ?? ((fn) => { inline.push(fn()) })
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
    await sendMessage(chatId, HELP_TEXT)
    return
  }

  // /report [weekly|monthly] — the same code path the daily cron uses.
  if (text === '/report' || text.startsWith('/report ')) {
    const kind = text.slice('/report'.length).trim().toLowerCase() || 'weekly'
    if (kind !== 'weekly' && kind !== 'monthly') {
      await sendMessage(chatId, 'Usage: /report weekly or /report monthly')
      return
    }
    defer(() => sendReport(supabase, channel, chatId, kind))
    await Promise.all(inline)
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

  const route = classifyIncoming(input, {
    hasActiveClarification:
      input.kind === 'text' ? await hasActiveClarification(supabase, chatId) : false,
    hasAnthropicKey: hasAnthropicKey(),
  })

  if (route === 'agent' && input.kind === 'text') {
    defer(() => answerWithAgent(supabase, channel, chatId, input.text))
    await Promise.all(inline)
    return
  }

  await processIncoming(supabase, channel, chatId, input)
}

async function hasActiveClarification(supabase: FinanceSupabase, chatId: number): Promise<boolean> {
  const { data } = await supabase
    .from('pending_telegram_transactions')
    .select('id')
    .eq('telegram_chat_id', chatId)
    .eq('status', 'clarifying')
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()
  return data != null
}

/** Question → wealth agent → HTML answer. Transaction-shaped text is handed
 * back to processIncoming by the agent's log_transaction tool, in which case
 * the confirm card is the reply. */
async function answerWithAgent(
  supabase: FinanceSupabase,
  channel: ChannelInfo,
  chatId: number,
  question: string
): Promise<void> {
  try {
    await sendChatAction(chatId, 'typing')
    const { reply } = await runWealthAgent({
      supabase,
      userId: channel.user_id,
      chatId,
      question,
      logTransaction: (text) => processIncoming(supabase, channel, chatId, { kind: 'text', text }),
    })
    if (!reply) return
    await sendHtml(chatId, reply)
  } catch (err) {
    console.error('[wealth-agent] failed', err)
    await sendMessage(chatId, '⚠️ I hit a snag answering that. Try again in a moment.')
  }
}

async function sendReport(
  supabase: FinanceSupabase,
  channel: ChannelInfo,
  chatId: number,
  kind: ReportKind
): Promise<void> {
  try {
    await sendChatAction(chatId, 'typing')
    await runReportForChannel(
      supabase,
      { id: channel.id, user_id: channel.user_id, telegram_chat_id: chatId },
      kind,
      new Date()
    )
  } catch (err) {
    console.error(`[reports] /report ${kind} failed`, err)
    await sendMessage(chatId, "⚠️ I couldn't build that report. Try again in a moment.")
  }
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

  // Fresh extraction.
  let extracted: ExtractedTransaction
  try {
    extracted = await extractTransaction(input)
  } catch (err) {
    const cause = err instanceof Error ? err.message : String(err)
    console.error(`[telegram-webhook] extract failed: ${cause}`)
    await sendMessage(
      chatId,
      `⚠️ I couldn't read that${friendlyCause(cause)}. Try again, or send it as text (e.g. "$12 at Blue Bottle").`
    )
    return
  }

  const ctx = await resolveReferences(supabase, channel.user_id, extracted)

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
    keyboard: clarifying ? undefined : confirmKeyboard('placeholder'),
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
    })
  } else {
    // Swap the placeholder keyboard for one carrying the real pending id.
    await editMessageText(chatId, sentMessage.message_id, initialText, {
      keyboard: confirmKeyboard(pending.id),
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
      'Ask me anything — "what did I spend on food last month?", "show my net worth" — or send me a transaction to log it:',
      '• "$12 coffee at Blue Bottle"',
      '• A voice note describing the purchase',
      '• A photo of a receipt',
      '',
      "Type /help for more. If something's unclear I'll ask, then show a Confirm/Cancel before saving.",
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
