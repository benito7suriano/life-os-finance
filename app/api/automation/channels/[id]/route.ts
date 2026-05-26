import { NextRequest, NextResponse } from 'next/server'
import { createFinanceClient } from '@/lib/supabase/server'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createFinanceClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { action } = body as { action: 'pause' | 'resume' }

  const { data: existing } = await supabase
    .from('automation_channels')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const updates: Record<string, unknown> = {}

  if (action === 'pause') {
    updates.status = 'paused'
    updates.paused_at = new Date().toISOString()
  } else if (action === 'resume') {
    updates.status = 'connected'
    updates.paused_at = null
  } else {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  const { data: updated, error } = await supabase
    .from('automation_channels')
    .update(updates)
    .eq('id', id)
    .select('id, type, status, connected_at, last_activity_at, paused_at, transactions_logged')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    channel: {
      id: updated.id,
      type: updated.type,
      status: updated.status,
      connectedAt: updated.connected_at,
      lastActivityAt: updated.last_activity_at,
      pausedAt: updated.paused_at,
      transactionsLogged: updated.transactions_logged,
    },
  })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createFinanceClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: existing } = await supabase
    .from('automation_channels')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { error } = await supabase
    .from('automation_channels')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
