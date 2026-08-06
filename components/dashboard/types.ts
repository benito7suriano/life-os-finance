// =============================================================================
// Data Types
// =============================================================================

export interface User {
  id: string
  firstName: string
  lastName: string
  email: string
  preferredLanguage: 'en' | 'es'
  subscriptionTier: 'free' | 'pro'
}

export interface NetWorthSummary {
  amount: number
  previousAmount: number
  change: number
  changePercent: number
  trend: 'up' | 'down' | 'stable'
}

export interface MonthlySummary {
  amount: number
  previousMonth: number
  change: number
  changePercent: number
}

export interface BudgetProjection {
  totalBudget: number
  spent: number
  remaining: number
  percentUsed: number
  daysRemaining: number
  projectedOverspend: number
  status: 'on_track' | 'warning' | 'over_budget'
}

export interface Summary {
  netWorth: NetWorthSummary
  monthlyExpenses: MonthlySummary
  monthlyIncome: MonthlySummary
  budgetProjection: BudgetProjection
}

export interface Account {
  id: string
  name: string
  type: 'checking' | 'savings' | 'credit_card' | 'loan' | 'wallet' | 'investment'
  institution?: string
  /** Native balance, for display alongside `currency`. */
  balance: number
  /** Balance converted to USD — the ONLY field the UI may aggregate. */
  balanceUsd: number
  creditLimit?: number
  currency: string
  icon: string
}

export interface CategorySpending {
  id: string
  name: string
  amount: number
  percent: number
  color: string
  transactionCount: number
}

export interface SpendingByCategory {
  period: 'day' | 'week' | 'month' | 'year' | 'total'
  total: number
  categories: CategorySpending[]
}

export interface MonthlyTrendItem {
  period: string
  label: string
  income: number
  expenses: number
}

export interface Merchant {
  id: string
  name: string
}

export interface CategoryRef {
  id: string
  name: string
  color: string
}

export interface AccountRef {
  id: string
  name: string
}

export interface Transaction {
  id: string
  type: 'expense' | 'income' | 'transfer'
  /** Positive magnitude in the transaction's native currency — display only. */
  amount: number
  /** Native currency (e.g. 'USD', 'DOP'); defaults to USD when absent. */
  currency?: string
  /** Cross-currency transfers: amount credited to the destination, in `toCurrency`. */
  toAmount?: number
  toCurrency?: string
  description: string
  merchant?: Merchant
  category: CategoryRef
  account: AccountRef
  date: string
  time: string
}

export interface Category {
  id: string
  name: string
  color: string
  icon: string
}

export interface Notification {
  id: string
  type: 'budget_warning' | 'transaction_pending' | 'goal_progress' | 'general'
  title: string
  message: string
  date: string
  read: boolean
}

export interface NotificationData {
  count: number
  items: Notification[]
}

export interface QuickAction {
  id: string
  label: string
  icon: string
  href: string
}

// =============================================================================
// Component Props
// =============================================================================

import type { Insight } from '@/lib/insights/types'

export interface DashboardProps {
  /** The logged-in user's profile for personalized greeting */
  user: User
  /** Pre-calculated financial summary (net worth, monthly totals, budget status) */
  summary: Summary
  /** Ranked insights from /api/finance/insights (top one shows in the card). */
  insights?: Insight[]
  /** ISO timestamp of when the insights were generated. */
  insightsGeneratedAt?: string
  /** List of user's financial accounts */
  accounts: Account[]
  /** Spending breakdown by category for pie chart */
  spendingByCategory: SpendingByCategory
  /** Monthly income/expense trend data for bar chart */
  monthlyTrend: MonthlyTrendItem[]
  /** Recent transactions to display */
  recentTransactions: Transaction[]
  /** Available categories with colors */
  categories: Category[]
  /** Notification data (count and items) */
  notifications: NotificationData
  /** Quick action buttons configuration */
  quickActions: QuickAction[]

  // -------------------------------------------------------------------------
  // Callbacks
  // -------------------------------------------------------------------------

  /** Called when user clicks to add a new transaction */
  onNewTransaction?: () => void
  /** Called when user clicks to view all transactions */
  onViewAllTransactions?: () => void
  /** Called when user clicks a transaction to view details */
  onViewTransaction?: (id: string) => void
  /** Called when user clicks a quick action */
  onQuickAction?: (href: string) => void
  /** Called when user clicks notifications bell */
  onViewNotifications?: () => void
  /** Called when user changes spending category filter */
  onSpendingFilterChange?: (period: SpendingByCategory['period']) => void
  /** Called when user changes trend filter */
  onTrendFilterChange?: (period: 'day' | 'week' | 'month' | 'year') => void
  /** Called when user clicks language switcher */
  onLanguageChange?: () => void
}

// =============================================================================
// Filter Types
// =============================================================================

export type SpendingPeriod = 'day' | 'week' | 'month' | 'year' | 'total'
export type TrendPeriod = 'day' | 'week' | 'month' | 'year'
