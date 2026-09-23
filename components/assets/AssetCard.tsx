'use client'

import { ArrowUpRight, AlertCircle } from 'lucide-react'
import { Card } from '@/components/ui'
import { formatCurrency } from '@/lib/fx'
import type { AssetSummary } from '@/lib/assets/types'

export function AssetCard({ asset, onClick }: { asset: AssetSummary; onClick: () => void }) {
  const ownership = asset.owners.map((owner) => `${owner.ownerName} ${Number(owner.percentage.toFixed(2))}%`).join(' · ')
  return (
    <Card hoverable onClick={onClick} pad={20} className="group h-full">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2"><p className="truncate text-[15px] font-semibold text-fg">{asset.name}</p>{asset.deletedAt && <span className="rounded-full bg-white/[.06] px-2 py-0.5 text-[9px] uppercase tracking-wider text-fg3">Archived</span>}</div>
          <p className="mt-1 truncate text-xs text-fg3">{asset.subtype || asset.primaryFact || 'Details not set'}</p>
        </div>
        <ArrowUpRight size={17} className="shrink-0 text-fg4 transition-colors group-hover:text-accent" />
      </div>
      <div className="mt-6 grid grid-cols-2 gap-3">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[.14em] text-fg4">Market value</p>
          <p className="mt-1 font-mono text-sm text-fg2">{formatCurrency(asset.totalMarketValue, asset.currency)}</p>
        </div>
        <div className="border-l border-card pl-3">
          <p className="font-mono text-[9px] uppercase tracking-[.14em] text-fg4">Your value</p>
          <p className="mt-1 font-mono text-sm font-semibold text-fg">{formatCurrency(asset.currentValue, asset.currency)}</p>
        </div>
      </div>
      <div className="mt-5 flex items-center justify-between gap-3 border-t border-card pt-4 text-[11px] text-fg3">
        <span className="truncate">{ownership || 'Ownership missing'}</span>
        <span className="shrink-0 font-mono">{asset.latestValuationDate || 'No valuation'}</span>
      </div>
      {asset.primaryFact && <p className="mt-2 truncate text-xs text-fg2">{asset.primaryFact}</p>}
      {asset.needsDetails && (
        <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-amber-400/10 px-2.5 py-1 text-[11px] text-warn">
          <AlertCircle size={12} /> Needs details
        </span>
      )}
    </Card>
  )
}
