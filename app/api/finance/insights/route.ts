import { NextRequest, NextResponse } from 'next/server'
import { createFinanceClient } from '@/lib/supabase/server'
import { assembleInsightInput } from '@/lib/insights/assemble'
import { buildInsights } from '@/lib/insights/rules'

// Assembles the InsightInput from real data and runs the deterministic rules
// engine (lib/insights/rules.ts). Returns { insights, generatedAt } ranked by
// importance; the dashboard card shows the top one and Dismiss advances.
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
    const insights = buildInsights(await assembleInsightInput(supabase, user.id, new Date()))
    return NextResponse.json({ insights, generatedAt: new Date().toISOString() })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'insights fetch failed' },
      { status: 500 }
    )
  }
}
