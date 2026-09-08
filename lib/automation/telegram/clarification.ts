// Clarification state machine core: which fields are missing, how to ask
// for the next one, and how to fold answers back into the pending row.

import { editMessageText } from '@/lib/telegram/client'
import type { ExtractedTransaction } from '../extract-transaction'
import {
  resolveReferences,
  type OptionItem,
  type ResolvedReferences,
} from '../resolve-references'
import { buildQuestion, confirmKeyboard, formatPendingSummary } from './format'
import type {
  FinanceSupabase,
  MissingField,
  PendingPayload,
  PendingRow,
} from './types'

export const MAX_CATEGORY_BUTTONS = 12

/**
 * Category counts as answered once matched to an id OR named by the user as a
 * brand-new one ('user_new' — created at confirm time, id still null).
 */
export function categoryAnswered(
  resolved: Pick<ResolvedReferences, 'categoryId' | 'categoryName' | 'categorySource'>
): boolean {
  return (
    !!resolved.categoryId ||
    (resolved.categorySource === 'user_new' && !!resolved.categoryName)
  )
}

/**
 * Ordered list of unresolved required fields. amount → merchant → category →
 * account → date. Category is skipped when the user has no categories for the
 * direction (nullable column — don't dead-end). Account is asked only when
 * there are ≥2 accounts and none matched (single account is used silently;
 * zero accounts is handled upstream as a hard error). Date is asked only when
 * the extractor flagged it as genuinely ambiguous — absent dates default to
 * today at confirm time.
 */
export function computeMissingFields(
  extracted: ExtractedTransaction,
  resolved: ResolvedReferences,
  counts: { categories: number; accounts: number }
): MissingField[] {
  const missing: MissingField[] = []
  // Transfers: no merchant/category; both accounts are required (a <2-account
  // ledger is rejected upstream before clarification starts).
  if (extracted.direction === 'transfer') {
    if (!extracted.amount) missing.push('amount')
    if (!resolved.accountId) missing.push('account')
    if (!resolved.toAccountId) missing.push('to_account')
    if (extracted.dateAmbiguous) missing.push('date')
    return missing
  }
  if (!extracted.amount) missing.push('amount')
  if (!resolved.merchantName) missing.push('merchant')
  if (!categoryAnswered(resolved) && counts.categories > 0) missing.push('category')
  if (!resolved.accountId && counts.accounts >= 2) missing.push('account')
  if (extracted.dateAmbiguous) missing.push('date')
  return missing
}

/**
 * Ranks the user's categories by recent usage (most-used first, alphabetical
 * fallback) and caps the list for the inline keyboard.
 */
export async function rankCategoriesForKeyboard(
  supabase: FinanceSupabase,
  userId: string,
  categories: OptionItem[]
): Promise<OptionItem[]> {
  if (categories.length <= MAX_CATEGORY_BUTTONS) return categories

  const { data } = await supabase
    .from('transactions')
    .select('category_id')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(300)

  const usage = new Map<string, number>()
  for (const row of (data ?? []) as { category_id: string | null }[]) {
    if (row.category_id) {
      usage.set(row.category_id, (usage.get(row.category_id) ?? 0) + 1)
    }
  }

  return [...categories]
    .sort((a, b) => {
      const diff = (usage.get(b.id) ?? 0) - (usage.get(a.id) ?? 0)
      return diff !== 0 ? diff : a.name.localeCompare(b.name)
    })
    .slice(0, MAX_CATEGORY_BUTTONS)
}

/**
 * Renders the question for the head missing field onto the pending card and
 * freezes the button option list into payload.options when needed.
 */
/** Button lists for the questions. `toAccounts` falls back to `accounts`. */
export interface QuestionLists {
  categories: OptionItem[]
  accounts: OptionItem[]
  toAccounts?: OptionItem[]
}

export async function askNextQuestion(
  supabase: FinanceSupabase,
  pending: PendingRow,
  lists: QuestionLists
): Promise<void> {
  const field = pending.missing_fields[0]
  if (!field) return

  const payload = pending.payload
  const options = { ...(payload.options ?? {}) }

  if (field === 'category' && !options.categories) {
    options.categories = await rankCategoriesForKeyboard(
      supabase,
      pending.user_id,
      lists.categories
    )
  }
  if (field === 'account' && !options.accounts) {
    options.accounts = lists.accounts
  }
  if (field === 'to_account' && !options.toAccounts && !options.accounts) {
    options.toAccounts = lists.toAccounts ?? lists.accounts
  }

  const newPayload: PendingPayload = { ...payload, options }
  if (JSON.stringify(options) !== JSON.stringify(payload.options ?? {})) {
    await supabase
      .from('pending_telegram_transactions')
      .update({ payload: newPayload })
      .eq('id', pending.id)
    pending.payload = newPayload
  }

  const { text, keyboard } = buildQuestion(
    field,
    pending.id,
    payload.extracted,
    payload.resolved,
    options
  )
  await editMessageText(
    pending.telegram_chat_id,
    pending.telegram_message_id,
    text,
    { keyboard }
  )
}

export type ClarificationAnswer =
  | { kind: 'extracted'; extracted: ExtractedTransaction }
  | { kind: 'choice'; field: 'category' | 'account' | 'to_account'; option: OptionItem }
  | { kind: 'new_category'; name: string }
  | { kind: 'date'; date: string }

/**
 * Folds an answer into the pending row, recomputes the remaining missing
 * fields, and either asks the next question or promotes the row to
 * 'confirming' with the Confirm/Cancel card.
 */
export async function applyAnswer(
  supabase: FinanceSupabase,
  pending: PendingRow,
  answer: ClarificationAnswer
): Promise<void> {
  const payload = pending.payload
  let extracted = payload.extracted
  let resolved = payload.resolved
  let lists: QuestionLists | null = null

  if (answer.kind === 'extracted') {
    extracted = answer.extracted
    // Re-resolve: a new merchant name may match now, category may resolve via
    // merchant default. Preserve any prior explicit user choices.
    const ctx = await resolveReferences(supabase, pending.user_id, extracted)
    lists = {
      categories: ctx.categories,
      accounts: ctx.accounts,
      toAccounts: ctx.toAccounts,
    }
    const fresh = ctx.resolved
    if (resolved.categorySource === 'user_choice' && resolved.categoryId) {
      fresh.categoryId = resolved.categoryId
      fresh.categoryName = resolved.categoryName
      fresh.categorySource = 'user_choice'
    } else if (resolved.categorySource === 'user_new' && resolved.categoryName) {
      fresh.categoryId = null
      fresh.categoryName = resolved.categoryName
      fresh.categorySource = 'user_new'
    }
    if (resolved.accountSource === 'user_choice' && resolved.accountId) {
      fresh.accountId = resolved.accountId
      fresh.accountName = resolved.accountName
      fresh.accountSource = 'user_choice'
    }
    if (resolved.toAccountSource === 'user_choice' && resolved.toAccountId) {
      fresh.toAccountId = resolved.toAccountId
      fresh.toAccountName = resolved.toAccountName
      fresh.toAccountSource = 'user_choice'
    }
    resolved = fresh
  } else if (answer.kind === 'choice') {
    resolved = { ...resolved }
    if (answer.field === 'category') {
      resolved.categoryId = answer.option.id
      resolved.categoryName = answer.option.name
      resolved.categorySource = 'user_choice'
    } else if (answer.field === 'to_account') {
      resolved.toAccountId = answer.option.id
      resolved.toAccountName = answer.option.name
      resolved.toAccountSource = 'user_choice'
    } else {
      resolved.accountId = answer.option.id
      resolved.accountName = answer.option.name
      resolved.accountSource = 'user_choice'
    }
  } else if (answer.kind === 'new_category') {
    // Creation is deferred to confirm time (like merchants) so cancelled
    // transactions don't leave orphan categories.
    resolved = {
      ...resolved,
      categoryId: null,
      categoryName: answer.name,
      categorySource: 'user_new',
    }
  } else {
    extracted = { ...extracted, date: answer.date, dateAmbiguous: false }
  }

  // Recompute what's still missing. Button answers can't un-resolve other
  // fields, so reuse the stored ordering minus resolved entries; free-text
  // answers get a full recompute against fresh lists.
  let missing: MissingField[]
  if (answer.kind === 'extracted' && lists) {
    missing = computeMissingFields(extracted, resolved, {
      categories: lists.categories.length,
      accounts: lists.accounts.length,
    })
  } else {
    missing = pending.missing_fields.filter(f => {
      if (f === 'amount') return !extracted.amount
      if (f === 'merchant') return !resolved.merchantName
      if (f === 'category') return !categoryAnswered(resolved)
      if (f === 'account') return !resolved.accountId
      if (f === 'to_account') return !resolved.toAccountId
      if (f === 'date') return extracted.dateAmbiguous
      return false
    })
  }

  const newPayload: PendingPayload = {
    ...payload,
    extracted,
    resolved,
    direction: extracted.direction,
  }
  // Any applied answer ends "type the category" mode. (The flag can only be
  // set while category is the head field, so no other answer coexists with it.)
  delete newPayload.awaitingCategoryText
  const done = missing.length === 0
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString()

  const { error } = await supabase
    .from('pending_telegram_transactions')
    .update({
      payload: newPayload,
      status: done ? 'confirming' : 'clarifying',
      missing_fields: missing,
      expires_at: expiresAt,
    })
    .eq('id', pending.id)
  if (error) {
    throw new Error(`pending update failed: ${error.message}`)
  }

  pending.payload = newPayload
  pending.missing_fields = missing
  pending.status = done ? 'confirming' : 'clarifying'

  if (done) {
    await editMessageText(
      pending.telegram_chat_id,
      pending.telegram_message_id,
      formatPendingSummary(extracted, resolved),
      { keyboard: confirmKeyboard(pending.id, extracted.direction) }
    )
  } else {
    if (!lists) {
      // Button-answer path with more questions left — only reached when the
      // next field's options are already frozen or list-free; fetch lists
      // lazily only if needed.
      const next = missing[0]
      const options = newPayload.options ?? {}
      const needsLists =
        (next === 'category' && !options.categories) ||
        (next === 'account' && !options.accounts) ||
        (next === 'to_account' && !options.toAccounts && !options.accounts)
      if (needsLists) {
        const ctx = await resolveReferences(supabase, pending.user_id, extracted)
        lists = {
          categories: ctx.categories,
          accounts: ctx.accounts,
          toAccounts: ctx.toAccounts,
        }
      } else {
        lists = { categories: [], accounts: [] }
      }
    }
    await askNextQuestion(supabase, pending, lists)
  }
}

/**
 * Removes an active clarifying row for the chat (required before inserting a
 * new one — partial unique index) and marks its card as skipped.
 */
export async function supersedeClarifying(
  supabase: FinanceSupabase,
  pending: PendingRow
): Promise<void> {
  await supabase
    .from('pending_telegram_transactions')
    .delete()
    .eq('id', pending.id)
  try {
    await editMessageText(
      pending.telegram_chat_id,
      pending.telegram_message_id,
      '⏭ Skipped — replaced by your newer message.'
    )
  } catch {
    // Card edit is cosmetic — never block the new transaction on it.
  }
}
