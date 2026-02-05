import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify ownership
  const { data: existing, error: fetchError } = await supabase
    .from('budgets')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (fetchError || !existing) {
    return NextResponse.json({ error: 'Budget not found' }, { status: 404 })
  }

  const body = await request.json()
  const { amount } = body

  if (!amount || amount <= 0) {
    return NextResponse.json({ error: 'amount must be > 0' }, { status: 400 })
  }

  // Update budget
  const { data: updated, error: updateError } = await supabase
    .from('budgets')
    .update({ amount })
    .eq('id', id)
    .select()
    .single()

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  // Upsert snapshot for current month
  const now = new Date()
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  await supabase.from('budget_monthly_snapshots').upsert({
    budget_id: id,
    user_id: user.id,
    month: monthStart,
    budgeted_amount: amount,
  }, { onConflict: 'budget_id,month' })

  return NextResponse.json({ budget: updated })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify ownership and get linked goal
  const { data: existing, error: fetchError } = await supabase
    .from('budgets')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (fetchError || !existing) {
    return NextResponse.json({ error: 'Budget not found' }, { status: 404 })
  }

  // If sinking fund, also delete the linked goal
  if (existing.linked_goal_id) {
    await supabase.from('goals').delete().eq('id', existing.linked_goal_id)
  }

  // Delete budget (snapshots cascade)
  const { error: deleteError } = await supabase
    .from('budgets')
    .delete()
    .eq('id', id)

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
