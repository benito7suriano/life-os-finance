// Report delivery over Telegram. Shared by the daily cron (every connected
// channel) and the /report command (one chat).

import type { SupabaseClient } from '@supabase/supabase-js'
import { sendHtml } from '@/lib/telegram/send-html'
import { buildReportData } from './build'
import { generateReport } from './generate'
import type { ReportKind } from './schedule'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FinanceSupabase = SupabaseClient<any, any, any>

export interface ReportChannel {
  id: string
  user_id: string
  telegram_chat_id: number
}

export type ReportDelivery = { chatId: number; chunks: number } | { chatId: number; error: string }

export async function runReportForChannel(
  supabase: FinanceSupabase,
  channel: ReportChannel,
  kind: ReportKind,
  now: Date
): Promise<{ chatId: number; chunks: number }> {
  const data = await buildReportData(supabase, channel.user_id, kind, now)
  const html = await generateReport(data)
  const chunks = await sendHtml(channel.telegram_chat_id, html)
  return { chatId: channel.telegram_chat_id, chunks }
}

export async function runReportForAllChannels(
  supabase: FinanceSupabase,
  kind: ReportKind,
  now: Date
): Promise<ReportDelivery[]> {
  const { data, error } = await supabase
    .from('automation_channels')
    .select('id, user_id, telegram_chat_id')
    .eq('type', 'telegram')
    .eq('status', 'connected')
    .not('telegram_chat_id', 'is', null)
  if (error) throw new Error(`channel fetch failed: ${error.message}`)

  const results: ReportDelivery[] = []
  for (const channel of (data ?? []) as ReportChannel[]) {
    try {
      results.push(await runReportForChannel(supabase, channel, kind, now))
    } catch (err) {
      console.error(`[reports] ${kind} report failed for chat ${channel.telegram_chat_id}`, err)
      results.push({ chatId: channel.telegram_chat_id, error: err instanceof Error ? err.message : String(err) })
    }
  }
  return results
}
