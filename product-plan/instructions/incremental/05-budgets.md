# Milestone 5: Budgets

> **Provide alongside:** `product-overview.md`
> **Prerequisites:** Milestone 1 (Foundation) complete

## Goal

Implement the Budgets section - track spending against category-based budgets with support for both monthly budgets (reset monthly) and sinking funds (accumulate toward a goal).

## Overview

The Budgets section helps users control spending by setting limits on categories. It supports two budget types: monthly budgets that reset each month, and sinking funds that accumulate over time for larger expenses (linked to a Goal and savings account). Users can visualize spending trends, track progress on each budget, and manage goal contributions.

**Key Functionality:**
- View spending vs budget trend chart with time range filter
- See summary of total budgeted vs total spent for current month
- Browse all budgets in a card grid, sorted by % used
- Create monthly budgets with category and limit
- Create sinking funds with goal amount, target date, and linked savings account
- View budget details with related transactions
- Track sinking fund progress and contributions
- Archive completed or cancelled goals

## Recommended Approach: Test-Driven Development

Before implementing this section, **write tests first** based on the test specifications provided.

See `product-plan/sections/budgets/tests.md` for detailed test-writing instructions including:
- Monthly budget creation and tracking tests
- Sinking fund creation with goal linking tests
- Goal progress and archiving tests
- Empty state tests

**TDD Workflow:**
1. Read `tests.md` and write failing tests for the key user flows
2. Implement the feature to make tests pass
3. Refactor while keeping tests green

## What to Implement

### Components

Copy the section components from `product-plan/sections/budgets/components/`:

- `BudgetsDashboard.tsx` - Main container with chart, summary, and card grid
- `BudgetCard.tsx` - Individual budget card with progress indicator
- `BudgetDrawer.tsx` - Side drawer for budget/goal details
- `CreateBudgetModal.tsx` - Modal for creating budgets (with sinking fund toggle)
- `SpendingChart.tsx` - Line chart comparing spending vs budget over time

### Data Layer

The components expect these data shapes:

```typescript
interface BudgetsProps {
  summary: BudgetSummary         // { totalBudgeted, totalSpent, month }
  categories: Category[]         // 16 fixed categories with subcategories
  budgets: Budget[]             // Monthly and sinking fund budgets
  goals: Goal[]                 // Linked to sinking fund budgets
  goalContributions: GoalContribution[]
  savingsAccounts: SavingsAccountOption[]  // For sinking fund creation
  monthlyHistory: MonthlyHistoryEntry[]    // For trend chart
  transactions: Transaction[]   // For detail drawer
  // ... callbacks
}
```

### Callbacks

Wire up these user actions:

| Callback | Description |
|----------|-------------|
| `onViewBudget` | Opens budget detail drawer |
| `onEditBudget` | Updates budget properties |
| `onDeleteBudget` | Deletes budget (and linked goal if sinking fund) |
| `onCreateBudget` | Creates new monthly budget |
| `onCreateSinkingFund` | Creates budget + linked goal |
| `onViewGoal` | Shows goal detail view |
| `onEditGoal` | Updates goal properties |
| `onArchiveGoal` | Archives completed/cancelled goal |
| `onTimeRangeChange` | Changes chart time range |
| `onFilterChange` | Changes sort/filter settings |

### Sinking Fund Creation Flow

When user toggles "This is a sinking fund" in the create modal:

1. Show additional fields:
   - **Goal amount:** Total target (e.g., $1,500)
   - **Target date:** When to reach goal (date picker)
   - **Savings account:** Which account holds contributions
2. Calculate and display monthly contribution needed:
   ```
   monthlyContribution = goalAmount / monthsUntilTargetDate
   ```
3. On save: Create both a Budget (type: sinking_fund) and a Goal with bidirectional linking

### Budget Detail Drawer

For monthly budgets:
- Budget amount and spent amount
- Progress bar
- Related transactions list

For sinking funds:
- Goal progress (current balance / target amount)
- Monthly contribution needed
- Contribution history (list of GoalContributions)
- Related expenses (spending in this category)
- Archive option when goal is reached or cancelled

### Empty States

Implement empty state UI for when no records exist yet:

- **No budgets:** Show "No budgets yet" with explanation and CTA to create first budget
- **No filtered results:** Show "No budgets match your filters"
- **No transactions for budget:** Show "No transactions in this category yet"

## Files to Reference

- `product-plan/sections/budgets/README.md` - Feature overview
- `product-plan/sections/budgets/tests.md` - Test-writing instructions
- `product-plan/sections/budgets/components/` - React components
- `product-plan/sections/budgets/types.ts` - TypeScript interfaces
- `product-plan/sections/budgets/sample-data.json` - Test data

## Expected User Flows

### Flow 1: Create a Monthly Budget

1. User clicks "Add" button
2. User selects category (e.g., "Food & Dining")
3. User enters monthly limit (e.g., $500)
4. User clicks "Create Budget"
5. **Outcome:** New budget card appears showing $0 / $500 spent

### Flow 2: Create a Sinking Fund

1. User clicks "Add" button
2. User selects category (e.g., "Travel & Vacation")
3. User toggles "This is a sinking fund" ON
4. User enters goal amount ($1,500), target date (6 months from now)
5. User selects savings account from dropdown
6. User sees calculated monthly contribution ($250/month)
7. User clicks "Create Budget"
8. **Outcome:** Budget card appears as sinking fund with progress bar, Goal is created

### Flow 3: View Sinking Fund Progress

1. User clicks on a sinking fund budget card
2. Drawer opens showing goal details
3. User sees progress bar (current balance / target)
4. User sees monthly contribution needed
5. User sees list of contribution history
6. **Outcome:** User understands their progress toward the goal

### Flow 4: Archive a Completed Goal

1. User's sinking fund reaches 100% of target
2. User clicks on the budget card
3. User sees "Goal reached!" message with confetti
4. User clicks "Archive Goal"
5. **Outcome:** Goal is archived, budget remains for spending from the fund

## Done When

- [ ] Tests written for key user flows
- [ ] All tests pass
- [ ] Spending chart displays with time range toggle
- [ ] Summary shows total budgeted vs spent
- [ ] Budget cards display in grid, sorted by % used
- [ ] Monthly budget creation works
- [ ] Sinking fund creation creates both Budget and Goal
- [ ] Monthly contribution calculated correctly
- [ ] Budget detail drawer shows transactions
- [ ] Sinking fund drawer shows goal progress and contributions
- [ ] Archive goal functionality works
- [ ] Sort and filter controls work
- [ ] Empty states display properly
- [ ] Responsive layout
- [ ] Dark mode supported
