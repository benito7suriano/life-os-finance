import { NextRequest, NextResponse } from 'next/server'
import { createFinanceClient } from '@/lib/supabase/server'
import { loadAsset, setAssetArchived, updateAsset } from '@/lib/assets/server'
import { validateAssetDetails, validateOwnershipAllocations } from '@/lib/assets/accounting'
import type { AssetWriteInput } from '@/lib/assets/types'

async function context(params: Promise<{ id: string }>) {
  const [{ id }, supabase] = await Promise.all([params, createFinanceClient()])
  const { data: { user }, error } = await supabase.auth.getUser()
  return { id, supabase, user: error ? null : user }
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id, supabase, user } = await context(params)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const asset = await loadAsset(supabase, user.id, id)
    if (!asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
    return NextResponse.json({ asset })
  } catch (cause) {
    return NextResponse.json({ error: cause instanceof Error ? cause.message : 'Unable to load asset' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id, supabase, user } = await context(params)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json() as Partial<AssetWriteInput>
  if (body.name !== undefined && !body.name.trim()) return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 })
  if (body.owners) {
    const result = validateOwnershipAllocations(body.owners)
    if (!result.valid) return NextResponse.json({ error: result.error }, { status: 400 })
  }
  if (body.details && body.category) {
    const result = validateAssetDetails(body.category, body.details as Record<string, unknown>)
    if (!result.valid) return NextResponse.json({ error: result.error }, { status: 400 })
  }
  try {
    await updateAsset(supabase, user.id, id, body)
    return NextResponse.json({ asset: await loadAsset(supabase, user.id, id) })
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'Unable to update asset'
    return NextResponse.json({ error: message }, { status: message === 'Asset not found' ? 404 : 400 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id, supabase, user } = await context(params)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    await setAssetArchived(supabase, user.id, id, true)
    return NextResponse.json({ success: true })
  } catch (cause) {
    return NextResponse.json({ error: cause instanceof Error ? cause.message : 'Unable to archive asset' }, { status: 500 })
  }
}
