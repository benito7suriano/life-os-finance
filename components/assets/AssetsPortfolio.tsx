'use client'

import { Building2, CarFront, Landmark, Plus, Umbrella, Archive } from 'lucide-react'
import { Button, Card } from '@/components/ui'
import { formatCurrency } from '@/lib/fx'
import type { AssetCategory, AssetDetail, AssetsSummary } from '@/lib/assets/types'
import { AssetCard } from './AssetCard'

const sections: Array<{ category: AssetCategory; label: string; icon: typeof Building2 }> = [
  { category: 'real_estate', label: 'Real Estate', icon: Building2 },
  { category: 'vehicle', label: 'Vehicles', icon: CarFront },
  { category: 'private_investment', label: 'Private Investments', icon: Landmark },
  { category: 'retirement', label: 'Retirement', icon: Umbrella },
]

export function AssetsPortfolio({ assets, summary, showArchived, loading, error, onRetry, onToggleArchived, onCreate, onOpen }: {
  assets: AssetDetail[]
  summary: AssetsSummary
  showArchived: boolean
  loading?: boolean
  error?: string
  onRetry: () => void
  onToggleArchived: () => void
  onCreate: () => void
  onOpen: (id: string) => void
}) {
  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6 lg:px-8">
      <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[.18em] text-accent">Portfolio register</p>
          <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-fg">Assets</h1>
          <p className="mt-1 text-[13px] text-fg3">Ownership, valuations, and ledger activity in one place.</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-fg2">
            <input type="checkbox" checked={showArchived} onChange={onToggleArchived} className="h-4 w-4" style={{ accentColor: 'var(--accent-solid)' }} />
            Archived
          </label>
          <Button variant="primary" icon={Plus} onClick={onCreate}>New asset</Button>
        </div>
      </div>

      <Card pad={0} className="mb-9 overflow-hidden">
        <div className="grid md:grid-cols-[1.15fr_.85fr]">
          <div className="p-6 md:p-8">
            <p className="font-mono text-[10px] uppercase tracking-[.16em] text-fg3">Included in net worth</p>
            <p className="mt-3 font-display text-4xl font-semibold tracking-[-.035em] text-fg">{formatCurrency(summary.includedNetWorthValueUsd, 'USD')}</p>
            <div className="mt-5 flex items-center gap-3 text-xs text-fg3">
              <span>{summary.activeCount} active assets</span><span>·</span>
              <span>Total market value {formatCurrency(summary.totalMarketValueUsd, 'USD')}</span>
            </div>
          </div>
          <div className="border-t border-card bg-white/[.018] p-6 md:border-l md:border-t-0 md:p-8">
            <p className="font-mono text-[10px] uppercase tracking-[.16em] text-fg3">Allocation by class</p>
            <div className="mt-4 space-y-3">
              {sections.map(({ category, label }) => {
                const value = summary.byCategory[category].valueUsd
                const width = summary.includedNetWorthValueUsd ? Math.max(2, value / summary.includedNetWorthValueUsd * 100) : 0
                return <div key={category}>
                  <div className="mb-1.5 flex justify-between text-[11px]"><span className="text-fg2">{label}</span><span className="font-mono text-fg3">{formatCurrency(value, 'USD')}</span></div>
                  <div className="h-1 overflow-hidden rounded-full bg-white/[.05]"><div className="h-full rounded-full bg-accent-solid" style={{ width: `${Math.min(width, 100)}%` }} /></div>
                </div>
              })}
            </div>
          </div>
        </div>
      </Card>

      {loading && <div className="py-16 text-center font-mono text-xs text-fg3">Loading assets…</div>}
      {error && <Card className="mb-8 text-center"><p className="text-sm text-bad">{error}</p><Button className="mt-4" onClick={onRetry}>Retry</Button></Card>}
      {!loading && !error && assets.length === 0 && (
        <div className="py-16 text-center">
          <Archive className="mx-auto mb-4 text-fg4" size={36} />
          <h2 className="font-display text-lg font-semibold text-fg">{showArchived ? 'No archived assets' : 'Your asset register is empty'}</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-fg3">Add property, vehicles, private holdings, and retirement plans with ownership-aware valuations.</p>
          {!showArchived && <Button variant="primary" icon={Plus} onClick={onCreate} className="mt-5">Add your first asset</Button>}
        </div>
      )}

      {!loading && !error && <div className="space-y-10">
        {sections.map(({ category, label, icon: Icon }) => {
          const items = assets.filter((asset) => asset.category === category)
          if (!items.length) return null
          return <section key={category}>
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[.04] text-fg2"><Icon size={16} /></span>
              <h2 className="font-display text-base font-semibold text-fg">{label}</h2>
              <span className="font-mono text-xs text-fg4">{items.length}</span>
              <span className="ml-auto font-mono text-xs text-fg2">{formatCurrency(summary.byCategory[category].valueUsd, 'USD')}</span>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{items.map((asset) => <AssetCard key={asset.id} asset={asset} onClick={() => onOpen(asset.id)} />)}</div>
          </section>
        })}
      </div>}
    </div>
  )
}
