import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  loadAsset: vi.fn(),
  listAssetActivity: vi.fn(),
  createLedgerTransaction: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({ createFinanceClient: vi.fn(async () => ({ auth: { getUser: mocks.getUser } })) }))
vi.mock('@/lib/assets/server', () => ({ loadAsset: mocks.loadAsset, listAssetActivity: mocks.listAssetActivity }))
vi.mock('@/lib/finance/transactions', () => ({ createLedgerTransaction: mocks.createLedgerTransaction }))

import { GET, POST } from '../route'

const routeContext = { params: Promise.resolve({ id: 'asset-1' }) }

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
  mocks.loadAsset.mockResolvedValue({ id: 'asset-1' })
})

describe('/api/finance/assets/[id]/activity', () => {
  it('returns paginated activity', async () => {
    mocks.listAssetActivity.mockResolvedValue({ activity: [], totalCount: 0, totalPages: 0 })
    const response = await GET(new Request('http://localhost/api/finance/assets/asset-1/activity?page=2&limit=5') as never, routeContext)
    expect(response.status).toBe(200)
    expect(mocks.listAssetActivity).toHaveBeenCalledWith(expect.anything(), 'user-1', 'asset-1', 2, 5)
  })

  it('uses the shared ledger transaction service', async () => {
    mocks.createLedgerTransaction.mockResolvedValue({ id: 'tx-1' })
    const response = await POST(new Request('http://localhost/api/finance/assets/asset-1/activity', {
      method: 'POST', body: JSON.stringify({ activityKind: 'capital_contribution', cashAccountId: 'cash-1', date: '2026-09-13', description: 'Contribution', amount: 50 }),
    }) as never, routeContext)
    expect(response.status).toBe(201)
    expect(mocks.createLedgerTransaction).toHaveBeenCalledWith(expect.anything(), 'user-1', expect.objectContaining({ relatedAssetId: 'asset-1', toAccountId: 'asset-1' }))
  })

  it('rejects income without a category', async () => {
    const response = await POST(new Request('http://localhost/api/finance/assets/asset-1/activity', {
      method: 'POST', body: JSON.stringify({ activityKind: 'dividend', cashAccountId: 'cash-1', date: '2026-09-13', description: 'Dividend', amount: 50 }),
    }) as never, routeContext)
    expect(response.status).toBe(400)
    expect(mocks.createLedgerTransaction).not.toHaveBeenCalled()
  })
})
