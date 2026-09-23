import { NextRequest, NextResponse } from 'next/server'
import { createFinanceClient } from '@/lib/supabase/server'
import { loadAsset, setAssetArchived } from '@/lib/assets/server'

export async function PATCH(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createFinanceClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    await setAssetArchived(supabase, user.id, id, false)
    return NextResponse.json({ asset: await loadAsset(supabase, user.id, id) })
  } catch (cause) {
    return NextResponse.json({ error: cause instanceof Error ? cause.message : 'Unable to restore asset' }, { status: 500 })
  }
}
