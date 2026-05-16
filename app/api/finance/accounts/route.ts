import { NextRequest, NextResponse } from 'next/server'
import { createFinanceClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createFinanceClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const archived = searchParams.get('archived') === 'true'

  // Build accounts query with joins to institutions and credit card providers
  let query = supabase
    .from('accounts')
    .select(`
      *,
      institution:institutions(id, name),
      provider:credit_card_providers(id, name, icon)
    `)
    .eq('user_id', user.id)

  // Filter by soft-delete status
  if (archived) {
    query = query.not('deleted_at', 'is', null)
  } else {
    query = query.is('deleted_at', null)
  }

  query = query.order('name')

  const { data: accounts, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Compute balanceChange for each account from transactions this month
  const now = new Date()
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split('T')[0]

  const { data: monthTransactions } = await supabase
    .from('transactions')
    .select('type, amount, from_account_id, to_account_id')
    .eq('user_id', user.id)
    .gte('date', firstOfMonth)

  const changeMap: Record<string, number> = {}
  for (const t of monthTransactions || []) {
    const amount = Number(t.amount)
    if (t.type === 'expense' && t.from_account_id) {
      changeMap[t.from_account_id] = (changeMap[t.from_account_id] || 0) - amount
    } else if (t.type === 'income' && t.to_account_id) {
      changeMap[t.to_account_id] = (changeMap[t.to_account_id] || 0) + amount
    } else if (t.type === 'transfer') {
      if (t.from_account_id) {
        changeMap[t.from_account_id] = (changeMap[t.from_account_id] || 0) - amount
      }
      if (t.to_account_id) {
        changeMap[t.to_account_id] = (changeMap[t.to_account_id] || 0) + amount
      }
    }
  }

  // Load linked goals for savings accounts
  const savingsAccountIds = (accounts || [])
    .filter((a) => a.type === 'savings')
    .map((a) => a.id)

  const goalsMap: Record<string, Array<{
    id: string
    name: string
    currentBalance: number
    targetAmount: number
    targetDate: string
    status: string
  }>> = {}

  if (savingsAccountIds.length > 0) {
    const { data: goals } = await supabase
      .from('goals')
      .select('id, name, current_balance, target_amount, target_date, status, linked_account_id')
      .eq('user_id', user.id)
      .in('linked_account_id', savingsAccountIds)

    for (const goal of goals || []) {
      if (!goalsMap[goal.linked_account_id]) goalsMap[goal.linked_account_id] = []
      goalsMap[goal.linked_account_id].push({
        id: goal.id,
        name: goal.name,
        currentBalance: Number(goal.current_balance),
        targetAmount: Number(goal.target_amount),
        targetDate: goal.target_date,
        status: goal.status,
      })
    }
  }

  // Map DB snake_case to camelCase for frontend
  const mapped = (accounts || []).map((a) => {
    const base = {
      id: a.id,
      type: a.type,
      name: a.name,
      balance: Number(a.balance),
      balanceChange: changeMap[a.id] || 0,
      deletedAt: a.deleted_at || undefined,
    }

    switch (a.type) {
      case 'checking':
        return {
          ...base,
          beneficiaryName: a.beneficiary_name || '',
          institutionId: a.institution_id,
          institutionName: a.institution?.name || null,
          accountNumber: a.account_number,
          currency: a.currency || 'USD',
          interestRate: a.interest_rate ? Number(a.interest_rate) : null,
          hasDebitCard: a.has_debit_card || false,
        }
      case 'savings': {
        const linkedGoals = goalsMap[a.id] || []
        const goalBalanceSum = linkedGoals.reduce((s, g) => s + g.currentBalance, 0)
        return {
          ...base,
          beneficiaryName: a.beneficiary_name || '',
          institutionId: a.institution_id,
          institutionName: a.institution?.name || null,
          accountNumber: a.account_number,
          currency: a.currency || 'USD',
          interestRate: a.interest_rate ? Number(a.interest_rate) : null,
          linkedGoals,
          unallocatedBalance: Number(a.balance) - goalBalanceSum,
        }
      }
      case 'credit_card':
        return {
          ...base,
          icon: a.provider?.icon || a.icon || '',
          providerId: a.provider_id,
          providerName: a.provider?.name || '',
          institutionId: a.institution_id,
          institutionName: a.institution?.name || '',
          last4Digits: a.last_4_digits || '',
          expirationDate: a.expiration_date || '',
          cutoffDate: a.cutoff_date,
          paymentDate: a.payment_date,
          interestRate: Number(a.interest_rate),
          creditLimit: Number(a.credit_limit),
        }
      case 'loan':
        return {
          ...base,
          institutionId: a.institution_id,
          institutionName: a.institution?.name || null,
          originalAmount: Number(a.original_amount),
          interestRate: Number(a.interest_rate),
          paymentAmount: Number(a.payment_amount),
          paymentFrequency: a.payment_frequency,
          dueDay: a.due_day,
          termMonths: a.term_months,
          originationDate: a.origination_date,
          maturityDate: a.maturity_date,
        }
      case 'wallet':
        return {
          ...base,
          icon: a.icon || 'wallet',
          currency: a.currency || 'USD',
        }
      default:
        return base
    }
  })

  return NextResponse.json({ accounts: mapped })
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
  const { type, name, balance } = body

  if (!type || !name || balance === undefined) {
    return NextResponse.json(
      { error: 'Missing required fields: type, name, balance' },
      { status: 400 }
    )
  }

  // Map camelCase body to snake_case for DB
  const insertData: Record<string, unknown> = {
    user_id: user.id,
    type,
    name,
    balance,
  }

  if (body.beneficiaryName) insertData.beneficiary_name = body.beneficiaryName
  if (body.institutionId) insertData.institution_id = body.institutionId
  if (body.accountNumber) insertData.account_number = body.accountNumber
  if (body.currency) insertData.currency = body.currency
  if (body.interestRate !== undefined && body.interestRate !== null) insertData.interest_rate = body.interestRate
  if (body.hasDebitCard !== undefined) insertData.has_debit_card = body.hasDebitCard
  if (body.providerId) insertData.provider_id = body.providerId
  if (body.last4Digits) insertData.last_4_digits = body.last4Digits
  if (body.expirationDate) insertData.expiration_date = body.expirationDate
  if (body.cutoffDate !== undefined) insertData.cutoff_date = body.cutoffDate
  if (body.paymentDate !== undefined) insertData.payment_date = body.paymentDate
  if (body.creditLimit !== undefined) insertData.credit_limit = body.creditLimit
  if (body.originalAmount !== undefined) insertData.original_amount = body.originalAmount
  if (body.paymentAmount !== undefined) insertData.payment_amount = body.paymentAmount
  if (body.paymentFrequency) insertData.payment_frequency = body.paymentFrequency
  if (body.dueDay !== undefined) insertData.due_day = body.dueDay
  if (body.termMonths !== undefined) insertData.term_months = body.termMonths
  if (body.originationDate) insertData.origination_date = body.originationDate
  if (body.maturityDate) insertData.maturity_date = body.maturityDate
  if (body.icon) insertData.icon = body.icon

  const { data: account, error } = await supabase
    .from('accounts')
    .insert(insertData)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ account }, { status: 201 })
}
