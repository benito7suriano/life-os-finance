// Message text + inline keyboard builders for the Telegram bot.

import type { InlineKeyboardButton } from '@/lib/telegram/client'
import type { ExtractedTransaction } from '../extract-transaction'
import type { OptionItem, ResolvedReferences } from '../resolve-references'
import type { MissingField } from './types'

export function formatAmount(
  amount: number | null,
  currency: string | null
): string {
  if (amount === null) return '(unknown)'
  const fixed = amount.toFixed(2)
  if (!currency || currency === 'USD') return `$${fixed}`
  return `${fixed} ${currency}`
}

/**
 * Renders the transaction summary card. Tolerates legacy payloads that
 * predate merchantName/categoryName (falls back to extracted fields).
 */
export function formatPendingSummary(
  extracted: ExtractedTransaction,
  resolved: Partial<ResolvedReferences>,
  opts?: { saved?: boolean }
): string {
  const merchantName = resolved.merchantName ?? extracted.merchant ?? '—'
  const merchantSuffix =
    merchantName !== '—' && !resolved.merchantId ? ' (new)' : ''

  let categoryLine: string
  if (resolved.categoryName) {
    let suffix = ''
    if (resolved.categorySource === 'merchant_default') {
      suffix = ' (from merchant default)'
    } else if (resolved.categorySource === 'user_new' && !resolved.categoryId) {
      suffix = ' (new)'
    }
    categoryLine = `${resolved.categoryName}${suffix}`
  } else if (resolved.categoryId) {
    categoryLine = '✓ matched' // legacy payload without categoryName
  } else {
    categoryLine = extracted.categoryHint ?? '—'
  }

  let accountLine: string
  if (resolved.accountName) {
    const suffix = resolved.accountSource === 'default' ? ' (default)' : ''
    accountLine = `${resolved.accountName}${suffix}`
  } else if (resolved.accountId) {
    accountLine = '✓ matched' // legacy payload without accountName
  } else {
    accountLine = '— (no account!)'
  }

  const lines = [
    opts?.saved ? '' : '🧾 Confirm this transaction?',
    '',
    `${extracted.direction === 'income' ? 'Income' : 'Expense'}: ${formatAmount(extracted.amount, extracted.currency)}`,
    `Merchant: ${merchantName}${merchantSuffix}`,
    `Category: ${categoryLine}`,
    `Account:  ${accountLine}`,
    `Date:     ${extracted.date ?? 'today'}`,
  ]
  if (extracted.notes) lines.push(`Notes:    ${extracted.notes}`)

  return lines.join('\n').trim()
}

/** Compact "what we have so far" header shown above clarification questions. */
export function formatKnownSoFar(
  extracted: ExtractedTransaction,
  resolved: Partial<ResolvedReferences>
): string {
  const parts: string[] = []
  if (extracted.amount) {
    parts.push(formatAmount(extracted.amount, extracted.currency))
  }
  const merchantName = resolved.merchantName ?? extracted.merchant
  if (merchantName) parts.push(`at ${merchantName}`)
  if (extracted.date) parts.push(`on ${extracted.date}`)
  if (parts.length === 0) return '🧾 New transaction'
  return `🧾 ${extracted.direction === 'income' ? 'Income' : 'Expense'} ${parts.join(' ')}`
}

export function confirmKeyboard(pendingId: string): InlineKeyboardButton[][] {
  return [
    [
      { text: '✅ Confirm', callback_data: `c:${pendingId}` },
      { text: '❌ Cancel', callback_data: `x:${pendingId}` },
    ],
  ]
}

export function cancelRow(pendingId: string): InlineKeyboardButton[] {
  return [{ text: '❌ Cancel', callback_data: `x:${pendingId}` }]
}

function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    rows.push(items.slice(i, i + size))
  }
  return rows
}

/**
 * Builds the question text + keyboard for a missing field.
 * Button lists (category/account) must be the EXACT lists frozen into
 * payload.options — callback data carries indexes into them.
 */
export function buildQuestion(
  field: MissingField,
  pendingId: string,
  extracted: ExtractedTransaction,
  resolved: Partial<ResolvedReferences>,
  options: { categories?: OptionItem[]; accounts?: OptionItem[] }
): { text: string; keyboard: InlineKeyboardButton[][] } {
  const header = formatKnownSoFar(extracted, resolved)

  switch (field) {
    case 'amount':
      return {
        text: `${header}\n\n💵 What was the amount? Reply with a number (e.g. 3.75).`,
        keyboard: [cancelRow(pendingId)],
      }
    case 'merchant':
      return {
        text: `${header}\n\n🏪 Where was this? Reply with the merchant name.`,
        keyboard: [cancelRow(pendingId)],
      }
    case 'category': {
      const categories = options.categories ?? []
      const buttons = categories.map((c, i) => ({
        text: c.name,
        callback_data: `cc:${pendingId}:${i}`,
      }))
      const merchantName = resolved.merchantName ?? extracted.merchant
      return {
        text: `${header}\n\n🏷 Pick a category${merchantName ? ` for ${merchantName}` : ''}:`,
        keyboard: [
          ...chunk(buttons, 3),
          [{ text: '➕ Other…', callback_data: `co:${pendingId}` }],
          cancelRow(pendingId),
        ],
      }
    }
    case 'account': {
      const accounts = options.accounts ?? []
      const buttons = accounts.map((a, i) => ({
        text: a.name,
        callback_data: `ca:${pendingId}:${i}`,
      }))
      return {
        text: `${header}\n\n💳 Which account?`,
        keyboard: [...chunk(buttons, 2), cancelRow(pendingId)],
      }
    }
    case 'date':
      return {
        text: `${header}\n\n📅 Which date? The one I read was ambiguous — tap below or reply with a date.`,
        keyboard: [
          [
            { text: '📅 Today', callback_data: `cd:${pendingId}:t` },
            { text: 'Yesterday', callback_data: `cd:${pendingId}:y` },
          ],
          cancelRow(pendingId),
        ],
      }
  }
}

/**
 * Rendered after the user taps "Other…" on the category grid: asks for a
 * free-text category name, with a way back to the button list.
 */
export function categoryTextPrompt(
  pendingId: string,
  extracted: ExtractedTransaction,
  resolved: Partial<ResolvedReferences>
): { text: string; keyboard: InlineKeyboardButton[][] } {
  const header = formatKnownSoFar(extracted, resolved)
  return {
    text: `${header}\n\n🏷 What category should this go in? Reply with a name — I'll use the closest existing category, or create it if it's new.`,
    keyboard: [
      [{ text: '⬅️ Back to list', callback_data: `cg:${pendingId}` }],
      cancelRow(pendingId),
    ],
  }
}
