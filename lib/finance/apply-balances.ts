// Single choke-point for account-balance effects of a transaction. Every
// write path (manual routes + Telegram webhook) goes through here so the
// double-entry legs stay consistent, via the atomic update_account_balance
// RPC (migration 011) — no read-modify-write races.
//
// NOTE: the transaction row insert/update and these RPC calls are separate
// statements (PostgREST has no cross-statement transactions). Callers decide
// how to compensate if one side fails.

/** The balance-affecting legs of a transaction row. `amount` is the positive
 * source-leg amount in its native currency; `toAmount` is the destination leg
 * of a cross-currency transfer (falls back to `amount` when absent). */
export interface TransactionLegs {
  type: 'expense' | 'income' | 'transfer'
  amount: number
  toAmount?: number | null
  fromAccountId?: string | null
  toAccountId?: string | null
}

/** Minimal structural client so unit tests can stub `rpc` directly. */
export interface BalanceRpcClient {
  rpc(
    fn: 'update_account_balance',
    args: { p_account_id: string; p_delta: number }
  ): PromiseLike<{ error: { message?: string } | null }>
}

/** DB row (snake_case) → legs, using the stored destination amount so
 * cross-currency transfers reverse with the amount that was actually credited. */
export function legsFromRow(row: {
  type: string
  amount: number | string
  to_amount?: number | string | null
  from_account_id?: string | null
  to_account_id?: string | null
}): TransactionLegs {
  return {
    type: row.type as TransactionLegs['type'],
    amount: Number(row.amount),
    toAmount: row.to_amount != null ? Number(row.to_amount) : undefined,
    fromAccountId: row.from_account_id ?? undefined,
    toAccountId: row.to_account_id ?? undefined,
  }
}

/** Apply (`sign: 1`) or reverse (`sign: -1`) a transaction's balance effects.
 * Throws on the first RPC error — no silent fallback. */
export async function applyTransactionBalances(
  supabase: BalanceRpcClient,
  legs: TransactionLegs,
  sign: 1 | -1
): Promise<void> {
  const deltas: { accountId: string; delta: number }[] = []

  if (legs.type === 'expense' && legs.fromAccountId) {
    deltas.push({ accountId: legs.fromAccountId, delta: -legs.amount * sign })
  } else if (legs.type === 'income' && legs.toAccountId) {
    deltas.push({ accountId: legs.toAccountId, delta: legs.amount * sign })
  } else if (legs.type === 'transfer') {
    if (legs.fromAccountId) {
      deltas.push({ accountId: legs.fromAccountId, delta: -legs.amount * sign })
    }
    if (legs.toAccountId) {
      deltas.push({ accountId: legs.toAccountId, delta: (legs.toAmount ?? legs.amount) * sign })
    }
  }

  for (const { accountId, delta } of deltas) {
    const { error } = await supabase.rpc('update_account_balance', {
      p_account_id: accountId,
      p_delta: delta,
    })
    if (error) {
      throw new Error(`balance update failed for account ${accountId}: ${error.message ?? 'unknown error'}`)
    }
  }
}
