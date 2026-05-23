// Currency / number / percent formatting — mirrors the Vault `fmt` helpers.

export function formatCurrency(
  n: number,
  { sign = false, decimals = 2, compact = false }: { sign?: boolean; decimals?: number; compact?: boolean } = {},
): string {
  if (compact && Math.abs(n) >= 1000) {
    return (n < 0 ? '−' : sign && n > 0 ? '+' : '') + '$' + (Math.abs(n) / 1000).toFixed(1) + 'k'
  }
  const abs = Math.abs(n).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
  if (sign && n > 0) return '+$' + abs
  if (n < 0) return '−$' + abs
  return '$' + abs
}

export function formatPercent(n: number, { sign = true }: { sign?: boolean } = {}): string {
  const abs = Math.abs(n).toFixed(1) + '%'
  if (sign && n > 0) return '+' + abs
  if (n < 0) return '−' + abs
  return abs
}

export function formatDate(d: string | number | Date, locale = 'en-US'): string {
  return new Date(d).toLocaleDateString(locale, { month: 'short', day: 'numeric' })
}
