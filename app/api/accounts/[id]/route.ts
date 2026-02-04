import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify the account exists and belongs to the user
  const { data: existing, error: fetchError } = await supabase
    .from('accounts')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (fetchError || !existing) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 })
  }

  const body = await request.json()

  // Map camelCase body to snake_case for DB
  const updateData: Record<string, unknown> = {}

  if (body.name !== undefined) updateData.name = body.name
  if (body.balance !== undefined) updateData.balance = body.balance
  if (body.beneficiaryName !== undefined) updateData.beneficiary_name = body.beneficiaryName
  if (body.institutionId !== undefined) updateData.institution_id = body.institutionId || null
  if (body.accountNumber !== undefined) updateData.account_number = body.accountNumber || null
  if (body.currency !== undefined) updateData.currency = body.currency
  if (body.interestRate !== undefined) updateData.interest_rate = body.interestRate
  if (body.hasDebitCard !== undefined) updateData.has_debit_card = body.hasDebitCard
  if (body.providerId !== undefined) updateData.provider_id = body.providerId || null
  if (body.last4Digits !== undefined) updateData.last_4_digits = body.last4Digits
  if (body.expirationDate !== undefined) updateData.expiration_date = body.expirationDate
  if (body.cutoffDate !== undefined) updateData.cutoff_date = body.cutoffDate
  if (body.paymentDate !== undefined) updateData.payment_date = body.paymentDate
  if (body.creditLimit !== undefined) updateData.credit_limit = body.creditLimit
  if (body.originalAmount !== undefined) updateData.original_amount = body.originalAmount
  if (body.paymentAmount !== undefined) updateData.payment_amount = body.paymentAmount
  if (body.paymentFrequency !== undefined) updateData.payment_frequency = body.paymentFrequency
  if (body.dueDay !== undefined) updateData.due_day = body.dueDay
  if (body.termMonths !== undefined) updateData.term_months = body.termMonths
  if (body.originationDate !== undefined) updateData.origination_date = body.originationDate
  if (body.maturityDate !== undefined) updateData.maturity_date = body.maturityDate
  if (body.icon !== undefined) updateData.icon = body.icon

  const { data: updated, error: updateError } = await supabase
    .from('accounts')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ account: updated })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify the account exists and belongs to the user
  const { data: existing, error: fetchError } = await supabase
    .from('accounts')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .single()

  if (fetchError || !existing) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 })
  }

  // Soft delete: set deleted_at timestamp
  const { error } = await supabase
    .from('accounts')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
