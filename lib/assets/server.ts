/* eslint-disable @typescript-eslint/no-explicit-any */
import { assembleAssets, summarizeAssets } from './mapping'
import { validateAssetDetails, validateOwnershipAllocations } from './accounting'
import type {
  AssetActivity,
  AssetCategory,
  AssetDetail,
  AssetOwner,
  AssetWriteInput,
  OwnerAllocationInput,
} from './types'

type FinanceClient = any

const DETAIL_TABLE: Record<AssetCategory, string> = {
  real_estate: 'real_estate_assets',
  vehicle: 'vehicle_assets',
  private_investment: 'private_investment_assets',
  retirement: 'retirement_assets',
}
const ASSET_CATEGORIES: AssetCategory[] = ['real_estate', 'vehicle', 'private_investment', 'retirement']

function fail(error: { message?: string } | null, fallback: string): void {
  if (error) throw new Error(error.message || fallback)
}

function compact<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, item === '' ? null : item])) as T
}

function detailPayload(category: AssetCategory, details: Record<string, unknown>): Record<string, unknown> {
  if (category === 'real_estate') {
    return compact({
      property_type: details.propertyType,
      primary_residence: details.primaryResidence ?? false,
      purchase_price: details.purchasePrice,
      purchase_date: details.purchaseDate,
      street: details.street,
      city: details.city,
      state_province: details.stateProvince,
      postal_code: details.postalCode,
      country: details.country,
    })
  }
  if (category === 'vehicle') {
    return compact({
      vin: details.vin,
      make: details.make,
      model: details.model,
      year: details.year,
      purchase_price: details.purchasePrice,
      purchase_date: details.purchaseDate,
      current_mileage: details.currentMileage,
      mileage_as_of: details.mileageAsOf,
    })
  }
  if (category === 'private_investment') {
    return compact({
      investment_type: details.investmentType,
      investment_name: details.investmentName,
      company_name: details.companyName,
      company_description: details.companyDescription,
      website: details.website,
      investment_date: details.investmentDate,
      cost_basis: details.costBasis,
      shares_or_units: details.sharesOrUnits,
      unit_label: details.unitLabel,
    })
  }
  return compact({
    plan_type: details.planType,
    plan_name: details.planName,
    provider_name: details.providerName,
    account_reference_last4: details.accountReferenceLast4,
    start_date: details.startDate,
    contribution_amount: details.contributionAmount,
    contribution_frequency: details.contributionFrequency,
    target_retirement_date: details.targetRetirementDate,
  })
}

export async function loadAssets(
  supabase: FinanceClient,
  userId: string,
  archived: boolean | undefined = false
) {
  let accountQuery = supabase
    .from('accounts')
    .select('id, name, asset_class, balance, currency, deleted_at')
    .eq('user_id', userId)
    .eq('type', 'investment')
    .in('asset_class', ASSET_CATEGORIES)
    .order('name')
  if (archived === true) accountQuery = accountQuery.not('deleted_at', 'is', null)
  else if (archived === false) accountQuery = accountQuery.is('deleted_at', null)

  const { data: accounts, error: accountError } = await accountQuery
  fail(accountError, 'Unable to load assets')
  const ids = (accounts || []).map((row: { id: string }) => row.id)
  if (ids.length === 0) return { assets: [], summary: summarizeAssets([]) }

  const [profilesResult, ownershipsResult, valuationsResult, realEstateResult, vehiclesResult, privateResult, retirementResult] =
    await Promise.all([
      supabase.from('asset_profiles').select('account_id, notes').eq('user_id', userId).in('account_id', ids),
      supabase.from('asset_ownerships').select('asset_account_id, owner_id, percentage, owner:asset_owners(name, include_in_net_worth)').eq('user_id', userId).in('asset_account_id', ids),
      supabase.from('asset_valuations').select('*').eq('user_id', userId).in('account_id', ids).order('valued_on', { ascending: false }),
      supabase.from('real_estate_assets').select('*').eq('user_id', userId).in('account_id', ids),
      supabase.from('vehicle_assets').select('*').eq('user_id', userId).in('account_id', ids),
      supabase.from('private_investment_assets').select('*').eq('user_id', userId).in('account_id', ids),
      supabase.from('retirement_assets').select('*').eq('user_id', userId).in('account_id', ids),
    ])
  for (const result of [profilesResult, ownershipsResult, valuationsResult, realEstateResult, vehiclesResult, privateResult, retirementResult]) {
    fail(result.error, 'Unable to load asset details')
  }

  const assets = assembleAssets({
    accounts: accounts || [],
    profiles: profilesResult.data || [],
    ownerships: ownershipsResult.data || [],
    valuations: valuationsResult.data || [],
    detailsByCategory: {
      real_estate: realEstateResult.data || [],
      vehicle: vehiclesResult.data || [],
      private_investment: privateResult.data || [],
      retirement: retirementResult.data || [],
    },
  })
  return { assets, summary: summarizeAssets(assets) }
}

export async function loadAsset(supabase: FinanceClient, userId: string, id: string): Promise<AssetDetail | null> {
  const { assets } = await loadAssets(supabase, userId, undefined)
  return assets.find((asset) => asset.id === id) || null
}

export async function createAsset(supabase: FinanceClient, input: AssetWriteInput): Promise<string> {
  const validation = validateOwnershipAllocations(input.owners)
  if (!validation.valid) throw new Error(validation.error)
  const { data, error } = await supabase.rpc('create_asset', {
    p_name: input.name,
    p_category: input.category,
    p_currency: input.currency,
    p_notes: input.notes || null,
    p_current_value: input.currentValue,
    p_valued_on: new Date().toISOString().slice(0, 10),
    p_valuation_source: input.valuationSource || 'Opening value',
    p_owners: input.owners,
    p_details: input.details,
  })
  fail(error, 'Unable to create asset')
  return String(data)
}

export async function updateAsset(
  supabase: FinanceClient,
  userId: string,
  id: string,
  input: Partial<AssetWriteInput>
): Promise<void> {
  const { data: account, error: accountError } = await supabase
    .from('accounts').select('id, asset_class').eq('id', id).eq('user_id', userId).eq('type', 'investment').single()
  if (accountError || !account) throw new Error('Asset not found')
  if (input.category && input.category !== account.asset_class) throw new Error('Asset category cannot be changed')
  if (input.owners) {
    const validation = validateOwnershipAllocations(input.owners)
    if (!validation.valid) throw new Error(validation.error)
  }

  if (input.name !== undefined) {
    const { error } = await supabase.from('accounts').update({ name: input.name.trim() }).eq('id', id).eq('user_id', userId)
    fail(error, 'Unable to update asset')
  }
  if (input.notes !== undefined) {
    const { error } = await supabase.from('asset_profiles').update({ notes: input.notes || null, updated_at: new Date().toISOString() }).eq('account_id', id).eq('user_id', userId)
    fail(error, 'Unable to update asset notes')
  }
  if (input.details) {
    const category = account.asset_class as AssetCategory
    const validation = validateAssetDetails(category, input.details as Record<string, unknown>)
    if (!validation.valid) throw new Error(validation.error)
    const { error } = await supabase.from(DETAIL_TABLE[category]).upsert({ account_id: id, user_id: userId, ...detailPayload(category, input.details as Record<string, unknown>) })
    fail(error, 'Unable to update asset details')
  }
  if (input.owners) {
    const { error } = await supabase.rpc('replace_asset_ownerships', { p_account_id: id, p_owners: input.owners })
    fail(error, 'Unable to update asset ownership')
  }
}

export async function setAssetArchived(supabase: FinanceClient, userId: string, id: string, archived: boolean): Promise<void> {
  const { data, error } = await supabase.from('accounts').update({ deleted_at: archived ? new Date().toISOString() : null }).eq('id', id).eq('user_id', userId).eq('type', 'investment').select('id').maybeSingle()
  fail(error, archived ? 'Unable to archive asset' : 'Unable to restore asset')
  if (!data) throw new Error('Asset not found')
}

export async function recordAssetValuation(
  supabase: FinanceClient,
  id: string,
  input: { totalValue: number; valuedOn: string; source?: string; notes?: string }
): Promise<void> {
  const { error } = await supabase.rpc('record_asset_valuation', {
    p_account_id: id,
    p_total_value: input.totalValue,
    p_valued_on: input.valuedOn,
    p_source: input.source || null,
    p_notes: input.notes || null,
  })
  fail(error, 'Unable to record valuation')
}

export async function listAssetOwners(supabase: FinanceClient, userId: string, archived = false): Promise<AssetOwner[]> {
  let query = supabase.from('asset_owners').select('*').eq('user_id', userId).order('name')
  query = archived ? query.not('archived_at', 'is', null) : query.is('archived_at', null)
  const { data, error } = await query
  fail(error, 'Unable to load owners')
  return (data || []).map((row: any) => ({
    id: row.id,
    name: row.name,
    ownerType: row.owner_type,
    includeInNetWorth: row.include_in_net_worth,
    archivedAt: row.archived_at || undefined,
  }))
}

export async function createAssetOwner(
  supabase: FinanceClient,
  userId: string,
  input: { name: string; ownerType?: string; includeInNetWorth?: boolean }
): Promise<AssetOwner> {
  const { data, error } = await supabase.from('asset_owners').insert({
    user_id: userId,
    name: input.name.trim(),
    owner_type: input.ownerType || 'person',
    include_in_net_worth: input.includeInNetWorth ?? true,
  }).select().single()
  fail(error, 'Unable to create owner')
  return {
    id: data.id,
    name: data.name,
    ownerType: data.owner_type,
    includeInNetWorth: data.include_in_net_worth,
    archivedAt: data.archived_at || undefined,
  }
}

export async function listAssetActivity(
  supabase: FinanceClient,
  userId: string,
  assetId: string,
  page = 1,
  limit = 20
): Promise<{ activity: AssetActivity[]; totalCount: number; totalPages: number }> {
  const from = Math.max(0, page - 1) * limit
  const to = from + limit - 1
  const { data, error, count } = await supabase
    .from('transactions')
    .select('id, date, description, type, amount, to_amount, currency, to_currency, from_account_id, to_account_id, related_asset_id, asset_activity_kind, source, from_account:accounts!transactions_from_account_id_fkey(name), to_account:accounts!transactions_to_account_id_fkey(name)', { count: 'exact' })
    .eq('user_id', userId)
    .or(`from_account_id.eq.${assetId},to_account_id.eq.${assetId},related_asset_id.eq.${assetId}`)
    .order('date', { ascending: false })
    .range(from, to)
  fail(error, 'Unable to load asset activity')
  const activity = (data || []).map((row: any) => {
    const incoming = row.to_account_id === assetId || (row.related_asset_id === assetId && row.type === 'income')
    const amount = row.to_account_id === assetId && row.to_amount != null ? Number(row.to_amount) : Number(row.amount)
    const accountName = row.to_account_id === assetId
      ? row.from_account?.name
      : row.from_account_id === assetId
        ? row.to_account?.name
        : row.type === 'income'
          ? row.to_account?.name
          : row.from_account?.name
    return {
      id: row.id,
      date: row.date,
      description: row.description,
      type: row.type,
      activityKind: row.asset_activity_kind || undefined,
      amount,
      currency: row.to_account_id === assetId && row.to_currency ? row.to_currency : row.currency || 'USD',
      direction: incoming ? 'in' : 'out',
      accountName,
      source: row.source,
    } as AssetActivity
  })
  return { activity, totalCount: count || 0, totalPages: Math.ceil((count || 0) / limit) }
}

export async function recomputeAssetsForOwner(
  supabase: FinanceClient,
  userId: string,
  ownerId: string
): Promise<void> {
  const { data, error } = await supabase.from('asset_ownerships').select('asset_account_id, owner_id, percentage').eq('user_id', userId).eq('owner_id', ownerId)
  fail(error, 'Unable to update owner assets')
  for (const row of data || []) {
    const { data: allocations, error: allocationError } = await supabase.from('asset_ownerships').select('owner_id, percentage').eq('asset_account_id', row.asset_account_id).eq('user_id', userId)
    fail(allocationError, 'Unable to update owner assets')
    const owners: OwnerAllocationInput[] = (allocations || []).map((allocation: any) => ({ ownerId: allocation.owner_id, percentage: Number(allocation.percentage) }))
    const { error: rpcError } = await supabase.rpc('replace_asset_ownerships', { p_account_id: row.asset_account_id, p_owners: owners })
    fail(rpcError, 'Unable to update owner assets')
  }
}
