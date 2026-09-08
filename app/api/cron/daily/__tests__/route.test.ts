import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createFinanceServiceClient: vi.fn(() => ({ tag: 'service-client' })),
}))
vi.mock('@/lib/finance/snapshots', () => ({
  captureBalanceSnapshots: vi.fn(async () => ({ accounts: 3 })),
}))
vi.mock('@/lib/reports/deliver', () => ({
  runReportForAllChannels: vi.fn(async (_s: unknown, kind: string) => [{ chatId: 100, chunks: 1, kind }]),
}))

import { captureBalanceSnapshots } from '@/lib/finance/snapshots'
import { runReportForAllChannels } from '@/lib/reports/deliver'
import { GET } from '../route'

function request(auth?: string) {
  return new Request('http://localhost/api/cron/daily', {
    headers: auth ? { authorization: auth } : {},
  }) as never
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.stubEnv('CRON_SECRET', 'shh')
  vi.stubEnv('REPORT_TIMEZONE', 'America/Santo_Domingo')
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

describe('GET /api/cron/daily', () => {
  it('rejects requests without the cron secret', async () => {
    vi.setSystemTime(new Date('2026-09-09T11:00:00Z'))
    const res = await GET(request())
    expect(res.status).toBe(401)
    expect(captureBalanceSnapshots).not.toHaveBeenCalled()
  })

  it('snapshots every day and sends nothing on an ordinary weekday', async () => {
    vi.setSystemTime(new Date('2026-09-09T11:00:00Z')) // Wednesday
    const res = await GET(request('Bearer shh'))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(captureBalanceSnapshots).toHaveBeenCalledWith({ tag: 'service-client' }, '2026-09-09')
    expect(runReportForAllChannels).not.toHaveBeenCalled()
    expect(body).toMatchObject({ ok: true, date: '2026-09-09', snapshot: { accounts: 3 }, reports: {} })
  })

  it('sends the weekly report on Monday and the monthly on the 1st, in the local timezone', async () => {
    vi.setSystemTime(new Date('2026-09-07T11:00:00Z')) // Monday 07:00 in Santo Domingo
    await GET(request('Bearer shh'))
    expect(runReportForAllChannels).toHaveBeenCalledWith({ tag: 'service-client' }, 'weekly', expect.any(Date))

    vi.clearAllMocks()
    // 02:00 UTC on Oct 1 is still Sep 30 locally — no monthly report yet.
    vi.setSystemTime(new Date('2026-10-01T02:00:00Z'))
    await GET(request('Bearer shh'))
    expect(captureBalanceSnapshots).toHaveBeenCalledWith(expect.anything(), '2026-09-30')
    expect(runReportForAllChannels).not.toHaveBeenCalled()

    vi.clearAllMocks()
    vi.setSystemTime(new Date('2026-10-01T11:00:00Z'))
    const res = await GET(request('Bearer shh'))
    expect(runReportForAllChannels).toHaveBeenCalledWith(expect.anything(), 'monthly', expect.any(Date))
    expect((await res.json()).reports.monthly).toEqual([{ chatId: 100, chunks: 1, kind: 'monthly' }])
  })

  it('still sends reports when the snapshot fails, and reports the error', async () => {
    vi.setSystemTime(new Date('2026-09-07T11:00:00Z'))
    vi.mocked(captureBalanceSnapshots).mockRejectedValueOnce(new Error('db down'))
    const res = await GET(request('Bearer shh'))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.snapshot).toEqual({ error: 'db down' })
    expect(runReportForAllChannels).toHaveBeenCalledWith(expect.anything(), 'weekly', expect.any(Date))
  })
})
