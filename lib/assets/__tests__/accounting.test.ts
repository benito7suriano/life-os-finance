import { describe, expect, it } from 'vitest'
import {
  attributableValue,
  includedOwnershipPercentage,
  normalizeAssetCategory,
  validateOwnershipAllocations,
  validateAssetDetails,
} from '../accounting'

describe('asset accounting', () => {
  it('normalizes the six imported classes into the four portfolio categories', () => {
    expect(normalizeAssetCategory('real_estate')).toBe('real_estate')
    expect(normalizeAssetCategory('vehicle')).toBe('vehicle')
    expect(normalizeAssetCategory('investment_fund')).toBe('private_investment')
    expect(normalizeAssetCategory('business')).toBe('private_investment')
    expect(normalizeAssetCategory('pension')).toBe('retirement')
    expect(normalizeAssetCategory('retirement')).toBe('retirement')
  })

  it('sums only ownership assigned to net-worth owners', () => {
    expect(
      includedOwnershipPercentage([
        { percentage: 60, includeInNetWorth: true },
        { percentage: 40, includeInNetWorth: false },
      ])
    ).toBe(60)
  })

  it('calculates attributable value to currency precision', () => {
    expect(attributableValue(123456.78, 37.5)).toBe(46296.29)
  })

  it('requires allocations to total exactly 100 percent', () => {
    expect(validateOwnershipAllocations([{ ownerId: 'owner-1', percentage: 100 }])).toEqual({ valid: true })
    expect(
      validateOwnershipAllocations([
        { ownerId: 'owner-1', percentage: 60 },
        { ownerId: 'owner-2', percentage: 30 },
      ])
    ).toEqual({ valid: false, error: 'Ownership allocations must total 100%' })
  })

  it('rejects duplicate, zero, and out-of-range ownership allocations', () => {
    expect(
      validateOwnershipAllocations([
        { ownerId: 'owner-1', percentage: 50 },
        { ownerId: 'owner-1', percentage: 50 },
      ])
    ).toEqual({ valid: false, error: 'Each owner can appear only once' })
    expect(validateOwnershipAllocations([{ ownerId: 'owner-1', percentage: 0 }]).valid).toBe(false)
    expect(validateOwnershipAllocations([{ ownerId: 'owner-1', percentage: 101 }]).valid).toBe(false)
  })

  it('validates category-specific details', () => {
    expect(validateAssetDetails('vehicle', { category: 'real_estate' }).valid).toBe(false)
    expect(validateAssetDetails('vehicle', { year: 1800 }).valid).toBe(false)
    expect(validateAssetDetails('retirement', { accountReferenceLast4: '12345' }).valid).toBe(false)
    expect(validateAssetDetails('private_investment', { website: 'not a url' }).valid).toBe(false)
    expect(validateAssetDetails('vehicle', { year: 2017, currentMileage: 50000 })).toEqual({ valid: true })
  })
})
