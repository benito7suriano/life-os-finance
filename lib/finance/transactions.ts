/* eslint-disable @typescript-eslint/no-explicit-any */
import { fromUsd, toUsd } from '@/lib/fx'
import { applyTransactionBalances } from './apply-balances'
import type { AssetActivityKind } from '@/lib/assets/types'

type FinanceClient = any

export interface LedgerTransactionInput {
  type: 'expense' | 'income' | 'transfer'
  date?: string
  description: string
  amount: number
  categoryId?: string
  accountId?: string
  fromAccountId?: string
  toAccountId?: string
  toAmount?: number
  toCurrency?: string
  relatedAssetId?: string
  assetActivityKind?: AssetActivityKind
  goalAllocations?: Array<{ goalId: string; amount: number }>
}

const ACTIVITY_TYPES: Record<AssetActivityKind, LedgerTransactionInput['type']> = {
  capital_contribution: 'transfer',
  capital_distribution: 'transfer',
  dividend: 'income',
  interest: 'income',
  rent: 'income',
  fee: 'expense',
  tax: 'expense',
  insurance: 'expense',
  maintenance: 'expense',
  other_income: 'income',
  other_expense: 'expense',
}

export function resolveAssetAttribution(
  input: Record<string, unknown>,
  existing: { related_asset_id?: string | null; asset_activity_kind?: AssetActivityKind | null }
) {
  return {
    relatedAssetId: Object.hasOwn(input, 'relatedAssetId') ? input.relatedAssetId as string | undefined : existing.related_asset_id || undefined,
    assetActivityKind: Object.hasOwn(input, 'assetActivityKind') ? input.assetActivityKind as AssetActivityKind | undefined : existing.asset_activity_kind || undefined,
  }
}

export function validateLedgerTransaction(input: LedgerTransactionInput): string | null {
  if (!['expense', 'income', 'transfer'].includes(input.type)) return 'Unsupported transaction type'
  if (!input.description?.trim() || !Number.isFinite(Number(input.amount)) || Number(input.amount) <= 0) {
    return 'Missing required fields: type, description, amount (> 0)'
  }
  if (input.type !== 'transfer' && !input.categoryId) return 'categoryId is required for income/expense'
  if (input.type === 'transfer' && (!input.fromAccountId || !input.toAccountId || input.fromAccountId === input.toAccountId)) {
    return 'Transfers require two different accounts'
  }
  if (input.type !== 'transfer' && !input.accountId) return 'An account is required'
  if (Boolean(input.relatedAssetId) !== Boolean(input.assetActivityKind)) {
    return 'relatedAssetId and assetActivityKind must be provided together'
  }
  if (input.assetActivityKind && ACTIVITY_TYPES[input.assetActivityKind] !== input.type) {
    return 'Asset activity kind does not match the transaction direction'
  }
  if (input.relatedAssetId && input.type === 'transfer') {
    const expectedAsset = input.assetActivityKind === 'capital_contribution' ? input.toAccountId : input.fromAccountId
    if (expectedAsset !== input.relatedAssetId) return 'Capital activity must use the related asset account'
  }
  return null
}

export async function createLedgerTransaction(
  supabase: FinanceClient,
  userId: string,
  input: LedgerTransactionInput
) {
  const validationError = validateLedgerTransaction(input)
  if (validationError) throw new Error(validationError)

  const involvedIds = [input.accountId, input.fromAccountId, input.toAccountId, input.relatedAssetId]
    .filter(Boolean) as string[]
  const { data: involved, error: accountError } = await supabase
    .from('accounts')
    .select('id, currency, type, asset_class')
    .eq('user_id', userId)
    .in('id', [...new Set(involvedIds)])
  if (accountError) throw new Error(accountError.message)
  if ((involved || []).length !== new Set(involvedIds).size) throw new Error('Account not found')

  const accountById = new Map<string, any>((involved || []).map((account: any) => [account.id, account]))
  if (input.relatedAssetId) {
    const asset = accountById.get(input.relatedAssetId)
    if (!asset || asset.type !== 'investment' || !asset.asset_class) throw new Error('Related asset not found')
  }

  const sourceAccountId = input.type === 'transfer' ? input.fromAccountId : input.accountId
  const sourceCurrency = accountById.get(sourceAccountId || '')?.currency || 'USD'
  const transactionData: Record<string, unknown> = {
    user_id: userId,
    type: input.type,
    date: input.date || new Date().toISOString().slice(0, 10),
    description: input.description.trim(),
    amount: Number(input.amount),
    currency: sourceCurrency,
    source: 'manual',
    source_app: 'financial-ledger',
    related_asset_id: input.relatedAssetId || null,
    asset_activity_kind: input.assetActivityKind || null,
  }

  let creditAmount = Number(input.amount)
  if (input.type === 'expense') {
    transactionData.from_account_id = input.accountId
    transactionData.category_id = input.categoryId
  } else if (input.type === 'income') {
    transactionData.to_account_id = input.accountId
    transactionData.category_id = input.categoryId
  } else {
    transactionData.from_account_id = input.fromAccountId
    transactionData.to_account_id = input.toAccountId
    const destinationCurrency = input.toCurrency || accountById.get(input.toAccountId || '')?.currency || sourceCurrency
    if (destinationCurrency !== sourceCurrency) {
      creditAmount = input.toAmount != null
        ? Number(input.toAmount)
        : fromUsd(toUsd(Number(input.amount), sourceCurrency), destinationCurrency)
      transactionData.to_currency = destinationCurrency
      transactionData.to_amount = creditAmount
    }
  }

  const { data: transaction, error } = await supabase.from('transactions').insert(transactionData).select().single()
  if (error) throw new Error(error.message)

  try {
    await applyTransactionBalances(supabase, {
      type: input.type,
      amount: Number(input.amount),
      toAmount: input.type === 'transfer' ? creditAmount : undefined,
      fromAccountId: input.type === 'expense' ? input.accountId : input.type === 'transfer' ? input.fromAccountId : undefined,
      toAccountId: input.type === 'income' ? input.accountId : input.type === 'transfer' ? input.toAccountId : undefined,
    }, 1)
  } catch (cause) {
    await supabase.from('transactions').delete().eq('id', transaction.id)
    throw cause
  }

  if (input.type === 'transfer' && Array.isArray(input.goalAllocations)) {
    for (const allocation of input.goalAllocations) {
      if (!allocation.goalId || allocation.amount <= 0) continue
      await supabase.from('goal_contributions').insert({
        goal_id: allocation.goalId,
        transaction_id: transaction.id,
        amount: allocation.amount,
        date: transactionData.date,
      })
      const { data: goal } = await supabase.from('goals').select('current_balance').eq('id', allocation.goalId).single()
      if (goal) {
        await supabase.from('goals').update({ current_balance: Number(goal.current_balance) + allocation.amount }).eq('id', allocation.goalId)
      }
    }
  }

  return transaction
}
