import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getUser, loadAssets, createAsset } = vi.hoisted(() => ({
  getUser: vi.fn(),
  loadAssets: vi.fn(),
  createAsset: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createFinanceClient: vi.fn(async () => ({ auth: { getUser } })),
}))
vi.mock('@/lib/assets/server', () => ({ loadAssets, createAsset }))

import { GET, POST } from '../route'

beforeEach(() => {
  vi.clearAllMocks()
  getUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
})

describe('/api/finance/assets', () => {
  it('rejects unauthenticated requests', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null })
    const response = await GET(new Request('http://localhost/api/finance/assets') as never)
    expect(response.status).toBe(401)
    expect(loadAssets).not.toHaveBeenCalled()
  })

  it('returns assets and their portfolio summary', async () => {
    loadAssets.mockResolvedValue({ assets: [{ id: 'asset-1' }], summary: { activeCount: 1 } })
    const response = await GET(new Request('http://localhost/api/finance/assets?archived=false') as never)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ assets: [{ id: 'asset-1' }], summary: { activeCount: 1 } })
    expect(loadAssets).toHaveBeenCalledWith(expect.anything(), 'user-1', false)
  })

  it('rejects malformed ownership before creating an asset', async () => {
    const response = await POST(new Request('http://localhost/api/finance/assets', {
      method: 'POST',
      body: JSON.stringify({ name: 'Car', category: 'vehicle', currency: 'USD', currentValue: 10, owners: [] }),
    }) as never)
    expect(response.status).toBe(400)
    expect(createAsset).not.toHaveBeenCalled()
  })
})
