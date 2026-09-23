'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { AssetDetailView, AssetForm } from '@/components/assets'
import { Button } from '@/components/ui'
import { archiveAsset, createAssetActivity, createAssetOwner, getAsset, listAccounts, listAssetActivity, listAssetOwners, listCategories, recordAssetValuation, restoreAsset, updateAsset } from '@/lib/api/client'
import type { AssetActivityInput } from '@/lib/assets/activity'
import type { AssetActivity, AssetDetail, AssetOwner, AssetWriteInput } from '@/lib/assets/types'

type AccountOption = { id: string; name: string; type: string; currency?: string }
type CategoryOption = { id: string; name: string; type: 'income' | 'expense' }

export default function AssetPage() {
  const router = useRouter()
  const id = String(useParams<{ id: string }>().id)
  const [asset, setAsset] = useState<AssetDetail | null>(null)
  const [activity, setActivity] = useState<AssetActivity[]>([])
  const [owners, setOwners] = useState<AssetOwner[]>([])
  const [accounts, setAccounts] = useState<AccountOption[]>([])
  const [categories, setCategories] = useState<CategoryOption[]>([])
  const [editOpen, setEditOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [assetData, activityData, ownerData, accountData, incomeData, expenseData] = await Promise.all([
        getAsset(id), listAssetActivity(id), listAssetOwners(), listAccounts(), listCategories({ type: 'income' }), listCategories({ type: 'expense' }),
      ])
      setAsset(assetData.asset); setActivity(activityData.activity); setOwners(ownerData.owners)
      setAccounts(accountData.accounts as AccountOption[])
      setCategories([...(incomeData.categories as CategoryOption[]), ...(expenseData.categories as CategoryOption[])])
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load asset') }
    finally { setLoading(false) }
  }, [id])

  useEffect(() => { void load() }, [load])
  async function refresh() { await load(); router.refresh() }
  async function save(input: AssetWriteInput | Partial<AssetWriteInput>) { await updateAsset(id, input); await refresh() }
  async function addOwner(name: string) { const result = await createAssetOwner({ name }); setOwners((current) => [...current, result.owner]); return result.owner }

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center font-mono text-xs text-fg3">Loading asset…</div>
  if (error || !asset) return <div className="mx-auto max-w-lg p-8 text-center"><p className="text-sm text-bad">{error || 'Asset not found'}</p><Button className="mt-4" onClick={() => void load()}>Retry</Button></div>

  return <>
    <AssetDetailView asset={asset} activity={activity} accounts={accounts} categories={categories} onBack={() => router.push('/assets')} onEdit={() => setEditOpen(true)}
      onValuation={async (input) => { await recordAssetValuation(id, input); await refresh() }}
      onActivity={async (input: AssetActivityInput) => { await createAssetActivity(id, input); await refresh() }}
      onArchive={async () => { await archiveAsset(id); router.push('/assets'); router.refresh() }}
      onRestore={async () => { await restoreAsset(id); await refresh() }} />
    <AssetForm open={editOpen} asset={asset} owners={owners} onClose={() => setEditOpen(false)} onSave={save} onCreateOwner={addOwner} />
  </>
}
