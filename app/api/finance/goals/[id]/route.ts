import { NextRequest, NextResponse } from 'next/server'
import { createFinanceClient } from '@/lib/supabase/server'

export async function GET(
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

  const { data, error } = await supabase
    .from('goals')
    .select(
      `
      *,
      category:categories(id, name, color, icon, type),
      linked_account:accounts(id, name, type, icon),
      linked_budget:budgets!fk_goals_linked_budget(id, amount, type)
    `
    )
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Goal not found' }, { status: 404 })
  }

  return NextResponse.json({ goal: data })
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
    .from('goals')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!existing) {
    return NextResponse.json({ error: 'Goal not found' }, { status: 404 })
  }

  const { error } = await supabase.from('goals').delete().eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

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

  // Verify ownership
  const { data: existing, error: fetchError } = await supabase
    .from('goals')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (fetchError || !existing) {
    return NextResponse.json({ error: 'Goal not found' }, { status: 404 })
  }

  const body = await request.json()
  const updates: Record<string, unknown> = {}

  // Allow updating specific fields
  if (body.targetAmount !== undefined && body.targetAmount > 0) {
    updates.target_amount = body.targetAmount
  }
  if (body.targetDate !== undefined) {
    updates.target_date = body.targetDate
  }
  if (body.status !== undefined && ['active', 'completed', 'archived'].includes(body.status)) {
    updates.status = body.status
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const { data: updated, error: updateError } = await supabase
    .from('goals')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ goal: updated })
}
