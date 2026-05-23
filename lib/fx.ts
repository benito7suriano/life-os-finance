/**
 * FX helpers. Conversion rates are hardcoded today — update the constants below
 * as needed. When we outgrow this, move to a `finance.exchange_rates` table or
 * a live rate provider.
 */

/** Dominican Peso per US Dollar. Update manually as the rate drifts. */
export const DOP_PER_USD = 59

/** Convert an amount in the given currency to USD. */
export function toUsd(amount: number, currency: string | null | undefined): number {
  if (!currency || currency === 'USD') return amount
  if (currency === 'DOP') return amount / DOP_PER_USD
  // Unknown currency — pass through; surfaces as a wrong number rather than a crash.
  return amount
}

/**
 * Format an amount using its native currency. Defaults to USD.
 * With `accounting: true`, negatives render in parentheses — e.g. ($674.18) —
 * instead of a leading minus sign.
 */
export function formatCurrency(
  amount: number,
  currency: string = 'USD',
  opts: { accounting?: boolean } = {},
): string {
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(Math.abs(amount))
  if (amount < 0) return opts.accounting ? `(${formatted})` : `-${formatted}`
  return formatted
}
