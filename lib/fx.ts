/**
 * FX helpers. Conversion rates are hardcoded today — update the `RATES` map
 * below as needed. When we outgrow this, move to a `finance.exchange_rates`
 * table or a live rate provider.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * INVARIANT — read before adding a `toUsd()` call:
 *
 *   `toUsd()` is called ONLY inside `/api/finance/*` route mappers. Every API
 *   response carries a precomputed `*Usd` field (e.g. `balanceUsd`, `amountUsd`)
 *   next to the native amount + its `currency`. UI components MUST sum the
 *   `*Usd` field and MUST display native amounts via `formatCurrency(amount,
 *   currency)`. No UI component imports `toUsd`.
 *
 * This keeps currency conversion at a single seam so a new view physically
 * cannot forget to convert.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Dominican Peso per US Dollar. Update manually as the rate drifts. */
export const DOP_PER_USD = 59

/**
 * Units of each currency per 1 USD. USD is the base (rate 1). Add a line here
 * to support another currency — every conversion flows through this map.
 */
export const RATES: Record<string, number> = {
  USD: 1,
  DOP: DOP_PER_USD,
}

/** Convert an amount in the given currency to USD. */
export function toUsd(amount: number, currency: string | null | undefined): number {
  const code = currency || 'USD'
  const rate = RATES[code]
  if (rate === undefined) {
    // Unknown currency: we only handle USD/DOP today. Pass through rather than
    // crash, but make the gap loud in development so it isn't silently wrong.
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[fx] no exchange rate for currency "${code}"; passing amount through unconverted`)
    }
    return amount
  }
  return amount / rate
}

/** Convert a USD amount into the given currency. Inverse of `toUsd`. */
export function fromUsd(amountUsd: number, currency: string | null | undefined): number {
  const code = currency || 'USD'
  const rate = RATES[code]
  if (rate === undefined) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[fx] no exchange rate for currency "${code}"; returning USD amount unconverted`)
    }
    return amountUsd
  }
  return amountUsd * rate
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
