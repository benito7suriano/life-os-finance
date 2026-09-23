import { NextRequest, NextResponse } from 'next/server'
import { createFinanceClient } from '@/lib/supabase/server'
import { recomputeAssetsForOwner } from '@/lib/assets/server'

const OWNER_TYPES = new Set(['person', 'company', 'trust', 'other'])

async function getContext(params: Promise<{ id: string }>) {
  const { id } = await params
  const supabase = await createFinanceClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  return { id, supabase, user: error ? null : user }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id, supabase, user } = await getContext(params)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json()
  if (body.name !== undefined && !body.name.trim()) return NextResponse.json({ error: 'Owner name cannot be empty' }, { status: 400 })
  if (body.ownerType !== undefined && !OWNER_TYPES.has(body.ownerType)) return NextResponse.json({ error: 'Owner type is invalid' }, { status: 400 })
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.name !== undefined) update.name = body.name.trim()
  if (body.includeInNetWorth !== undefined) update.include_in_net_worth = Boolean(body.includeInNetWorth)
  if (body.ownerType !== undefined) update.owner_type = body.ownerType
  const { data, error } = await supabase.from('asset_owners').update(update).eq('id', id).eq('user_id', user.id).select().single()
  if (error || !data) return NextResponse.json({ error: 'Owner not found' }, { status: 404 })
  if (body.includeInNetWorth !== undefined) await recomputeAssetsForOwner(supabase, user.id, id)
  return NextResponse.json({ owner: data })
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id, supabase, user } = await getContext(params)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { count, error: countError } = await supabase.from('asset_ownerships').select('owner_id', { count: 'exact', head: true }).eq('owner_id', id).eq('user_id', user.id)
  if (countError) return NextResponse.json({ error: countError.message }, { status: 500 })
  if ((count || 0) > 0) return NextResponse.json({ error: 'Referenced owners cannot be archived' }, { status: 409 })
  const { error } = await supabase.from('asset_owners').update({ archived_at: new Date().toISOString() }).eq('id', id).eq('user_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
