import type { AssetCategory, LegacyAssetClass, OwnerAllocationInput } from './types'

export function normalizeAssetCategory(assetClass: LegacyAssetClass): AssetCategory {
  if (assetClass === 'investment_fund' || assetClass === 'business') return 'private_investment'
  if (assetClass === 'pension') return 'retirement'
  return assetClass
}

export function includedOwnershipPercentage(
  allocations: Array<{ percentage: number; includeInNetWorth: boolean }>
): number {
  return allocations
    .filter((allocation) => allocation.includeInNetWorth)
    .reduce((sum, allocation) => sum + allocation.percentage, 0)
}

export function attributableValue(totalValue: number, includedPercentage: number): number {
  return Math.round(totalValue * (includedPercentage / 100) * 100) / 100
}

export function validateOwnershipAllocations(
  allocations: OwnerAllocationInput[]
): { valid: true } | { valid: false; error: string } {
  if (allocations.length === 0) {
    return { valid: false, error: 'At least one owner is required' }
  }

  const ownerIds = new Set<string>()
  for (const allocation of allocations) {
    if (!allocation.ownerId?.trim()) return { valid: false, error: 'Every allocation must reference an owner' }
    if (ownerIds.has(allocation.ownerId)) {
      return { valid: false, error: 'Each owner can appear only once' }
    }
    ownerIds.add(allocation.ownerId)
    if (!Number.isFinite(allocation.percentage) || allocation.percentage <= 0 || allocation.percentage > 100) {
      return { valid: false, error: 'Ownership percentages must be greater than 0 and no more than 100%' }
    }
  }

  const total = allocations.reduce((sum, allocation) => sum + allocation.percentage, 0)
  if (Math.abs(total - 100) > 0.001) {
    return { valid: false, error: 'Ownership allocations must total 100%' }
  }

  return { valid: true }
}

export function validateAssetDetails(
  category: AssetCategory,
  details: Record<string, unknown>
): { valid: true } | { valid: false; error: string } {
  if (details.category && details.category !== category) {
    return { valid: false, error: 'Asset details must match the asset category' }
  }
  const numericFields = ['purchasePrice', 'currentMileage', 'costBasis', 'sharesOrUnits', 'contributionAmount']
  for (const field of numericFields) {
    if (details[field] !== undefined && details[field] !== '' && (!Number.isFinite(Number(details[field])) || Number(details[field]) < 0)) {
      return { valid: false, error: `${field} must be zero or greater` }
    }
  }
  if (category === 'vehicle' && details.year !== undefined && details.year !== '') {
    const year = Number(details.year)
    if (!Number.isInteger(year) || year < 1886 || year > 2200) return { valid: false, error: 'Vehicle year is invalid' }
  }
  if (category === 'retirement' && details.accountReferenceLast4 && !/^[A-Za-z0-9]{1,4}$/.test(String(details.accountReferenceLast4))) {
    return { valid: false, error: 'Account or policy reference must contain at most four letters or digits' }
  }
  if (category === 'private_investment' && details.website) {
    try { new URL(String(details.website)) } catch { return { valid: false, error: 'Website must be a valid URL' } }
  }
  return { valid: true }
}
