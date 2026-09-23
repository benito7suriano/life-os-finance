import { NextRequest, NextResponse } from 'next/server'
import { createFinanceClient } from '@/lib/supabase/server'
import { createAsset, loadAssets } from '@/lib/assets/server'
import { validateAssetDetails, validateOwnershipAllocations } from '@/lib/assets/accounting'
import { RATES } from '@/lib/fx'
import type { AssetCategory, AssetWriteInput } from '@/lib/assets/types'

const CATEGORIES = new Set<AssetCategory>(['real_estate', 'vehicle', 'private_investment', 'retirement'])

export async function GET(request: NextRequest) {
  const supabase = await createFinanceClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const archived = new URL(request.url).searchParams.get('archived') === 'true'
    return NextResponse.json(await loadAssets(supabase, user.id, archived))
  } catch (cause) {
    return NextResponse.json({ error: cause instanceof Error ? cause.message : 'Unable to load assets' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createFinanceClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json() as Partial<AssetWriteInput>
  if (!body.name?.trim() || !body.category || !CATEGORIES.has(body.category) || !body.currency?.trim() || body.currentValue === undefined || Number(body.currentValue) < 0 || !Array.isArray(body.owners)) {
    return NextResponse.json({ error: 'Name, category, currency, current value, and owners are required' }, { status: 400 })
  }
  const ownership = validateOwnershipAllocations(body.owners)
  if (!ownership.valid) return NextResponse.json({ error: ownership.error }, { status: 400 })
  if (!RATES[body.currency.toUpperCase()]) return NextResponse.json({ error: 'Currency is not supported by the current FX layer' }, { status: 400 })
  const details = validateAssetDetails(body.category, (body.details || {}) as Record<string, unknown>)
  if (!details.valid) return NextResponse.json({ error: details.error }, { status: 400 })
  try {
    const id = await createAsset(supabase, { ...body, details: body.details || { category: body.category } } as AssetWriteInput)
    return NextResponse.json({ id }, { status: 201 })
  } catch (cause) {
    return NextResponse.json({ error: cause instanceof Error ? cause.message : 'Unable to create asset' }, { status: 500 })
  }
}
