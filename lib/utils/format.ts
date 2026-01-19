// Parse date string (YYYY-MM-DD) as local date without timezone conversion
export function parseDateString(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number)
  return new Date(year, month - 1, day)
}

// Date formatting for Latin American conventions
export function formatDate(date: Date | string, locale: "es" | "en" = "es"): string {
  const d = typeof date === "string" ? parseDateString(date) : date

  return d.toLocaleDateString(locale === "es" ? "es-SV" : "en-US", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

export function formatDateLong(date: Date | string, locale: "es" | "en" = "es"): string {
  const d = typeof date === "string" ? parseDateString(date) : date

  return d.toLocaleDateString(locale === "es" ? "es-SV" : "en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

// Currency formatting
export function formatCurrency(amount: number, currency = "USD", locale: "es" | "en" = "es"): string {
  return new Intl.NumberFormat(locale === "es" ? "es-SV" : "en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

// Compact currency for large numbers
export function formatCurrencyCompact(amount: number, currency = "USD", locale: "es" | "en" = "es"): string {
  if (Math.abs(amount) >= 1000000) {
    return new Intl.NumberFormat(locale === "es" ? "es-SV" : "en-US", {
      style: "currency",
      currency,
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(amount)
  }
  return formatCurrency(amount, currency, locale)
}

// Percentage formatting
export function formatPercentage(value: number, decimals = 0): string {
  return `${(value * 100).toFixed(decimals)}%`
}

// Relative time formatting
export function formatRelativeTime(date: Date | string, locale: "es" | "en" = "es"): string {
  const d = typeof date === "string" ? parseDateString(date) : date
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - d.getTime()) / 1000)

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" })

  if (diffInSeconds < 60) {
    return rtf.format(-diffInSeconds, "second")
  }
  if (diffInSeconds < 3600) {
    return rtf.format(-Math.floor(diffInSeconds / 60), "minute")
  }
  if (diffInSeconds < 86400) {
    return rtf.format(-Math.floor(diffInSeconds / 3600), "hour")
  }
  if (diffInSeconds < 604800) {
    return rtf.format(-Math.floor(diffInSeconds / 86400), "day")
  }

  return formatDate(d, locale)
}
