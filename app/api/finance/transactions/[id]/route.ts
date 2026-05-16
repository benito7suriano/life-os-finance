import { NextRequest, NextResponse } from 'next/server'
import { createFinanceClient } from '@/lib/supabase/server'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createFinanceClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch existing transaction
  const { data: existing, error: fetchError } = await supabase
    .from('transactions')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (fetchError || !existing) {
    return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
  }

  const body = await request.json()
  const { type, date, description, amount, categoryId, accountId, fromAccountId, toAccountId, goalAllocations } = body

  // Validate
  if (!type || !description || !amount || amount <= 0) {
    return NextResponse.json(
      { error: 'Missing required fields: type, description, amount (> 0)' },
      { status: 400 }
    )
  }

  // Reverse old balance changes
  const oldAmount = Number(existing.amount)
  if (existing.type === 'expense' && existing.from_account_id) {
    const { data: acc } = await supabase
      .from('accounts')
      .select('balance')
      .eq('id', existing.from_account_id)
      .single()
    if (acc) {
      await supabase
        .from('accounts')
        .update({ balance: Number(acc.balance) + oldAmount })
        .eq('id', existing.from_account_id)
    }
  } else if (existing.type === 'income' && existing.to_account_id) {
    const { data: acc } = await supabase
      .from('accounts')
      .select('balance')
      .eq('id', existing.to_account_id)
      .single()
    if (acc) {
      await supabase
        .from('accounts')
        .update({ balance: Number(acc.balance) - oldAmount })
        .eq('id', existing.to_account_id)
    }
  } else if (existing.type === 'transfer') {
    if (existing.from_account_id) {
      const { data: acc } = await supabase
        .from('accounts')
        .select('balance')
        .eq('id', existing.from_account_id)
        .single()
      if (acc) {
        await supabase
          .from('accounts')
          .update({ balance: Number(acc.balance) + oldAmount })
          .eq('id', existing.from_account_id)
      }
    }
    if (existing.to_account_id) {
      const { data: acc } = await supabase
        .from('accounts')
        .select('balance')
        .eq('id', existing.to_account_id)
        .single()
      if (acc) {
        await supabase
          .from('accounts')
          .update({ balance: Number(acc.balance) - oldAmount })
          .eq('id', existing.to_account_id)
      }
    }
  }

  // Delete old goal contributions and reverse goal balances
  const { data: oldContributions } = await supabase
    .from('goal_contributions')
    .select('*')
    .eq('transaction_id', id)

  if (oldContributions && oldContributions.length > 0) {
    for (const contrib of oldContributions) {
      const { data: goal } = await supabase
        .from('goals')
        .select('current_balance')
        .eq('id', contrib.goal_id)
        .single()
      if (goal) {
        await supabase
          .from('goals')
          .update({
            current_balance: Number(goal.current_balance) - Number(contrib.amount),
          })
          .eq('id', contrib.goal_id)
      }
    }
    await supabase.from('goal_contributions').delete().eq('transaction_id', id)
  }

  // Update transaction record
  const updateData: Record<string, unknown> = {
    type,
    date: date || existing.date,
    description,
    amount,
  }

  if (type === 'expense') {
    updateData.from_account_id = accountId
    updateData.to_account_id = null
    updateData.category_id = categoryId
  } else if (type === 'income') {
    updateData.from_account_id = null
    updateData.to_account_id = accountId
    updateData.category_id = categoryId
  } else if (type === 'transfer') {
    updateData.from_account_id = fromAccountId
    updateData.to_account_id = toAccountId
    updateData.category_id = null
  }

  const { data: updated, error: updateError } = await supabase
    .from('transactions')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  // Apply new balance changes
  if (type === 'expense' && accountId) {
    const { data: acc } = await supabase
      .from('accounts')
      .select('balance')
      .eq('id', accountId)
      .single()
    if (acc) {
      await supabase
        .from('accounts')
        .update({ balance: Number(acc.balance) - amount })
        .eq('id', accountId)
    }
  } else if (type === 'income' && accountId) {
    const { data: acc } = await supabase
      .from('accounts')
      .select('balance')
      .eq('id', accountId)
      .single()
    if (acc) {
      await supabase
        .from('accounts')
        .update({ balance: Number(acc.balance) + amount })
        .eq('id', accountId)
    }
  } else if (type === 'transfer') {
    if (fromAccountId) {
      const { data: acc } = await supabase
        .from('accounts')
        .select('balance')
        .eq('id', fromAccountId)
        .single()
      if (acc) {
        await supabase
          .from('accounts')
          .update({ balance: Number(acc.balance) - amount })
          .eq('id', fromAccountId)
      }
    }
    if (toAccountId) {
      const { data: acc } = await supabase
        .from('accounts')
        .select('balance')
        .eq('id', toAccountId)
        .single()
      if (acc) {
        await supabase
          .from('accounts')
          .update({ balance: Number(acc.balance) + amount })
          .eq('id', toAccountId)
      }
    }
  }

  // Create new goal contributions
  if (type === 'transfer' && goalAllocations && Array.isArray(goalAllocations)) {
    for (const allocation of goalAllocations) {
      if (allocation.goalId && allocation.amount > 0) {
        await supabase.from('goal_contributions').insert({
          goal_id: allocation.goalId,
          transaction_id: id,
          amount: allocation.amount,
          date: date || existing.date,
        })

        const { data: goal } = await supabase
          .from('goals')
          .select('current_balance')
          .eq('id', allocation.goalId)
          .single()
        if (goal) {
          await supabase
            .from('goals')
            .update({
              current_balance: Number(goal.current_balance) + allocation.amount,
            })
            .eq('id', allocation.goalId)
        }
      }
    }
  }

  return NextResponse.json({ transaction: updated })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createFinanceClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch existing transaction
  const { data: existing, error: fetchError } = await supabase
    .from('transactions')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (fetchError || !existing) {
    return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
  }

  const oldAmount = Number(existing.amount)

  // Reverse balance changes
  if (existing.type === 'expense' && existing.from_account_id) {
    const { data: acc } = await supabase
      .from('accounts')
      .select('balance')
      .eq('id', existing.from_account_id)
      .single()
    if (acc) {
      await supabase
        .from('accounts')
        .update({ balance: Number(acc.balance) + oldAmount })
        .eq('id', existing.from_account_id)
    }
  } else if (existing.type === 'income' && existing.to_account_id) {
    const { data: acc } = await supabase
      .from('accounts')
      .select('balance')
      .eq('id', existing.to_account_id)
      .single()
    if (acc) {
      await supabase
        .from('accounts')
        .update({ balance: Number(acc.balance) - oldAmount })
        .eq('id', existing.to_account_id)
    }
  } else if (existing.type === 'transfer') {
    if (existing.from_account_id) {
      const { data: acc } = await supabase
        .from('accounts')
        .select('balance')
        .eq('id', existing.from_account_id)
        .single()
      if (acc) {
        await supabase
          .from('accounts')
          .update({ balance: Number(acc.balance) + oldAmount })
          .eq('id', existing.from_account_id)
      }
    }
    if (existing.to_account_id) {
      const { data: acc } = await supabase
        .from('accounts')
        .select('balance')
        .eq('id', existing.to_account_id)
        .single()
      if (acc) {
        await supabase
          .from('accounts')
          .update({ balance: Number(acc.balance) - oldAmount })
          .eq('id', existing.to_account_id)
      }
    }
  }

  // Reverse goal contributions
  const { data: contributions } = await supabase
    .from('goal_contributions')
    .select('*')
    .eq('transaction_id', id)

  if (contributions && contributions.length > 0) {
    for (const contrib of contributions) {
      const { data: goal } = await supabase
        .from('goals')
        .select('current_balance')
        .eq('id', contrib.goal_id)
        .single()
      if (goal) {
        await supabase
          .from('goals')
          .update({
            current_balance: Number(goal.current_balance) - Number(contrib.amount),
          })
          .eq('id', contrib.goal_id)
      }
    }
    // Goal contributions are cascade-deleted when transaction is deleted
  }

  // Delete the transaction
  const { error: deleteError } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id)

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
