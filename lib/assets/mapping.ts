import type { AssetCategory } from './types'
import type { AssetClassDetails, AssetDetail, AssetsSummary, AssetValuation, OwnerAllocation, RetirementDetails } from './types'
import { toUsd } from '@/lib/fx'

type Details = Record<string, unknown>

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

export function getAssetPrimaryFact(category: AssetCategory, details: Details): string | undefined {
  if (category === 'real_estate') {
    const city = text(details.city)
    const country = text(details.country)
    return [city, country].filter(Boolean).join(', ') || text(details.propertyType)
  }
  if (category === 'vehicle') {
    const year = typeof details.year === 'number' ? String(details.year) : undefined
    return [year, text(details.make), text(details.model)].filter(Boolean).join(' ') || undefined
  }
  if (category === 'private_investment') {
    return text(details.companyName) || text(details.investmentName) || text(details.investmentType)
  }
  return text(details.providerName) || text(details.planName) || text(details.planType)
}

export function assetNeedsDetails(category: AssetCategory, details: Details): boolean {
  if (category === 'real_estate') {
    return !text(details.propertyType) || !text(details.city) || !text(details.country)
  }
  if (category === 'vehicle') {
    return !text(details.vin) || !text(details.make) || !text(details.model) || typeof details.year !== 'number'
  }
  if (category === 'private_investment') {
    return !text(details.investmentType) || !text(details.investmentName)
  }
  return !text(details.planType) || (!text(details.providerName) && !text(details.planName))
}

export interface AssetRows {
  accounts: Array<Record<string, unknown>>
  profiles: Array<Record<string, unknown>>
  ownerships: Array<Record<string, unknown>>
  valuations: Array<Record<string, unknown>>
  detailsByCategory: Record<AssetCategory, Array<Record<string, unknown>>>
}

function optionalNumber(value: unknown): number | undefined {
  return value === null || value === undefined || value === '' ? undefined : Number(value)
}

function mapDetails(category: AssetCategory, row: Record<string, unknown>): AssetClassDetails {
  if (category === 'real_estate') {
    return {
      category,
      propertyType: text(row.property_type),
      primaryResidence: Boolean(row.primary_residence),
      purchasePrice: optionalNumber(row.purchase_price),
      purchaseDate: text(row.purchase_date),
      street: text(row.street),
      city: text(row.city),
      stateProvince: text(row.state_province),
      postalCode: text(row.postal_code),
      country: text(row.country),
    }
  }
  if (category === 'vehicle') {
    return {
      category,
      vin: text(row.vin),
      make: text(row.make),
      model: text(row.model),
      year: optionalNumber(row.year),
      purchasePrice: optionalNumber(row.purchase_price),
      purchaseDate: text(row.purchase_date),
      currentMileage: optionalNumber(row.current_mileage),
      mileageAsOf: text(row.mileage_as_of),
    }
  }
  if (category === 'private_investment') {
    return {
      category,
      investmentType: text(row.investment_type),
      investmentName: text(row.investment_name),
      companyName: text(row.company_name),
      companyDescription: text(row.company_description),
      website: text(row.website),
      investmentDate: text(row.investment_date),
      costBasis: optionalNumber(row.cost_basis),
      sharesOrUnits: optionalNumber(row.shares_or_units),
      unitLabel: text(row.unit_label),
    }
  }
  return {
    category,
    planType: text(row.plan_type),
    planName: text(row.plan_name),
    providerName: text(row.provider_name),
    accountReferenceLast4: text(row.account_reference_last4),
    startDate: text(row.start_date),
    contributionAmount: optionalNumber(row.contribution_amount),
    contributionFrequency: text(row.contribution_frequency) as RetirementDetails['contributionFrequency'],
    targetRetirementDate: text(row.target_retirement_date),
  } as AssetClassDetails
}

function mapValuation(row: Record<string, unknown>): AssetValuation {
  return {
    id: String(row.id),
    valuedOn: String(row.valued_on),
    totalValue: Number(row.total_value),
    includedOwnershipPercentage: Number(row.included_ownership_percentage),
    netWorthValue: Number(row.net_worth_value),
    ownershipSnapshot: Array.isArray(row.ownership_snapshot)
      ? (row.ownership_snapshot as Array<Record<string, unknown>>).map((owner) => ({
          ownerId: String(owner.ownerId),
          ownerName: String(owner.ownerName),
          percentage: Number(owner.percentage),
          includeInNetWorth: Boolean(owner.includeInNetWorth),
        }))
      : [],
    currency: String(row.currency || 'USD'),
    source: text(row.source),
    notes: text(row.notes),
    createdAt: String(row.created_at),
  }
}

export function assembleAssets(rows: AssetRows): AssetDetail[] {
  const profiles = new Map(rows.profiles.map((row) => [String(row.account_id), row]))
  const detailMaps = Object.fromEntries(
    Object.entries(rows.detailsByCategory).map(([category, items]) => [
      category,
      new Map(items.map((row) => [String(row.account_id), row])),
    ])
  ) as Record<AssetCategory, Map<string, Record<string, unknown>>>

  return rows.accounts.map((account) => {
    const id = String(account.id)
    const category = account.asset_class as AssetCategory
    const detailRow = detailMaps[category].get(id) || {}
    const details = mapDetails(category, detailRow)
    const valuations = rows.valuations
      .filter((row) => String(row.account_id) === id)
      .map(mapValuation)
      .sort((a, b) => b.valuedOn.localeCompare(a.valuedOn) || b.createdAt.localeCompare(a.createdAt))
    const latest = valuations[0]
    const owners: OwnerAllocation[] = rows.ownerships
      .filter((row) => String(row.asset_account_id) === id)
      .map((row) => {
        const owner = (row.owner || {}) as Record<string, unknown>
        return {
          ownerId: String(row.owner_id),
          ownerName: String(owner.name || 'Unknown owner'),
          percentage: Number(row.percentage),
          includeInNetWorth: Boolean(owner.include_in_net_worth),
        }
      })
    const currency = String(account.currency || 'USD')
    const currentValue = Number(account.balance)
    const totalMarketValue = latest?.totalValue ?? currentValue
    const profile = profiles.get(id)
    const subtype =
      details.category === 'real_estate' ? details.propertyType
      : details.category === 'vehicle' ? [details.year, details.make, details.model].filter(Boolean).join(' ')
      : details.category === 'private_investment' ? details.investmentType
      : details.planType

    return {
      id,
      name: String(account.name),
      category,
      subtype: subtype || undefined,
      currency,
      currentValue,
      currentValueUsd: toUsd(currentValue, currency),
      totalMarketValue,
      totalMarketValueUsd: toUsd(totalMarketValue, currency),
      latestValuationDate: latest?.valuedOn,
      latestValuationSource: latest?.source,
      deletedAt: text(account.deleted_at),
      notes: profile ? text(profile.notes) : undefined,
      owners,
      needsDetails: assetNeedsDetails(category, details as unknown as Details),
      primaryFact: getAssetPrimaryFact(category, details as unknown as Details),
      details,
      valuations,
    }
  })
}

export function summarizeAssets(assets: AssetDetail[]): AssetsSummary {
  const byCategory: AssetsSummary['byCategory'] = {
    real_estate: { count: 0, valueUsd: 0 },
    vehicle: { count: 0, valueUsd: 0 },
    private_investment: { count: 0, valueUsd: 0 },
    retirement: { count: 0, valueUsd: 0 },
  }
  let totalMarketValueUsd = 0
  let includedNetWorthValueUsd = 0
  let activeCount = 0

  for (const asset of assets) {
    if (asset.deletedAt) continue
    activeCount += 1
    totalMarketValueUsd += asset.totalMarketValueUsd
    includedNetWorthValueUsd += asset.currentValueUsd
    byCategory[asset.category].count += 1
    byCategory[asset.category].valueUsd += asset.currentValueUsd
  }

  return { totalMarketValueUsd, includedNetWorthValueUsd, activeCount, byCategory }
}
