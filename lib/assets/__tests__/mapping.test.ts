import { describe, expect, it } from 'vitest'
import { assembleAssets, assetNeedsDetails, getAssetPrimaryFact, summarizeAssets } from '../mapping'

describe('asset presentation mapping', () => {
  it('selects a useful primary fact for each category', () => {
    expect(getAssetPrimaryFact('real_estate', { city: 'Santo Domingo', country: 'DO' })).toBe('Santo Domingo, DO')
    expect(getAssetPrimaryFact('vehicle', { year: 2017, make: 'Hyundai', model: 'Tucson' })).toBe('2017 Hyundai Tucson')
    expect(getAssetPrimaryFact('private_investment', { companyName: 'Aureus Investments' })).toBe('Aureus Investments')
    expect(getAssetPrimaryFact('retirement', { providerName: 'RL360' })).toBe('RL360')
  })

  it('marks sparse imported profiles as needing details', () => {
    expect(assetNeedsDetails('vehicle', { make: 'Hyundai' })).toBe(true)
    expect(assetNeedsDetails('vehicle', { make: 'Hyundai', model: 'Tucson', year: 2017, vin: 'VIN123' })).toBe(false)
    expect(assetNeedsDetails('private_investment', { investmentName: 'Aureus', investmentType: 'fund' })).toBe(false)
  })
})

describe('assembleAssets', () => {
  it('joins profile data and uses the latest valuation for total market value', () => {
    const assets = assembleAssets({
      accounts: [{ id: 'asset-1', name: '8-VII 154', asset_class: 'real_estate', balance: 50000, currency: 'USD', deleted_at: null }],
      profiles: [{ account_id: 'asset-1', notes: 'Apartment' }],
      ownerships: [{ asset_account_id: 'asset-1', owner_id: 'owner-1', percentage: 50, owner: { name: 'Beno', include_in_net_worth: true } }],
      valuations: [
        { id: 'old', account_id: 'asset-1', valued_on: '2025-01-01', total_value: 90000, included_ownership_percentage: 50, net_worth_value: 45000, currency: 'USD', created_at: '2025-01-01T00:00:00Z' },
        { id: 'new', account_id: 'asset-1', valued_on: '2026-01-01', total_value: 100000, included_ownership_percentage: 50, net_worth_value: 50000, currency: 'USD', source: 'Appraisal', created_at: '2026-01-01T00:00:00Z' },
      ],
      detailsByCategory: {
        real_estate: [{ account_id: 'asset-1', property_type: 'Apartment', city: 'Santo Domingo', country: 'DO', primary_residence: true }],
        vehicle: [],
        private_investment: [],
        retirement: [],
      },
    })

    expect(assets[0]).toMatchObject({
      id: 'asset-1',
      category: 'real_estate',
      currentValue: 50000,
      totalMarketValue: 100000,
      latestValuationDate: '2026-01-01',
      latestValuationSource: 'Appraisal',
      primaryFact: 'Santo Domingo, DO',
      needsDetails: false,
      notes: 'Apartment',
    })
    expect(assets[0].owners[0]).toEqual({ ownerId: 'owner-1', ownerName: 'Beno', percentage: 50, includeInNetWorth: true })
    expect(assets[0].valuations).toHaveLength(2)
  })

  it('summarizes active assets by category without counting archived rows', () => {
    const makeAsset = (id: string, category: 'real_estate' | 'vehicle', currentValueUsd: number, totalMarketValueUsd: number, deletedAt?: string) => ({
      id, category, currentValueUsd, totalMarketValueUsd, deletedAt,
    })
    const summary = summarizeAssets([
      makeAsset('a', 'real_estate', 50, 100),
      makeAsset('b', 'vehicle', 20, 20),
      makeAsset('c', 'vehicle', 30, 30, '2026-01-01'),
    ] as never)
    expect(summary).toMatchObject({ totalMarketValueUsd: 120, includedNetWorthValueUsd: 70, activeCount: 2 })
    expect(summary.byCategory.real_estate).toEqual({ count: 1, valueUsd: 50 })
    expect(summary.byCategory.vehicle).toEqual({ count: 1, valueUsd: 20 })
  })
})
