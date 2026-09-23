import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AssetsPortfolio } from '../AssetsPortfolio'
import type { AssetDetail, AssetsSummary } from '@/lib/assets/types'

const asset: AssetDetail = {
  id: 'home-1', name: '8VII Homes', category: 'real_estate', subtype: undefined, currency: 'USD', currentValue: 44240, currentValueUsd: 44240,
  totalMarketValue: 44240, totalMarketValueUsd: 44240, latestValuationDate: '2026-09-13', latestValuationSource: 'Opening ledger balance',
  owners: [{ ownerId: 'beno', ownerName: 'Beno', percentage: 100, includeInNetWorth: true }], needsDetails: true, details: { category: 'real_estate', primaryResidence: false },
  valuations: [{ id: 'v1', valuedOn: '2026-09-13', totalValue: 44240, includedOwnershipPercentage: 100, netWorthValue: 44240, ownershipSnapshot: [{ ownerId: 'beno', ownerName: 'Beno', percentage: 100, includeInNetWorth: true }], currency: 'USD', createdAt: '2026-09-13T00:00:00Z' }],
}
const summary: AssetsSummary = { totalMarketValueUsd: 44240, includedNetWorthValueUsd: 44240, activeCount: 1, byCategory: { real_estate: { count: 1, valueUsd: 44240 }, vehicle: { count: 0, valueUsd: 0 }, private_investment: { count: 0, valueUsd: 0 }, retirement: { count: 0, valueUsd: 0 } } }

describe('AssetsPortfolio', () => {
  it('shows portfolio values, grouped assets, and incomplete-profile guidance', () => {
    render(<AssetsPortfolio assets={[asset]} summary={summary} showArchived={false} onRetry={vi.fn()} onToggleArchived={vi.fn()} onCreate={vi.fn()} onOpen={vi.fn()} />)
    expect(screen.getByRole('heading', { level: 1, name: 'Assets' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Real Estate' })).toBeInTheDocument()
    expect(screen.getByText('8VII Homes')).toBeInTheDocument()
    expect(screen.getByText('Needs details')).toBeInTheDocument()
    expect(screen.getAllByText('$44,240.00').length).toBeGreaterThan(0)
  })

  it('opens an asset from its card', async () => {
    const onOpen = vi.fn()
    render(<AssetsPortfolio assets={[asset]} summary={summary} showArchived={false} onRetry={vi.fn()} onToggleArchived={vi.fn()} onCreate={vi.fn()} onOpen={onOpen} />)
    await userEvent.click(screen.getByText('8VII Homes'))
    expect(onOpen).toHaveBeenCalledWith('home-1')
  })
})
