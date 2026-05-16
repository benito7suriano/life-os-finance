# Dashboard Section

## Overview

The Dashboard is the home view providing a financial snapshot at a glance. It displays key metrics, spending visualization, income/expense trends, quick actions, and recent transactions.

## User Flows

1. **View Summary** - See 4 KPI cards at a glance (Net Worth, Expenses, Income, Budget Projection)
2. **Analyze Spending** - Use pie chart with period filters (Day/Week/Month/Year/Total)
3. **Review Trends** - View income vs expense bar chart over time
4. **Quick Actions** - Add transaction, connect WhatsApp, manage accounts, view categories
5. **Recent Transactions** - View latest transactions with "View All" link

## Components

| Component | Description |
|-----------|-------------|
| `Dashboard.tsx` | Main container with header, KPIs, charts, and bottom row |
| `KpiCards.tsx` | Four metric cards showing net worth, expenses, income, budget |
| `SpendingChart.tsx` | Donut chart showing spending by category |
| `TrendChart.tsx` | Bar chart comparing income vs expenses over time |
| `QuickActions.tsx` | Grid of action buttons |
| `RecentTransactions.tsx` | List of latest transactions |

## Props Interface

```typescript
interface DashboardProps {
  user: User
  summary: Summary
  accounts: Account[]
  spendingByCategory: SpendingByCategory
  monthlyTrend: MonthlyTrendItem[]
  recentTransactions: Transaction[]
  categories: Category[]
  notifications: NotificationData
  quickActions: QuickAction[]

  // Callbacks
  onNewTransaction?: () => void
  onViewAllTransactions?: () => void
  onViewTransaction?: (id: string) => void
  onQuickAction?: (href: string) => void
  onViewNotifications?: () => void
  onSpendingFilterChange?: (period: SpendingPeriod) => void
  onTrendFilterChange?: (period: TrendPeriod) => void
  onLanguageChange?: () => void
}
```

## Integration Notes

- Wire up `onNewTransaction` to open transaction creation modal
- Wire up `onViewAllTransactions` to navigate to `/transactions`
- Wire up `onQuickAction` to your router
- Implement spending filter callback to refetch data for selected period
- The greeting changes based on time of day automatically
