import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(
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

  // Verify the account exists and belongs to the user
  const { data: existing, error: fetchError } = await supabase
    .from('accounts')
    .select('id, deleted_at')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (fetchError || !existing) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 })
  }

  if (!existing.deleted_at) {
    return NextResponse.json({ error: 'Account is not archived' }, { status: 400 })
  }

  // Restore by clearing deleted_at
  const { error: updateError } = await supabase
    .from('accounts')
    .update({ deleted_at: null })
    .eq('id', id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
