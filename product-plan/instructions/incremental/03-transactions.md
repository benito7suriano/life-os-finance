# Milestone 3: Transactions

> **Provide alongside:** `product-overview.md`
> **Prerequisites:** Milestone 1 (Foundation) complete

## Goal

Implement the Transactions section - a searchable, filterable history of all transactions with inline editing capabilities and support for goal contributions on transfers.

## Overview

The Transactions section is the core data entry and review interface. Users can view all their financial transactions in a paginated table, filter by various criteria, search by description, and create/edit/delete entries. A key feature is the transfer modal's "Contribute to goals" functionality for allocating savings to specific goals.

**Key Functionality:**
- View all transactions in a paginated table (10 per page)
- Search transactions by description
- Filter by category, account, source (manual/WhatsApp/email), and date range
- Sort by clicking column headers
- Create new transactions (expense, income, transfer)
- Edit existing transactions
- Delete transactions with confirmation
- For transfers to savings accounts: allocate to goals (proportional or manual)

## Recommended Approach: Test-Driven Development

Before implementing this section, **write tests first** based on the test specifications provided.

See `product-plan/sections/transactions/tests.md` for detailed test-writing instructions including:
- Key user flows to test (success and failure paths)
- Transfer with goal allocation tests
- Filter and pagination tests
- Empty state tests

**TDD Workflow:**
1. Read `tests.md` and write failing tests for the key user flows
2. Implement the feature to make tests pass
3. Refactor while keeping tests green

## What to Implement

### Components

Copy the section components from `product-plan/sections/transactions/components/`:

- `TransactionList.tsx` - Main container with header, filters, and table
- `TransactionFilters.tsx` - Filter bar with search, dropdowns, and date picker
- `TransactionRow.tsx` - Individual transaction row component

### Data Layer

The components expect these data shapes:

```typescript
interface TransactionsProps {
  transactions: Transaction[]
  categories: Category[]
  accounts: Account[]
  goalsByAccount: AccountGoals[]  // For transfer modal goal allocation
  summary: TransactionSummary     // { count, totalIncome, totalExpenses }
  currentPage: number
  totalPages: number
  sortField?: SortField
  sortDirection?: SortDirection
  filters?: TransactionFilters
  // ... callbacks
}
```

You'll need to:
- Create CRUD API endpoints for transactions
- Implement server-side filtering, sorting, and pagination
- Calculate summary stats for current filter
- For transfers: create GoalContribution records when allocating to goals

### Callbacks

Wire up these user actions:

| Callback | Description |
|----------|-------------|
| `onCreate` | Opens create transaction modal |
| `onEdit` | Opens edit modal for specific transaction |
| `onDelete` | Deletes transaction after confirmation |
| `onPageChange` | Fetches next/previous page |
| `onSort` | Changes sort field/direction |
| `onFilterChange` | Applies filter changes |
| `onSearch` | Filters by search query |

### Transfer Modal with Goal Contributions

When creating a transfer to a savings account with linked goals:

1. Show "Contribute to goals" toggle
2. When toggled on, show allocation options:
   - **Proportional:** Auto-calculate based on each goal's monthly contribution weight
   - **Manual:** User specifies exact amount for each goal
3. Display allocation breakdown showing amount per goal
4. Show "Unallocated / Personal savings" for any remainder
5. On save: create Transfer transaction + GoalContribution records

**Proportional Calculation:**
```
For each goal:
  monthlyContribution = (targetAmount - currentBalance) / monthsRemaining
  weight = monthlyContribution / sum(all monthlyContributions)
  allocation = transferAmount * weight
```

### Empty States

Implement empty state UI for when no records exist yet:

- **No transactions:** Show "No transactions yet" with CTA to add first or connect automation
- **No filtered results:** Show "No transactions match your filters" with "Clear filters" link
- **No search results:** Show "No transactions found for '[query]'"

## Files to Reference

- `product-plan/sections/transactions/README.md` - Feature overview
- `product-plan/sections/transactions/tests.md` - Test-writing instructions
- `product-plan/sections/transactions/components/` - React components
- `product-plan/sections/transactions/types.ts` - TypeScript interfaces
- `product-plan/sections/transactions/sample-data.json` - Test data

## Expected User Flows

### Flow 1: Create an Expense

1. User clicks "+ New Transaction" button
2. User selects "Expense" type
3. User fills in date, description, amount, category, account
4. User clicks "Save"
5. **Outcome:** New expense appears in the list, summary updates

### Flow 2: Create a Transfer with Goal Allocation

1. User clicks "+ New Transaction" button
2. User selects "Transfer" type
3. User selects a savings account with linked goals as destination
4. User toggles "Contribute to goals" on
5. User selects "Proportional" or "Manual" allocation
6. User reviews allocation breakdown
7. User clicks "Save"
8. **Outcome:** Transfer created with GoalContribution records

### Flow 3: Filter and Search

1. User types "Netflix" in search bar
2. User sees filtered results matching "Netflix"
3. User adds category filter for "Subscriptions"
4. User sees further filtered results
5. **Outcome:** Only matching transactions displayed, summary reflects filter

### Flow 4: Delete a Transaction

1. User clicks "..." menu on a transaction row
2. User clicks "Delete"
3. User confirms deletion
4. **Outcome:** Transaction removed from list, summary updates

## Done When

- [ ] Tests written for key user flows
- [ ] All tests pass
- [ ] Transaction list renders with pagination
- [ ] Search filters results in real-time
- [ ] All filter options work (category, account, source, date range)
- [ ] Column sorting works
- [ ] Create modal works for expense, income, and transfer types
- [ ] Transfer modal shows goal allocation when applicable
- [ ] Edit modal pre-populates existing data
- [ ] Delete removes transaction with confirmation
- [ ] Summary bar shows correct counts and totals
- [ ] Empty states display properly
- [ ] Responsive on mobile
