// Callback-query handling: Confirm/Cancel plus clarification buttons.
//
// callback_data grammar (≤64 bytes):
//   c:<pendingId>        confirm
//   x:<pendingId>        cancel (any state)
//   cc:<pendingId>:<i>   category = payload.options.categories[i]
//   co:<pendingId>       category = Other… → ask for a free-text name
//   cg:<pendingId>       back from the free-text prompt to the category grid
//   ca:<pendingId>:<i>   account  = payload.options.accounts[i]
//   ct:<pendingId>:<i>   to_account (transfers) = payload.options.toAccounts[i]
//                        (legacy rows: payload.options.accounts[i])
//   cp:<pendingId>       "not my account" on the to_account question → the
//                        transfer becomes an expense paid to the counterparty
//   cd:<pendingId>:t|y   date = today | yesterday
//   ea:<pendingId>       from the confirm card: change the (source) account
//   et:<pendingId>       from the confirm card: change the destination account

import {
  answerCallbackQuery,
  editMessageText,
  type TelegramCallbackQuery,
} from '@/lib/telegram/client'
import { applyTransactionBalances } from '@/lib/finance/apply-balances'
import type { ExtractedTransaction } from '../extract-transaction'
import { fromUsd, toUsd } from '@/lib/fx'
import { resolveReferences, toThirdPartyExpense } from '../resolve-references'
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
    case 'ca':
    case 'ct': {
      const field =
        action === 'cc' ? 'category' : action === 'ca' ? 'account' : 'to_account'
      const options =
        field === 'category'
          ? pending.payload.options?.categories
          : field === 'to_account'
            ? (pending.payload.options?.toAccounts ??
              pending.payload.options?.accounts)
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
      // A transfer's two accounts must differ.
      if (
        field === 'to_account' &&
        options![idx].id === pending.payload.resolved.accountId
      ) {
        await answerCallbackQuery(cb.id, "That's the source account — pick a different one.")
        return
      }
      if (
        field === 'account' &&
        pending.payload.direction === 'transfer' &&
        options![idx].id === pending.payload.resolved.toAccountId
      ) {
        await answerCallbackQuery(cb.id, "That's the destination account — pick a different one.")
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
    case 'cp': {
      // "Not my account" on the destination question: the money went to
      // somebody else, so this is an expense paid to them from the source.
      const valid =
        pending.status === 'clarifying' &&
        pending.missing_fields[0] === 'to_account' &&
        pending.payload.direction === 'transfer'
      if (!valid) {
        await answerCallbackQuery(cb.id, 'That button is stale — use the latest card.')
        return
      }
      await answerCallbackQuery(cb.id)
      await applyAnswer(supabase, pending, {
        kind: 'extracted',
        extracted: toThirdPartyExpense(pending.payload.extracted),
      })
      return
    }
    case 'ea':
    case 'et': {
      // From the confirm card: reopen one account question with the ranked
      // list, keeping everything else the user already confirmed.
      const field = action === 'ea' ? 'account' : 'to_account'
      const valid =
        pending.status === 'confirming' &&
        (field === 'account' || pending.payload.direction === 'transfer')
      if (!valid) {
        await answerCallbackQuery(cb.id, 'That button is stale — use the latest card.')
        return
      }
      await answerCallbackQuery(cb.id)
      await reopenAccountQuestion(supabase, pending, field)
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

/**
 * Clears one account on a confirming row, demotes it to 'clarifying' for that
 * single field, and renders the question with a freshly ranked list.
 */
async function reopenAccountQuestion(
  supabase: FinanceSupabase,
  pending: PendingRow,
  field: 'account' | 'to_account'
) {
  const payload = pending.payload
  const resolved = { ...payload.resolved }
  const options = { ...(payload.options ?? {}) }
  if (field === 'account') {
    resolved.accountId = null
    resolved.accountName = null
    resolved.accountSource = null
    delete options.accounts
  } else {
    resolved.toAccountId = null
    resolved.toAccountName = null
    resolved.toAccountSource = null
    delete options.toAccounts
    // Legacy rows froze the destination list under `accounts`; drop it too so
    // the ranked list is what gets rendered.
    delete options.accounts
  }

  const ctx = await resolveReferences(supabase, pending.user_id, payload.extracted)

  const newPayload: PendingPayload = { ...payload, resolved, options }
  const { error } = await supabase
    .from('pending_telegram_transactions')
    .update({
      payload: newPayload,
      status: 'clarifying',
      missing_fields: [field],
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    })
    .eq('id', pending.id)
  if (error) {
    throw new Error(`pending update failed: ${error.message}`)
  }
  pending.payload = newPayload
  pending.status = 'clarifying'
  pending.missing_fields = [field]

  await askNextQuestion(supabase, pending, {
    categories: ctx.categories,
    accounts: ctx.accounts,
    toAccounts: ctx.toAccounts,
  })
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

  if (
    !extracted.amount ||
    !resolved.accountId ||
    (direction === 'transfer' &&
      (!resolved.toAccountId || resolved.toAccountId === resolved.accountId))
  ) {
    await editMessageText(
      chatId,
      messageId,
      direction === 'transfer'
        ? '⚠️ Missing required fields (amount or from/to accounts). A transfer needs two different accounts.'
        : '⚠️ Missing required fields (amount or account). Open the app to add an account first.'
    )
    await supabase
      .from('pending_telegram_transactions')
      .delete()
      .eq('id', pending.id)
    return
  }

  if (direction === 'transfer') {
    await confirmTransfer(supabase, pending, chatId, messageId)
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

  // A payment read off a two-currency screen (rent paid from a DOP account,
  // shown as US$1,500 / RD$89,850): book the leg in the account's currency.
  let amount = extracted.amount
  if (
    extracted.toAmount &&
    extracted.toCurrency &&
    extracted.currency &&
    extracted.currency !== currency &&
    extracted.toCurrency === currency
  ) {
    amount = extracted.toAmount
  }

  const insertData: Record<string, unknown> = {
    user_id: pending.user_id,
    type: direction,
    date: txDate,
    description: merchantName ?? 'Telegram entry',
    amount,
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
        amount,
        fromAccountId: direction === 'expense' ? resolved.accountId : undefined,
        toAccountId: direction === 'income' ? resolved.accountId : undefined,
      },
      1
    )
  } catch (balanceErr) {
    console.error('[telegram-webhook] balance update failed', balanceErr)
    balanceWarning = true
  }

  // Saved card reflects what was actually stored (account currency).
  const savedExtracted: ExtractedTransaction = {
    ...extracted,
    amount,
    currency,
    toAmount: null,
    toCurrency: null,
  }

  await finalizeSaved(supabase, pending, chatId, messageId, {
    summary: formatPendingSummary(savedExtracted, resolved, { saved: true }),
    balanceWarning,
  })
}

/**
 * Saves a confirmed transfer: one row with from/to accounts, source-leg amount
 * in the source account's currency, and a destination leg (to_amount/to_currency)
 * when the currencies differ. No merchant, no category, no merchant learning.
 */
async function confirmTransfer(
  supabase: FinanceSupabase,
  pending: PendingRow,
  chatId: number,
  messageId: number
) {
  const { extracted } = pending.payload
  const resolved = pending.payload.resolved
  const fromId = resolved.accountId!
  const toId = resolved.toAccountId!

  const txDate =
    extracted.date && /^\d{4}-\d{2}-\d{2}$/.test(extracted.date)
      ? extracted.date
      : new Date().toISOString().slice(0, 10)

  // Stamp both legs with the accounts' native currencies (matches the manual
  // create route); the extractor's guesses are only fallbacks.
  const accountCurrency = async (id: string): Promise<string | null> => {
    const { data } = await supabase
      .from('accounts')
      .select('currency')
      .eq('id', id)
      .maybeSingle()
    return data?.currency ?? null
  }
  const fromCurrency =
    (await accountCurrency(fromId)) ?? extracted.currency ?? 'USD'
  const toCurrency =
    (await accountCurrency(toId)) ??
    extracted.toCurrency ??
    extracted.currency ??
    'USD'

  // The extractor may have assigned the legs backwards (e.g. read the USD
  // figure as the source when the source account is DOP). If its currencies
  // are exactly swapped relative to the accounts, swap the amounts back.
  let amount = extracted.amount!
  let extractedToAmount = extracted.toAmount ?? null
  if (
    extractedToAmount != null &&
    extracted.currency &&
    extracted.toCurrency &&
    extracted.currency !== extracted.toCurrency &&
    extracted.currency === toCurrency &&
    extracted.toCurrency === fromCurrency
  ) {
    amount = extractedToAmount
    extractedToAmount = extracted.amount!
  }

  const insertData: Record<string, unknown> = {
    user_id: pending.user_id,
    type: 'transfer',
    date: txDate,
    description:
      extracted.merchant ??
      (resolved.toAccountName
        ? `Transfer to ${resolved.toAccountName}`
        : 'Transfer'),
    amount,
    currency: fromCurrency,
    from_account_id: fromId,
    to_account_id: toId,
    source: 'telegram',
    source_app: 'telegram-bot',
  }

  // Destination leg for cross-currency transfers: prefer the settled amount
  // the extractor read off the screen; fall back to the central FX rate.
  let creditAmount = amount
  if (toCurrency !== fromCurrency) {
    creditAmount =
      extractedToAmount ?? fromUsd(toUsd(amount, fromCurrency), toCurrency)
    insertData.to_amount = creditAmount
    insertData.to_currency = toCurrency
  }

  const { error: txErr } = await supabase
    .from('transactions')
    .insert(insertData)

  if (txErr) {
    console.error('[telegram-webhook] transfer insert failed', txErr)
    await editMessageText(chatId, messageId, `⚠️ Save failed: ${txErr.message}`)
    return
  }

  let balanceWarning = false
  try {
    await applyTransactionBalances(
      supabase,
      {
        type: 'transfer',
        amount,
        toAmount: creditAmount,
        fromAccountId: fromId,
        toAccountId: toId,
      },
      1
    )
  } catch (balanceErr) {
    console.error('[telegram-webhook] balance update failed', balanceErr)
    balanceWarning = true
  }

  // Saved card reflects what was actually stored (post-swap, account currencies).
  const savedExtracted = {
    ...extracted,
    amount,
    currency: fromCurrency,
    toAmount: toCurrency !== fromCurrency ? creditAmount : null,
    toCurrency: toCurrency !== fromCurrency ? toCurrency : null,
  }

  await finalizeSaved(supabase, pending, chatId, messageId, {
    summary: formatPendingSummary(savedExtracted, resolved, { saved: true }),
    balanceWarning,
  })
}

/** Shared confirm tail: channel stats, pending cleanup, and the Saved card. */
async function finalizeSaved(
  supabase: FinanceSupabase,
  pending: PendingRow,
  chatId: number,
  messageId: number,
  opts: { summary: string; balanceWarning: boolean }
) {
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
    `✅ Saved.\n\n${opts.summary}${
      opts.balanceWarning
        ? "\n\n⚠️ Saved, but the account balance didn't update — check the app."
        : ''
    }`
  )
}
