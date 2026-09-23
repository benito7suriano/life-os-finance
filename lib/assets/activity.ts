import type { AssetActivityKind } from './types'

const INCOME_KINDS = new Set<AssetActivityKind>(['dividend', 'interest', 'rent', 'other_income'])
const EXPENSE_KINDS = new Set<AssetActivityKind>(['fee', 'tax', 'insurance', 'maintenance', 'other_expense'])

export interface AssetActivityInput {
  activityKind: AssetActivityKind
  cashAccountId: string
  categoryId?: string
  date: string
  description: string
  amount: number
  toAmount?: number
  toCurrency?: string
}

export interface AssetActivityTransactionInput {
  type: 'expense' | 'income' | 'transfer'
  date: string
  description: string
  amount: number
  accountId?: string
  categoryId?: string
  fromAccountId?: string
  toAccountId?: string
  toAmount?: number
  toCurrency?: string
  relatedAssetId: string
  assetActivityKind: AssetActivityKind
}

export function buildAssetActivityTransaction(
  assetId: string,
  input: AssetActivityInput
): AssetActivityTransactionInput {
  if (!assetId || !input.cashAccountId) throw new Error('An asset and cash account are required')
  if (!input.description.trim()) throw new Error('Description is required')
  if (!Number.isFinite(input.amount) || input.amount <= 0) throw new Error('Amount must be greater than 0')

  const base = {
    date: input.date,
    description: input.description.trim(),
    amount: input.amount,
    relatedAssetId: assetId,
    assetActivityKind: input.activityKind,
  }

  if (input.activityKind === 'capital_contribution') {
    return {
      ...base,
      type: 'transfer',
      fromAccountId: input.cashAccountId,
      toAccountId: assetId,
      ...(input.toAmount != null ? { toAmount: input.toAmount } : {}),
      ...(input.toCurrency ? { toCurrency: input.toCurrency } : {}),
    }
  }
  if (input.activityKind === 'capital_distribution') {
    return {
      ...base,
      type: 'transfer',
      fromAccountId: assetId,
      toAccountId: input.cashAccountId,
      ...(input.toAmount != null ? { toAmount: input.toAmount } : {}),
      ...(input.toCurrency ? { toCurrency: input.toCurrency } : {}),
    }
  }

  if (!input.categoryId) throw new Error('A category is required for asset income and expenses')
  if (INCOME_KINDS.has(input.activityKind)) {
    return { ...base, type: 'income', accountId: input.cashAccountId, categoryId: input.categoryId }
  }
  if (EXPENSE_KINDS.has(input.activityKind)) {
    return { ...base, type: 'expense', accountId: input.cashAccountId, categoryId: input.categoryId }
  }

  throw new Error('Unsupported asset activity type')
}

