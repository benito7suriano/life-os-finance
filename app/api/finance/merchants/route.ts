import { NextRequest, NextResponse } from 'next/server'
import { createFinanceClient } from '@/lib/supabase/server'

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
    .from('merchants')
    .select('*')
    .or(`user_id.eq.${user.id},is_global.eq.true`)
    .order('name', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ merchants: data })
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
  const { name, defaultCategoryId } = body

  if (!name) {
    return NextResponse.json({ error: 'Missing required field: name' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('merchants')
    .insert({
      user_id: user.id,
      name,
      default_category_id: defaultCategoryId ?? null,
      is_global: false,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ merchant: data }, { status: 201 })
}
