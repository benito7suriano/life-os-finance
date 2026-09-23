import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AssetDetailView } from '../AssetDetailView'
import type { AssetDetail } from '@/lib/assets/types'

const asset: AssetDetail = {
  id: 'vehicle-1', name: 'Hyundai Tucson', category: 'vehicle', subtype: '2017 Hyundai Tucson', primaryFact: '2017 Hyundai Tucson', currency: 'USD',
  currentValue: 15000, currentValueUsd: 15000, totalMarketValue: 15000, totalMarketValueUsd: 15000, latestValuationDate: '2026-09-13', latestValuationSource: 'Dealer estimate',
  owners: [{ ownerId: 'beno', ownerName: 'Beno', percentage: 100, includeInNetWorth: true }], needsDetails: false,
  details: { category: 'vehicle', vin: 'KM8J3CA45HU123456', make: 'Hyundai', model: 'Tucson', year: 2017, currentMileage: 50000 },
  valuations: [{ id: 'v1', valuedOn: '2026-09-13', totalValue: 15000, includedOwnershipPercentage: 100, netWorthValue: 15000, ownershipSnapshot: [{ ownerId: 'beno', ownerName: 'Beno', percentage: 100, includeInNetWorth: true }], currency: 'USD', source: 'Dealer estimate', createdAt: '2026-09-13T00:00:00Z' }],
}

const props = { asset, activity: [{ id: 'tx-1', date: '2026-09-12', description: 'Insurance', type: 'expense' as const, activityKind: 'insurance' as const, amount: 100, currency: 'USD', direction: 'out' as const, source: 'manual' }], accounts: [], categories: [], onBack: vi.fn(), onEdit: vi.fn(), onValuation: vi.fn(), onActivity: vi.fn(), onArchive: vi.fn(), onRestore: vi.fn() }

describe('AssetDetailView', () => {
  it('shows typed details and ownership', () => {
    render(<AssetDetailView {...props} />)
    expect(screen.getByRole('heading', { level: 1, name: 'Hyundai Tucson' })).toBeInTheDocument()
    expect(screen.getByText('KM8J3CA45HU123456')).toBeInTheDocument()
    expect(screen.getByText('Beno')).toBeInTheDocument()
  })

  it('switches between activity and append-only valuations', async () => {
    render(<AssetDetailView {...props} />)
    await userEvent.click(screen.getByRole('button', { name: 'activity' }))
    expect(screen.getByText('Insurance')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'valuations' }))
    expect(screen.getByText(/Append-only record/)).toBeInTheDocument()
    expect(screen.getAllByText('Dealer estimate').length).toBeGreaterThan(0)
  })
})
