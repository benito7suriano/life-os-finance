import { describe, it, expect, vi } from 'vitest'
import { applyTransactionBalances, legsFromRow, type BalanceRpcClient } from '../apply-balances'

function stubClient(error: { message?: string } | null = null) {
  const rpc = vi.fn(async () => ({ error }))
  return { client: { rpc } as unknown as BalanceRpcClient, rpc }
}

describe('applyTransactionBalances', () => {
  it('debits the source account for an expense', async () => {
    const { client, rpc } = stubClient()
    await applyTransactionBalances(client, { type: 'expense', amount: 50, fromAccountId: 'a1' }, 1)
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith('update_account_balance', { p_account_id: 'a1', p_delta: -50 })
  })

  it('credits the destination account for income', async () => {
    const { client, rpc } = stubClient()
    await applyTransactionBalances(client, { type: 'income', amount: 200, toAccountId: 'a2' }, 1)
    expect(rpc).toHaveBeenCalledWith('update_account_balance', { p_account_id: 'a2', p_delta: 200 })
  })

  it('moves both legs of a same-currency transfer', async () => {
    const { client, rpc } = stubClient()
    await applyTransactionBalances(
      client,
      { type: 'transfer', amount: 500, fromAccountId: 'bank', toAccountId: 'card' },
      1
    )
    expect(rpc).toHaveBeenNthCalledWith(1, 'update_account_balance', { p_account_id: 'bank', p_delta: -500 })
    expect(rpc).toHaveBeenNthCalledWith(2, 'update_account_balance', { p_account_id: 'card', p_delta: 500 })
  })

  it('prefers toAmount for the destination leg of a cross-currency transfer', async () => {
    const { client, rpc } = stubClient()
    await applyTransactionBalances(
      client,
      { type: 'transfer', amount: 1500, toAmount: 25.42, fromAccountId: 'dop', toAccountId: 'usd' },
      1
    )
    expect(rpc).toHaveBeenNthCalledWith(1, 'update_account_balance', { p_account_id: 'dop', p_delta: -1500 })
    expect(rpc).toHaveBeenNthCalledWith(2, 'update_account_balance', { p_account_id: 'usd', p_delta: 25.42 })
  })

  it('reverses all legs with sign -1', async () => {
    const { client, rpc } = stubClient()
    await applyTransactionBalances(
      client,
      { type: 'transfer', amount: 1500, toAmount: 25.42, fromAccountId: 'dop', toAccountId: 'usd' },
      -1
    )
    expect(rpc).toHaveBeenNthCalledWith(1, 'update_account_balance', { p_account_id: 'dop', p_delta: 1500 })
    expect(rpc).toHaveBeenNthCalledWith(2, 'update_account_balance', { p_account_id: 'usd', p_delta: -25.42 })
  })

  it('skips legs whose account id is missing', async () => {
    const { client, rpc } = stubClient()
    await applyTransactionBalances(client, { type: 'transfer', amount: 100, toAccountId: 'only-to' }, 1)
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith('update_account_balance', { p_account_id: 'only-to', p_delta: 100 })
  })

  it('throws when the RPC reports an error', async () => {
    const { client } = stubClient({ message: 'function does not exist' })
    await expect(
      applyTransactionBalances(client, { type: 'expense', amount: 10, fromAccountId: 'a1' }, 1)
    ).rejects.toThrow(/balance update failed for account a1/)
  })
})

describe('legsFromRow', () => {
  it('maps a snake_case row including the stored destination amount', () => {
    expect(
      legsFromRow({
        type: 'transfer',
        amount: '1500.00',
        to_amount: '25.42',
        from_account_id: 'dop',
        to_account_id: 'usd',
      })
    ).toEqual({ type: 'transfer', amount: 1500, toAmount: 25.42, fromAccountId: 'dop', toAccountId: 'usd' })
  })

  it('leaves toAmount undefined when the row has none', () => {
    const legs = legsFromRow({ type: 'expense', amount: 12, from_account_id: 'a1', to_account_id: null })
    expect(legs.toAmount).toBeUndefined()
    expect(legs.toAccountId).toBeUndefined()
  })
})
