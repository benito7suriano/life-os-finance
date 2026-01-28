# Transactions Section

## Overview

A searchable, filterable table of all transactions with inline editing capabilities. Users can quickly find transactions, add new ones, and manage existing entries through a clean tabular interface with sorting and pagination.

## User Flows

1. **View Transactions** - Browse paginated table (10 per page)
2. **Search** - Find transactions by description
3. **Filter** - By category, account, source, date range
4. **Sort** - Click column headers to sort
5. **Create** - Add expense, income, or transfer
6. **Edit/Delete** - Via row action menu

## Components

| Component | Description |
|-----------|-------------|
| `TransactionList.tsx` | Main container with header, summary, filters, table, pagination |
| `TransactionFilters.tsx` | Filter bar with search, dropdowns, date picker |
| `TransactionRow.tsx` | Individual transaction row with action menu |

## Props Interface

```typescript
interface TransactionsProps {
  transactions: Transaction[]
  categories: Category[]
  accounts: Account[]
  goalsByAccount: AccountGoals[]
  summary: TransactionSummary
  currentPage: number
  totalPages: number
  sortField?: SortField
  sortDirection?: SortDirection
  filters?: TransactionFilters

  // Callbacks
  onCreate?: () => void
  onEdit?: (id: string) => void
  onDelete?: (id: string) => void
  onPageChange?: (page: number) => void
  onSort?: (field: SortField, direction: SortDirection) => void
  onFilterChange?: (filters: TransactionFilters) => void
  onSearch?: (query: string) => void
}
```

## Key Features

### Transfer with Goal Allocation
When creating a transfer to a savings account with linked goals:
1. Show "Contribute to goals" toggle
2. Allow proportional or manual allocation
3. Display allocation breakdown per goal
4. Create GoalContribution records on save

### Summary Bar
Shows transaction count, total income (green), and total expenses (red) for the current filtered view.

## Integration Notes

- Implement server-side filtering, sorting, and pagination
- Wire up `onCreate` to open transaction creation modal
- Categories display as colored pills using Tailwind color classes
- Amounts are color-coded (green for income, red for expenses)
