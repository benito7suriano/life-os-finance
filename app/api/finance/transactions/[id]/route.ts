import { NextRequest, NextResponse } from 'next/server'
import { createFinanceClient } from '@/lib/supabase/server'
import { toUsd, fromUsd } from '@/lib/fx'
import { applyTransactionBalances, legsFromRow } from '@/lib/finance/apply-balances'

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
  const { type, date, description, amount, categoryId, accountId, fromAccountId, toAccountId, toAmount, toCurrency, goalAllocations } = body

  // Validate
  if (!type || !description || !amount || amount <= 0) {
    return NextResponse.json(
      { error: 'Missing required fields: type, description, amount (> 0)' },
      { status: 400 }
    )
  }

  // Reverse the old balance effects. legsFromRow uses the stored to_amount for
  // the destination leg, so cross-currency transfers reverse exactly.
  try {
    await applyTransactionBalances(supabase, legsFromRow(existing), -1)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Balance update failed' },
      { status: 500 }
    )
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

  // Update the transaction record, re-stamping currency fields from the
  // (possibly changed) accounts — mirrors the create path.
  const involvedIds = [accountId, fromAccountId, toAccountId].filter(Boolean) as string[]
  const acctCurrency = new Map<string, string>()
  if (involvedIds.length > 0) {
    const { data: involved } = await supabase
      .from('accounts')
      .select('id, currency')
      .in('id', involvedIds)
    for (const a of involved || []) {
      acctCurrency.set(a.id, a.currency || 'USD')
    }
  }
  const sourceAccountId = type === 'transfer' ? fromAccountId : accountId
  const sourceCurrency = acctCurrency.get(sourceAccountId) ?? 'USD'

  const updateData: Record<string, unknown> = {
    type,
    date: date || existing.date,
    description,
    amount,
    currency: sourceCurrency,
    to_amount: null,
    to_currency: null,
  }

  // Amount credited to the destination of a transfer (converted/explicit for
  // cross-currency ones).
  let creditAmount = amount

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
    const destCurrency = toCurrency || acctCurrency.get(toAccountId) || sourceCurrency
    if (destCurrency !== sourceCurrency) {
      creditAmount = toAmount != null ? Number(toAmount) : fromUsd(toUsd(amount, sourceCurrency), destCurrency)
      updateData.to_currency = destCurrency
      updateData.to_amount = creditAmount
    }
  }

  const { data: updated, error: updateError } = await supabase
    .from('transactions')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (updateError) {
    // Restore the balances we reversed above so the failed edit is a no-op.
    try {
      await applyTransactionBalances(supabase, legsFromRow(existing), 1)
    } catch {
      // best-effort; the update error is the one worth reporting
    }
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  // Apply the new balance effects.
  try {
    await applyTransactionBalances(
      supabase,
      {
        type,
        amount,
        toAmount: type === 'transfer' ? creditAmount : undefined,
        fromAccountId: type === 'expense' ? accountId : type === 'transfer' ? fromAccountId : undefined,
        toAccountId: type === 'income' ? accountId : type === 'transfer' ? toAccountId : undefined,
      },
      1
    )
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Balance update failed' },
      { status: 500 }
    )
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

  // Reverse balance effects (stored to_amount for the destination leg).
  try {
    await applyTransactionBalances(supabase, legsFromRow(existing), -1)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Balance update failed' },
      { status: 500 }
    )
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
    // Restore the balances we reversed so the failed delete is a no-op.
    try {
      await applyTransactionBalances(supabase, legsFromRow(existing), 1)
    } catch {
      // best-effort
    }
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
