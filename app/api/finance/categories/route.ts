import { NextRequest, NextResponse } from 'next/server'
import { createFinanceClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createFinanceClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')

  let query = supabase
    .from('categories')
    .select('*')
    .or(`user_id.eq.${user.id},is_system.eq.true`)
    .order('name', { ascending: true })

  if (type) {
    query = query.eq('type', type)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ categories: data })
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

  const body = await request.json()
  const { name, type, parentId, color, icon } = body

  if (!name || !type) {
    return NextResponse.json({ error: 'Missing required fields: name, type' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('categories')
    .insert({
      user_id: user.id,
      name,
      type,
      parent_id: parentId ?? null,
      color: color ?? '#64748b',
      icon: icon ?? 'circle',
      is_system: false,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ category: data }, { status: 201 })
}
