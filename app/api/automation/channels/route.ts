import { NextRequest, NextResponse } from 'next/server'
import { createFinanceClient } from '@/lib/supabase/server'

interface ChannelRow {
  id: string
  type: 'telegram' | 'whatsapp' | 'email'
  status: 'connected' | 'paused' | 'disconnected'
  connected_at: string | null
  last_activity_at: string | null
  paused_at: string | null
  transactions_logged: number
  telegram_username: string | null
}

export async function GET(_request: NextRequest) {
  const supabase = await createFinanceClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('automation_channels')
    .select(
      'id, type, status, connected_at, last_activity_at, paused_at, transactions_logged, telegram_username'
    )
    .eq('user_id', user.id)
    .eq('type', 'telegram')
    .order('connected_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const botUsername = process.env.TELEGRAM_BOT_USERNAME ?? ''

  const channels = ((data || []) as ChannelRow[]).map((ch) => ({
    id: ch.id,
    type: ch.type,
    status: ch.status,
    connectedAt: ch.connected_at,
    lastActivityAt: ch.last_activity_at,
    pausedAt: ch.paused_at,
    transactionsLogged: ch.transactions_logged,
    telegramDetails:
      ch.type === 'telegram'
        ? {
            username: ch.telegram_username,
            botUsername,
          }
        : undefined,
  }))

  return NextResponse.json({ channels })
}
