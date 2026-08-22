// Shared types for the Telegram clarification state machine.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { ExtractedTransaction } from '../extract-transaction'
import type { OptionItem, ResolvedReferences } from '../resolve-references'

// Accept any supabase-js schema generic — the webhook passes a finance-scoped
// service client.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type FinanceSupabase = SupabaseClient<any, any, any>

export type MissingField =
  | 'amount'
  | 'merchant'
  | 'category'
  | 'account'
  | 'to_account'
  | 'date'

export interface PendingPayload {
  extracted: ExtractedTransaction
  resolved: ResolvedReferences
  direction: 'income' | 'expense' | 'transfer'
  /** Frozen button lists — callback indexes resolve against these. */
  options?: {
    categories?: OptionItem[]
    accounts?: OptionItem[]
  }
  /** Set when the user tapped "Other…" on the category grid — the next text
   *  reply is a category name, not a new transaction. */
  awaitingCategoryText?: boolean
}

export interface PendingRow {
  id: string
  user_id: string
  channel_id: string
  telegram_chat_id: number
  telegram_message_id: number
  payload: PendingPayload
  status: 'clarifying' | 'confirming'
  missing_fields: MissingField[]
}

export const PENDING_COLUMNS =
  'id, user_id, channel_id, telegram_chat_id, telegram_message_id, payload, status, missing_fields'

export interface ChannelInfo {
  id: string
  user_id: string
  status: 'connected' | 'paused' | 'disconnected'
}
