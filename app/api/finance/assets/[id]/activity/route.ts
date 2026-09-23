import { NextRequest, NextResponse } from 'next/server'
import { createFinanceClient } from '@/lib/supabase/server'
import { buildAssetActivityTransaction } from '@/lib/assets/activity'
import { listAssetActivity, loadAsset } from '@/lib/assets/server'
import { createLedgerTransaction } from '@/lib/finance/transactions'

async function getContext(params: Promise<{ id: string }>) {
  const { id } = await params
  const supabase = await createFinanceClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  return { id, supabase, user: error ? null : user }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id, supabase, user } = await getContext(params)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const search = new URL(request.url).searchParams
  const requestedPage = Number.parseInt(search.get('page') || '1', 10)
  const requestedLimit = Number.parseInt(search.get('limit') || '20', 10)
  const page = Number.isFinite(requestedPage) ? Math.max(1, requestedPage) : 1
  const limit = Number.isFinite(requestedLimit) ? Math.min(100, Math.max(1, requestedLimit)) : 20
  try {
    if (!await loadAsset(supabase, user.id, id)) return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
    return NextResponse.json(await listAssetActivity(supabase, user.id, id, page, limit))
  } catch (cause) {
    return NextResponse.json({ error: cause instanceof Error ? cause.message : 'Unable to load activity' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id, supabase, user } = await getContext(params)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json()
  try {
    if (!await loadAsset(supabase, user.id, id)) return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
    const transactionInput = buildAssetActivityTransaction(id, body)
    const transaction = await createLedgerTransaction(supabase, user.id, transactionInput)
    return NextResponse.json({ transaction }, { status: 201 })
  } catch (cause) {
    return NextResponse.json({ error: cause instanceof Error ? cause.message : 'Unable to record activity' }, { status: 400 })
  }
}
