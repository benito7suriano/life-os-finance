'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AssetForm, AssetsPortfolio } from '@/components/assets'
import { createAsset, createAssetOwner, listAssetOwners, listAssets } from '@/lib/api/client'
import type { AssetDetail, AssetOwner, AssetsSummary, AssetWriteInput } from '@/lib/assets/types'

const emptySummary: AssetsSummary = {
  totalMarketValueUsd: 0, includedNetWorthValueUsd: 0, activeCount: 0,
  byCategory: { real_estate: { count: 0, valueUsd: 0 }, vehicle: { count: 0, valueUsd: 0 }, private_investment: { count: 0, valueUsd: 0 }, retirement: { count: 0, valueUsd: 0 } },
}

export default function AssetsPage() {
  const router = useRouter()
  const [assets, setAssets] = useState<AssetDetail[]>([])
  const [owners, setOwners] = useState<AssetOwner[]>([])
  const [summary, setSummary] = useState(emptySummary)
  const [showArchived, setShowArchived] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [portfolio, ownerData] = await Promise.all([listAssets({ archived: showArchived }), listAssetOwners()])
      setAssets(portfolio.assets); setSummary(portfolio.summary); setOwners(ownerData.owners)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load assets') }
    finally { setLoading(false) }
  }, [showArchived])

  useEffect(() => { void load() }, [load])

  async function save(input: AssetWriteInput | Partial<AssetWriteInput>) {
    const result = await createAsset(input as AssetWriteInput)
    await load(); router.refresh(); router.push(`/assets/${result.id}`)
  }
  async function addOwner(name: string) {
    const result = await createAssetOwner({ name, ownerType: 'person', includeInNetWorth: true })
    setOwners((current) => [...current, result.owner]); return result.owner
  }

  return <>
    <AssetsPortfolio assets={assets} summary={summary} showArchived={showArchived} loading={loading} error={error} onRetry={() => void load()} onToggleArchived={() => setShowArchived((value) => !value)} onCreate={() => setFormOpen(true)} onOpen={(id) => router.push(`/assets/${id}`)} />
    <AssetForm open={formOpen} owners={owners} onClose={() => setFormOpen(false)} onSave={save} onCreateOwner={addOwner} />
  </>
}
