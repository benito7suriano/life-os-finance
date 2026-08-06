// Insight types shared by the rules engine (server) and the dashboard card
// (client). Keep this file free of supabase/server imports.

export type InsightKind =
  | 'budget_pacing'
  | 'category_anomaly'
  | 'cc_payment_due'
  | 'low_cash_buffer'
  | 'savings_rate'

/** Three-part headline matching the InsightCard layout: the accent segment is
 * rendered in the accent color. */
export interface InsightHeadline {
  lead: string
  accent: string
  tail: string
}

export interface InsightCta {
  label: string
  href: string
}

export interface Insight {
  /** Stable per subject+month, e.g. "category_anomaly:<catId>:2026-08". */
  id: string
  kind: InsightKind
  /** Rank, descending. The card shows the highest first; Dismiss advances. */
  score: number
  headline: InsightHeadline
  body: string
  cta?: InsightCta
}

/** Everything the pure rules need — assembled by /api/finance/insights.
 * All monetary values are USD aggregates. */
export interface InsightInput {
  today: Date
  /** Null when the user has no budgets. */
  budget: { totalBudget: number; spent: number } | null
  /** Parent-level expense categories with current-month spend + trailing average. */
  categories: { id: string; name: string; spentThisMonthUsd: number; avgMonthlyUsd: number }[]
  /** Credit cards; `paymentDay` is a day-of-month, `balanceUsd` negative = debt. */
  creditCards: { id: string; name: string; paymentDay: number | null; balanceUsd: number }[]
  /** checking + savings + wallet balances. */
  liquidUsd: number
  /** Average of trailing full months' expenses (current partial month excluded). */
  avgMonthlyExpensesUsd: number
  monthlyIncomeUsd: number
  monthlyExpensesUsd: number
}
