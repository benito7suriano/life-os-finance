import { describe, expect, it } from 'vitest'
import { buildAssetActivityTransaction } from '../activity'

const base = { date: '2026-09-14', description: 'Asset activity', amount: 500 }

describe('buildAssetActivityTransaction', () => {
  it('turns a contribution into a cash-to-asset transfer', () => {
    expect(
      buildAssetActivityTransaction('asset-1', {
        ...base,
        activityKind: 'capital_contribution',
        cashAccountId: 'cash-1',
      })
    ).toEqual({
      ...base,
      type: 'transfer',
      fromAccountId: 'cash-1',
      toAccountId: 'asset-1',
      relatedAssetId: 'asset-1',
      assetActivityKind: 'capital_contribution',
    })
  })

  it('turns a distribution into an asset-to-cash transfer', () => {
    const result = buildAssetActivityTransaction('asset-1', {
      ...base,
      activityKind: 'capital_distribution',
      cashAccountId: 'cash-1',
    })
    expect(result.type).toBe('transfer')
    expect(result.fromAccountId).toBe('asset-1')
    expect(result.toAccountId).toBe('cash-1')
  })

  it('posts income to cash while retaining asset attribution', () => {
    const result = buildAssetActivityTransaction('asset-1', {
      ...base,
      activityKind: 'dividend',
      cashAccountId: 'cash-1',
      categoryId: 'income-category',
    })
    expect(result).toMatchObject({
      type: 'income',
      accountId: 'cash-1',
      categoryId: 'income-category',
      relatedAssetId: 'asset-1',
      assetActivityKind: 'dividend',
    })
  })

  it('posts asset expenses from cash without using the asset as a balance leg', () => {
    const result = buildAssetActivityTransaction('asset-1', {
      ...base,
      activityKind: 'maintenance',
      cashAccountId: 'cash-1',
      categoryId: 'expense-category',
    })
    expect(result).toMatchObject({
      type: 'expense',
      accountId: 'cash-1',
      categoryId: 'expense-category',
      relatedAssetId: 'asset-1',
    })
  })

  it('rejects missing categories for income and expenses', () => {
    expect(() =>
      buildAssetActivityTransaction('asset-1', {
        ...base,
        activityKind: 'interest',
        cashAccountId: 'cash-1',
      })
    ).toThrow('A category is required')
  })
})
