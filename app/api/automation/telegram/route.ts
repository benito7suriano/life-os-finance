import { NextRequest, NextResponse } from 'next/server'
import { createFinanceClient } from '@/lib/supabase/server'

// POST /api/automation/telegram
//   { action: 'setup' }  -> creates a 'disconnected' row with a fresh link code
//   { action: 'cancel' } -> clears the pending link code

const LINK_CODE_TTL_MS = 10 * 60 * 1000 // 10 min

function generateLinkCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export async function POST(request: NextRequest) {
  const supabase = await createFinanceClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const botUsername = process.env.TELEGRAM_BOT_USERNAME
  if (!botUsername) {
    return NextResponse.json(
      { error: 'TELEGRAM_BOT_USERNAME is not configured on the server' },
      { status: 500 }
    )
  }

  const body = await request.json().catch(() => ({}))
  const { action } = body as { action?: 'setup' | 'cancel' }

  if (action === 'cancel') {
    // Clear any pending link (only for disconnected rows — connected channels untouched).
    await supabase
      .from('automation_channels')
      .delete()
      .eq('user_id', user.id)
      .eq('type', 'telegram')
      .eq('status', 'disconnected')

    return NextResponse.json({ success: true })
  }

  if (action !== 'setup') {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  const code = generateLinkCode()
  const expiresAt = new Date(Date.now() + LINK_CODE_TTL_MS).toISOString()

  // If a channel row already exists for this user (connected or disconnected),
  // update it with a new link code. The unique (user_id, type) index means
  // we can't insert a second row.
  const { data: existing } = await supabase
    .from('automation_channels')
    .select('id, status')
    .eq('user_id', user.id)
    .eq('type', 'telegram')
    .maybeSingle()

  if (existing) {
    // If already connected, don't overwrite the connection — refuse.
    if (existing.status === 'connected' || existing.status === 'paused') {
      return NextResponse.json(
        { error: 'Telegram is already connected. Disconnect first to re-link.' },
        { status: 409 }
      )
    }

    const { error } = await supabase
      .from('automation_channels')
      .update({
        telegram_link_code: code,
        telegram_link_code_expires_at: expiresAt,
      })
      .eq('id', existing.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  } else {
    const { error } = await supabase.from('automation_channels').insert({
      user_id: user.id,
      type: 'telegram',
      status: 'disconnected',
      telegram_link_code: code,
      telegram_link_code_expires_at: expiresAt,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  return NextResponse.json({
    pendingLink: {
      code,
      expiresAt,
      botUsername,
      deepLink: `https://t.me/${botUsername}?start=${code}`,
    },
  })
}
