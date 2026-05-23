import { NextRequest, NextResponse } from 'next/server'
import { createFinanceClient } from '@/lib/supabase/server'

export async function GET(_request: NextRequest) {
  const supabase = await createFinanceClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('goals')
    .select(
      `
      *,
      category:categories(id, name, color, icon, type),
      linked_account:accounts(id, name, type, icon),
      linked_budget:budgets!fk_goals_linked_budget(id, amount, type)
    `
    )
    .eq('user_id', user.id)
    .order('target_date', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const mapped = (data ?? []).map((g) => ({
    id: g.id,
    name: g.name,
    categoryId: g.category_id,
    linkedAccountId: g.linked_account_id,
    linkedBudgetId: g.linked_budget_id,
    targetAmount: Number(g.target_amount),
    targetDate: g.target_date,
    currentBalance: Number(g.current_balance),
    status: g.status,
    category: g.category,
    linkedAccount: g.linked_account,
    linkedBudget: g.linked_budget,
  }))

  return NextResponse.json({ goals: mapped })
}

export async function POST(request: NextRequest) {
  const supabase = await createFinanceClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const {
    name,
    categoryId,
    linkedAccountId,
    linkedBudgetId,
    targetAmount,
    targetDate,
    currentBalance,
    status,
  } = body

  if (!name || !categoryId || !linkedAccountId || !targetAmount || !targetDate) {
    return NextResponse.json(
      {
        error:
          'Missing required fields: name, categoryId, linkedAccountId, targetAmount, targetDate',
      },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from('goals')
    .insert({
      user_id: user.id,
      name,
      category_id: categoryId,
      linked_account_id: linkedAccountId,
      linked_budget_id: linkedBudgetId ?? null,
      target_amount: targetAmount,
      target_date: targetDate,
      current_balance: currentBalance ?? 0,
      status: status ?? 'active',
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ goal: data }, { status: 201 })
}
