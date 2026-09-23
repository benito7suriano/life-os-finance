export type AssetCategory = 'real_estate' | 'vehicle' | 'private_investment' | 'retirement'

export type LegacyAssetClass =
  | AssetCategory
  | 'investment_fund'
  | 'business'
  | 'pension'

export type AssetActivityKind =
  | 'capital_contribution'
  | 'capital_distribution'
  | 'dividend'
  | 'interest'
  | 'rent'
  | 'fee'
  | 'tax'
  | 'insurance'
  | 'maintenance'
  | 'other_income'
  | 'other_expense'

export type OwnerType = 'person' | 'company' | 'trust' | 'other'

export interface AssetOwner {
  id: string
  name: string
  ownerType: OwnerType
  includeInNetWorth: boolean
  archivedAt?: string
}

export interface OwnerAllocation {
  ownerId: string
  ownerName: string
  percentage: number
  includeInNetWorth: boolean
}

export interface OwnerAllocationInput {
  ownerId: string
  percentage: number
}

export interface AssetValuation {
  id: string
  valuedOn: string
  totalValue: number
  includedOwnershipPercentage: number
  netWorthValue: number
  ownershipSnapshot: OwnerAllocation[]
  currency: string
  source?: string
  notes?: string
  createdAt: string
}

export interface RealEstateDetails {
  category: 'real_estate'
  propertyType?: string
  primaryResidence: boolean
  purchasePrice?: number
  purchaseDate?: string
  street?: string
  city?: string
  stateProvince?: string
  postalCode?: string
  country?: string
}

export interface VehicleDetails {
  category: 'vehicle'
  vin?: string
  make?: string
  model?: string
  year?: number
  purchasePrice?: number
  purchaseDate?: string
  currentMileage?: number
  mileageAsOf?: string
}

export interface PrivateInvestmentDetails {
  category: 'private_investment'
  investmentType?: string
  investmentName?: string
  companyName?: string
  companyDescription?: string
  website?: string
  investmentDate?: string
  costBasis?: number
  sharesOrUnits?: number
  unitLabel?: string
}

export interface RetirementDetails {
  category: 'retirement'
  planType?: string
  planName?: string
  providerName?: string
  accountReferenceLast4?: string
  startDate?: string
  contributionAmount?: number
  contributionFrequency?: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annually'
  targetRetirementDate?: string
}

export type AssetClassDetails =
  | RealEstateDetails
  | VehicleDetails
  | PrivateInvestmentDetails
  | RetirementDetails

export interface AssetSummary {
  id: string
  name: string
  category: AssetCategory
  subtype?: string
  currency: string
  currentValue: number
  currentValueUsd: number
  totalMarketValue: number
  totalMarketValueUsd: number
  latestValuationDate?: string
  latestValuationSource?: string
  deletedAt?: string
  notes?: string
  owners: OwnerAllocation[]
  needsDetails: boolean
  primaryFact?: string
}

export interface AssetDetail extends AssetSummary {
  details: AssetClassDetails
  valuations: AssetValuation[]
}

export interface AssetActivity {
  id: string
  date: string
  description: string
  type: 'expense' | 'income' | 'transfer'
  activityKind?: AssetActivityKind
  amount: number
  currency: string
  direction: 'in' | 'out'
  accountName?: string
  source: string
}

export interface AssetsSummary {
  totalMarketValueUsd: number
  includedNetWorthValueUsd: number
  activeCount: number
  byCategory: Record<AssetCategory, { count: number; valueUsd: number }>
}

export interface AssetWriteInput {
  name: string
  category: AssetCategory
  currency: string
  notes?: string
  currentValue: number
  valuationSource?: string
  owners: OwnerAllocationInput[]
  details: Omit<AssetClassDetails, 'category'> & { category?: AssetCategory }
}
