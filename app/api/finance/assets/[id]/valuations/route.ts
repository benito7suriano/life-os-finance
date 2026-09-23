import { NextRequest, NextResponse } from 'next/server'
import { createFinanceClient } from '@/lib/supabase/server'
import { loadAsset, recordAssetValuation } from '@/lib/assets/server'

async function getContext(params: Promise<{ id: string }>) {
  const { id } = await params
  const supabase = await createFinanceClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  return { id, supabase, user: error ? null : user }
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id, supabase, user } = await getContext(params)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const asset = await loadAsset(supabase, user.id, id)
  if (!asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
  return NextResponse.json({ valuations: asset.valuations })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id, supabase, user } = await getContext(params)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json()
  if (!body.valuedOn || body.totalValue === undefined || !Number.isFinite(Number(body.totalValue)) || Number(body.totalValue) < 0) {
    return NextResponse.json({ error: 'Valuation date and a non-negative total value are required' }, { status: 400 })
  }
  try {
    await recordAssetValuation(supabase, id, { ...body, totalValue: Number(body.totalValue) })
    return NextResponse.json({ asset: await loadAsset(supabase, user.id, id) }, { status: 201 })
  } catch (cause) {
    return NextResponse.json({ error: cause instanceof Error ? cause.message : 'Unable to record valuation' }, { status: 400 })
  }
}
