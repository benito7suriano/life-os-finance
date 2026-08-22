// Callback-query handling: Confirm/Cancel plus clarification buttons.
//
// callback_data grammar (≤64 bytes):
//   c:<pendingId>        confirm
//   x:<pendingId>        cancel (any state)
//   cc:<pendingId>:<i>   category = payload.options.categories[i]
//   co:<pendingId>       category = Other… → ask for a free-text name
//   cg:<pendingId>       back from the free-text prompt to the category grid
//   ca:<pendingId>:<i>   account  = payload.options.accounts[i]
//   cd:<pendingId>:t|y   date = today | yesterday

import {
  answerCallbackQuery,
  editMessageText,
  type TelegramCallbackQuery,
} from '@/lib/telegram/client'
import { applyTransactionBalances } from '@/lib/finance/apply-balances'
import { applyAnswer, askNextQuestion } from './clarification'
import { categoryTextPrompt, formatPendingSummary } from './format'
import {
  PENDING_COLUMNS,
  type FinanceSupabase,
  type PendingPayload,
  type PendingRow,
} from './types'

export async function handleCallback(
  supabase: FinanceSupabase,
  cb: TelegramCallbackQuery
) {
  const data = cb.data ?? ''
  const [action, pendingId, arg] = data.split(':')
  const chatId = cb.message?.chat.id
  const messageId = cb.message?.message_id
  if (!chatId || !messageId || !pendingId) {
    await answerCallbackQuery(cb.id)
    return
  }

  const nowIso = new Date().toISOString()

  // Opportunistic cleanup of expired pending rows (table stays tiny).
  await supabase
    .from('pending_telegram_transactions')
    .delete()
    .lt('expires_at', nowIso)

  // Fetch pending row — only if still unexpired.
  const { data: pendingRow, error: pendingErr } = await supabase
    .from('pending_telegram_transactions')
    .select(PENDING_COLUMNS)
    .eq('id', pendingId)
    .eq('telegram_chat_id', chatId)
    .gt('expires_at', nowIso)
    .maybeSingle()

  if (pendingErr) {
    await answerCallbackQuery(cb.id)
    throw new Error(`pending lookup failed: ${pendingErr.message}`)
  }

  const pending = (pendingRow as PendingRow | null) ?? null

  if (!pending) {
    await answerCallbackQuery(cb.id)
    await editMessageText(
      chatId,
      messageId,
      '⚠️ This pending transaction is no longer available (expired or already actioned).'
    )
    return
  }

  switch (action) {
    case 'x': {
      await answerCallbackQuery(cb.id)
      await supabase
        .from('pending_telegram_transactions')
        .delete()
        .eq('id', pending.id)
      await editMessageText(chatId, messageId, '❌ Cancelled. Nothing was saved.')
      return
    }
    case 'cc':
    case 'ca': {
      const field = action === 'cc' ? 'category' : 'account'
      const options =
        field === 'category'
          ? pending.payload.options?.categories
          : pending.payload.options?.accounts
      const idx = Number(arg)
      const valid =
        pending.status === 'clarifying' &&
        pending.missing_fields[0] === field &&
        Number.isInteger(idx) &&
        options !== undefined &&
        idx >= 0 &&
        idx < options.length

      if (!valid) {
        await answerCallbackQuery(cb.id, 'That button is stale — use the latest card.')
        return
      }
      await answerCallbackQuery(cb.id)
      await applyAnswer(supabase, pending, {
        kind: 'choice',
        field,
        option: options![idx],
      })
      return
    }
    case 'co': {
      if (
        pending.status !== 'clarifying' ||
        pending.missing_fields[0] !== 'category'
      ) {
        await answerCallbackQuery(cb.id, 'That button is stale — use the latest card.')
        return
      }
      await answerCallbackQuery(cb.id)
      const payload: PendingPayload = {
        ...pending.payload,
        awaitingCategoryText: true,
      }
      const { error } = await supabase
        .from('pending_telegram_transactions')
        .update({
          payload,
          expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        })
        .eq('id', pending.id)
      if (error) {
        throw new Error(`pending update failed: ${error.message}`)
      }
      const { text, keyboard } = categoryTextPrompt(
        pending.id,
        payload.extracted,
        payload.resolved
      )
      await editMessageText(chatId, messageId, text, { keyboard })
      return
    }
    case 'cg': {
      if (
        pending.status !== 'clarifying' ||
        pending.missing_fields[0] !== 'category'
      ) {
        await answerCallbackQuery(cb.id, 'That button is stale — use the latest card.')
        return
      }
      await answerCallbackQuery(cb.id)
      if (pending.payload.awaitingCategoryText) {
        const payload: PendingPayload = { ...pending.payload }
        delete payload.awaitingCategoryText
        const { error } = await supabase
          .from('pending_telegram_transactions')
          .update({ payload })
          .eq('id', pending.id)
        if (error) {
          throw new Error(`pending update failed: ${error.message}`)
        }
        pending.payload = payload
      }
      // Options were frozen when the grid was first rendered ('co' is only
      // reachable from it), so askNextQuestion re-renders without lists.
      await askNextQuestion(supabase, pending, { categories: [], accounts: [] })
      return
    }
    case 'cd': {
      const valid =
        pending.status === 'clarifying' &&
        pending.missing_fields[0] === 'date' &&
        (arg === 't' || arg === 'y')
      if (!valid) {
        await answerCallbackQuery(cb.id, 'That button is stale — use the latest card.')
        return
      }
      await answerCallbackQuery(cb.id)
      const day = new Date()
      if (arg === 'y') day.setDate(day.getDate() - 1)
      await applyAnswer(supabase, pending, {
        kind: 'date',
        date: day.toISOString().slice(0, 10),
      })
      return
    }
    case 'c': {
      if (pending.status === 'clarifying') {
        await answerCallbackQuery(cb.id, 'Still need more info — answer the question above.')
        return
      }
      await answerCallbackQuery(cb.id)
      await confirmPending(supabase, pending, chatId, messageId)
      return
    }
    default:
      await answerCallbackQuery(cb.id)
  }
}

async function confirmPending(
  supabase: FinanceSupabase,
  pending: PendingRow,
  chatId: number,
  messageId: number
) {
  const payload = pending.payload
  const { extracted, direction } = payload
  // Tolerate legacy payloads that predate merchantName/accountName.
  const resolved = { ...payload.resolved }
  const merchantName = resolved.merchantName ?? extracted.merchant ?? null

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

  // Create the merchant now if it never matched — deferred from resolution
  // time so cancelled transactions don't leave orphans.
  if (!resolved.merchantId && merchantName) {
    const { data: created, error: createErr } = await supabase
      .from('merchants')
      .insert({ user_id: pending.user_id, name: merchantName })
      .select('id')
      .single()
    if (!createErr && created) {
      resolved.merchantId = created.id
    } else {
      // Possible race with a concurrent create — try to re-match by name.
      const { data: existing } = await supabase
        .from('merchants')
        .select('id')
        .eq('user_id', pending.user_id)
        .ilike('name', merchantName)
        .maybeSingle()
      if (existing) resolved.merchantId = existing.id
      else if (createErr) {
        console.error('[telegram-webhook] merchant create failed', createErr)
      }
    }
  }

  // Create the category now if the user named a brand-new one — deferred from
  // clarification time so cancelled transactions don't leave orphans.
  if (
    !resolved.categoryId &&
    resolved.categorySource === 'user_new' &&
    resolved.categoryName
  ) {
    const { data: created, error: createErr } = await supabase
      .from('categories')
      .insert({
        user_id: pending.user_id,
        name: resolved.categoryName,
        type: direction,
        is_system: false,
      })
      .select('id')
      .single()
    if (!createErr && created) {
      resolved.categoryId = created.id
    } else {
      // Possible race with a concurrent create — try to re-match by name.
      const { data: existing } = await supabase
        .from('categories')
        .select('id')
        .eq('user_id', pending.user_id)
        .eq('type', direction)
        .ilike('name', resolved.categoryName.replace(/[\\%_]/g, m => `\\${m}`))
        .maybeSingle()
      if (existing) resolved.categoryId = existing.id
      else if (createErr) {
        console.error('[telegram-webhook] category create failed', createErr)
      }
    }
  }

  const txDate =
    extracted.date && /^\d{4}-\d{2}-\d{2}$/.test(extracted.date)
      ? extracted.date
      : new Date().toISOString().slice(0, 10)

  // Stamp the account's native currency (matches the manual create route);
  // the extractor's guess is only a fallback.
  const { data: acct } = await supabase
    .from('accounts')
    .select('currency')
    .eq('id', resolved.accountId)
    .maybeSingle()
  const currency = acct?.currency ?? extracted.currency ?? 'USD'

  const insertData: Record<string, unknown> = {
    user_id: pending.user_id,
    type: direction,
    date: txDate,
    description: merchantName ?? 'Telegram entry',
    amount: extracted.amount,
    currency,
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
    await editMessageText(chatId, messageId, `⚠️ Save failed: ${txErr.message}`)
    return
  }

  // Merchant learning: the confirmed category becomes the merchant's default.
  if (resolved.merchantId && resolved.categoryId) {
    const { error: learnErr } = await supabase
      .from('merchants')
      .update({ default_category_id: resolved.categoryId })
      .eq('id', resolved.merchantId)
      .eq('user_id', pending.user_id)
    if (learnErr) {
      console.error('[telegram-webhook] merchant learning failed', learnErr)
    }
  }

  // Keep the account balance in sync — same helper as the manual routes.
  let balanceWarning = false
  try {
    await applyTransactionBalances(
      supabase,
      {
        type: direction,
        amount: extracted.amount,
        fromAccountId: direction === 'expense' ? resolved.accountId : undefined,
        toAccountId: direction === 'income' ? resolved.accountId : undefined,
      },
      1
    )
  } catch (balanceErr) {
    console.error('[telegram-webhook] balance update failed', balanceErr)
    balanceWarning = true
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
    `✅ Saved.\n\n${formatPendingSummary(extracted, resolved, { saved: true })}${
      balanceWarning
        ? "\n\n⚠️ Saved, but the account balance didn't update — check the app."
        : ''
    }`
  )
}
