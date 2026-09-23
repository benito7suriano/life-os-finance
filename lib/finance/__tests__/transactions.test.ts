import { describe, expect, it } from 'vitest'
import { resolveAssetAttribution, validateLedgerTransaction } from '../transactions'

describe('validateLedgerTransaction', () => {
  it('requires matching asset attribution fields', () => {
    expect(validateLedgerTransaction({
      type: 'income', description: 'Dividend', amount: 10, accountId: 'cash', categoryId: 'income', relatedAssetId: 'asset',
    })).toMatch(/provided together/)
  })

  it('rejects activity kinds that do not match the transaction direction', () => {
    expect(validateLedgerTransaction({
      type: 'expense', description: 'Dividend', amount: 10, accountId: 'cash', categoryId: 'income', relatedAssetId: 'asset', assetActivityKind: 'dividend',
    })).toMatch(/direction/)
  })

  it('requires capital contributions to flow into the linked asset', () => {
    expect(validateLedgerTransaction({
      type: 'transfer', description: 'Contribution', amount: 10, fromAccountId: 'cash', toAccountId: 'wrong', relatedAssetId: 'asset', assetActivityKind: 'capital_contribution',
    })).toMatch(/related asset/)
  })

  it('accepts valid income and capital activity', () => {
    expect(validateLedgerTransaction({
      type: 'income', description: 'Dividend', amount: 10, accountId: 'cash', categoryId: 'income', relatedAssetId: 'asset', assetActivityKind: 'dividend',
    })).toBeNull()
    expect(validateLedgerTransaction({
      type: 'transfer', description: 'Contribution', amount: 10, fromAccountId: 'cash', toAccountId: 'asset', relatedAssetId: 'asset', assetActivityKind: 'capital_contribution',
    })).toBeNull()
  })

  it('preserves existing asset attribution unless explicitly changed', () => {
    const existing = { related_asset_id: 'asset-1', asset_activity_kind: 'dividend' as const }
    expect(resolveAssetAttribution({ description: 'Edited' }, existing)).toEqual({ relatedAssetId: 'asset-1', assetActivityKind: 'dividend' })
    expect(resolveAssetAttribution({ relatedAssetId: undefined, assetActivityKind: undefined }, existing)).toEqual({ relatedAssetId: undefined, assetActivityKind: undefined })
  })
})
