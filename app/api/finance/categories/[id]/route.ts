import { NextRequest, NextResponse } from 'next/server'
import { createFinanceClient } from '@/lib/supabase/server'

export async function PATCH(
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

  const { data: existing } = await supabase
    .from('categories')
    .select('id, user_id, is_system')
    .eq('id', id)
    .single()

  if (!existing || existing.user_id !== user.id || existing.is_system) {
    return NextResponse.json({ error: 'Category not found' }, { status: 404 })
  }

  const body = await request.json()
  const updates: Record<string, unknown> = {}
  if (body.name !== undefined) updates.name = body.name
  if (body.color !== undefined) updates.color = body.color
  if (body.icon !== undefined) updates.icon = body.icon
  if (body.parentId !== undefined) updates.parent_id = body.parentId
  if (body.type !== undefined) updates.type = body.type

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('categories')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ category: data })
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
    .from('categories')
    .select('id, user_id, is_system')
    .eq('id', id)
    .single()

  if (!existing || existing.user_id !== user.id || existing.is_system) {
    return NextResponse.json({ error: 'Category not found' }, { status: 404 })
  }

  const { error } = await supabase.from('categories').delete().eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
