# Milestone 2: Dashboard

> **Provide alongside:** `product-overview.md`
> **Prerequisites:** Milestone 1 (Foundation) complete

## Goal

Implement the Dashboard section - the home view providing a financial snapshot at a glance with KPIs, charts, quick actions, and recent transactions.

## Overview

The Dashboard is the first screen users see after login. It provides an at-a-glance view of their financial health through key metrics (net worth, monthly expenses/income, budget status), visualizations (spending by category pie chart, income vs expense trend chart), quick action buttons, and a list of recent transactions.

**Key Functionality:**
- Display personalized greeting based on time of day
- Show 4 KPI cards: Net Worth, Monthly Expenses, Monthly Income, Budget Projection
- Render spending by category donut chart with period filter (Day/Week/Month/Year/Total)
- Render monthly trend bar chart comparing income vs expenses
- Provide quick action buttons for common tasks
- List 5 most recent transactions with navigation to full list

## Recommended Approach: Test-Driven Development

Before implementing this section, **write tests first** based on the test specifications provided.

See `product-plan/sections/dashboard/tests.md` for detailed test-writing instructions including:
- Key user flows to test (success and failure paths)
- Specific UI elements, button labels, and interactions to verify
- Expected behaviors and assertions

The test instructions are framework-agnostic - adapt them to your testing setup.

**TDD Workflow:**
1. Read `tests.md` and write failing tests for the key user flows
2. Implement the feature to make tests pass
3. Refactor while keeping tests green

## What to Implement

### Components

Copy the section components from `product-plan/sections/dashboard/components/`:

- `Dashboard.tsx` - Main dashboard container with greeting and layout
- `KpiCards.tsx` - Four metric cards in a responsive grid
- `SpendingChart.tsx` - Donut chart with category breakdown
- `TrendChart.tsx` - Bar chart for income vs expense trends
- `QuickActions.tsx` - Action button grid
- `RecentTransactions.tsx` - Transaction list with "View All" link

### Data Layer

The Dashboard component expects these data shapes:

```typescript
interface DashboardProps {
  user: User
  summary: Summary // { netWorth, monthlyExpenses, monthlyIncome, budgetProjection }
  accounts: Account[]
  spendingByCategory: SpendingByCategory
  monthlyTrend: MonthlyTrendItem[]
  recentTransactions: Transaction[]
  categories: Category[]
  notifications: NotificationData
  quickActions: QuickAction[]
  // ... callbacks
}
```

You'll need to:
- Create API endpoints to fetch summary data
- Calculate net worth from account balances
- Aggregate expenses/income for the current month
- Calculate budget projection based on spending rate
- Group transactions by category for the pie chart
- Aggregate monthly income/expenses for the trend chart

### Callbacks

Wire up these user actions:

| Callback | Description |
|----------|-------------|
| `onNewTransaction` | Opens new transaction modal |
| `onViewAllTransactions` | Navigates to /transactions |
| `onViewTransaction` | Navigates to transaction detail |
| `onQuickAction` | Handles quick action button clicks |
| `onViewNotifications` | Opens notifications panel |
| `onSpendingFilterChange` | Changes pie chart period filter |
| `onTrendFilterChange` | Changes trend chart period filter |
| `onLanguageChange` | Toggles language (en/es) |

### Empty States

Implement empty state UI for when no records exist yet:

- **No accounts:** Show message encouraging user to add their first account
- **No transactions:** Show message with CTA to add first transaction or connect automation
- **No budget:** KPI card shows "Set up budgets" prompt instead of projection

## Files to Reference

- `product-plan/sections/dashboard/README.md` - Feature overview and design intent
- `product-plan/sections/dashboard/tests.md` - Test-writing instructions (use for TDD)
- `product-plan/sections/dashboard/components/` - React components
- `product-plan/sections/dashboard/types.ts` - TypeScript interfaces
- `product-plan/sections/dashboard/sample-data.json` - Test data

## Expected User Flows

### Flow 1: View Financial Summary

1. User logs in or navigates to Dashboard
2. User sees personalized greeting ("Good morning, Carlos!")
3. User sees 4 KPI cards with current financial metrics
4. **Outcome:** User understands their overall financial position at a glance

### Flow 2: Analyze Spending by Category

1. User views the "Spending by Category" card
2. User sees donut chart with top categories
3. User clicks period filter tabs (Day/Week/Month/Year/Total)
4. **Outcome:** Chart updates to show spending for selected period

### Flow 3: Review Monthly Trends

1. User views the "Monthly Trend" card
2. User sees grouped bar chart with income (green) and expenses (red)
3. User hovers over bars to see exact amounts
4. **Outcome:** User understands income vs expense patterns over time

### Flow 4: Quick Actions

1. User clicks "Add Transaction" quick action
2. **Outcome:** New transaction modal opens
3. User clicks "View Categories"
4. **Outcome:** User is navigated to categories page

## Done When

- [ ] Tests written for key user flows
- [ ] All tests pass
- [ ] Dashboard renders with greeting based on time of day
- [ ] KPI cards show correct calculated values
- [ ] Spending chart displays with period filters working
- [ ] Trend chart displays income vs expenses
- [ ] Quick action buttons navigate correctly
- [ ] Recent transactions list shows latest 5 with "View All" link
- [ ] Empty states display properly when no data exists
- [ ] Notifications badge shows unread count
- [ ] Responsive on mobile (single column layout)
- [ ] Dark mode supported
