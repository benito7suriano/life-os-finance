import { NextRequest, NextResponse } from 'next/server'
import { createFinanceClient } from '@/lib/supabase/server'
import { computeFinanceSummary } from '@/lib/finance/summary'

export async function GET(_request: NextRequest) {
  const supabase = await createFinanceClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    return NextResponse.json(await computeFinanceSummary(supabase, user.id, new Date()))
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'summary fetch failed' },
      { status: 500 }
    )
  }
}
