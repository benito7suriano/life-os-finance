# Budgets Section

## Overview

The Budgets section allows users to track spending against category-based budgets. It distinguishes between two budget types:
- **Monthly Budgets** - Reset on the 1st of each month
- **Sinking Funds** - Accumulate over time for larger expenses, linked to Goals

## Components

### BudgetsDashboard
Main container component displaying:
- Page header with "Budgets" title and "Add Budget" button
- Summary cards (Total Budgeted, Total Spent, Remaining)
- Spending chart comparing budgeted vs actual over time
- Filter controls (type, sort field, sort direction)
- Budget cards grid

### BudgetCard
Individual budget/goal card showing:
- Circular progress indicator
- Budget/goal name
- Amount spent/saved vs budgeted/target
- Visual labels for "Fund" (sinking funds) and "Category" (parent budgets)

### SpendingChart
SVG line chart displaying:
- Spent line (solid emerald)
- Budgeted line (dashed gray)
- Area fill under spent line
- Time range toggle (6 months / 12 months)

### BudgetDrawer
Side drawer for viewing budget details:
- Budget/goal stats (budgeted/target, spent/saved)
- Sinking fund details (monthly contribution, linked account)
- Progress bar
- Recent transactions list
- Edit and delete actions

### CreateBudgetModal
Modal for creating new budgets:
- Budget type toggle (Monthly / Sinking Fund)
- Category and subcategory selection
- Amount inputs (monthly limit or target + contribution)

## Usage

```tsx
import { BudgetsDashboard } from './components'
import sampleData from './sample-data.json'

function BudgetsPage() {
  return (
    <BudgetsDashboard
      summary={sampleData.summary}
      categories={sampleData.categories}
      budgets={sampleData.budgets}
      goals={sampleData.goals}
      monthlyHistory={sampleData.monthlyHistory}
      transactions={sampleData.transactions}
      onViewBudget={(id) => console.log('View budget', id)}
      onEditBudget={(id, updates) => console.log('Edit', id, updates)}
      onDeleteBudget={(id) => console.log('Delete', id)}
      onCreateBudget={(data) => console.log('Create budget', data)}
    />
  )
}
```

## Categories

The system uses 16 fixed main categories with subcategories:
1. Auto & Transportation
2. Bills & Utilities
3. Business
4. Children
5. Education
6. Financial
7. Food & Dining
8. Gifts & Donations
9. Health & Wellness
10. Housing
11. Income
12. Other
13. Recurring & Subscriptions
14. Savings & Investments
15. Shopping
16. Travel & Lifestyle

Users cannot modify main categories but can add custom subcategories.

## Data Requirements

See `types.ts` for complete TypeScript interfaces and `sample-data.json` for example data structure.
