// Category colors in the data are stored as Tailwind color *names*
// (e.g. "emerald", "amber") — sometimes a raw hex fallback (e.g. "#94a3b8").
// The Vault theme renders soft pills / dots from hex, so map names → hex and
// pass through anything that already looks like a hex value.

const NAME_TO_HEX: Record<string, string> = {
  emerald: '#10b981',
  teal: '#14b8a6',
  amber: '#f59e0b',
  orange: '#f97316',
  sky: '#0ea5e9',
  violet: '#8b5cf6',
  pink: '#ec4899',
  rose: '#f43f5e',
  red: '#ef4444',
  indigo: '#6366f1',
}

const FALLBACK = '#94a3b8'

/** Resolve a category color (Tailwind name or hex) to a hex string. */
export function categoryHex(color: string | undefined | null): string {
  if (!color) return FALLBACK
  if (color.startsWith('#')) return color
  return NAME_TO_HEX[color] || FALLBACK
}
