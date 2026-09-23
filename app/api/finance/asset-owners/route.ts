import { NextRequest, NextResponse } from 'next/server'
import { createFinanceClient } from '@/lib/supabase/server'
import { createAssetOwner, listAssetOwners } from '@/lib/assets/server'

const OWNER_TYPES = new Set(['person', 'company', 'trust', 'other'])

export async function GET(request: NextRequest) {
  const supabase = await createFinanceClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({ owners: await listAssetOwners(supabase, user.id, new URL(request.url).searchParams.get('archived') === 'true') })
}

export async function POST(request: NextRequest) {
  const supabase = await createFinanceClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json()
  if (!body.name?.trim() || (body.ownerType && !OWNER_TYPES.has(body.ownerType))) {
    return NextResponse.json({ error: 'A valid owner name and type are required' }, { status: 400 })
  }
  try {
    return NextResponse.json({ owner: await createAssetOwner(supabase, user.id, body) }, { status: 201 })
  } catch (cause) {
    return NextResponse.json({ error: cause instanceof Error ? cause.message : 'Unable to create owner' }, { status: 400 })
  }
}
