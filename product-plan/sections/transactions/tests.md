# Transactions Tests

## Overview

These test specifications describe the key user flows and behaviors to verify for the Transactions section. Adapt these to your testing framework.

## Test Categories

### 1. Page Load & Display

**Test: Transaction list renders with all elements**
- Verify page header shows "Transactions" title
- Verify "+ New Transaction" button is visible
- Verify summary bar shows transaction count, income, and expenses
- Verify filter bar is visible with search and dropdowns
- Verify table headers are visible (Date, Description, Category, Account, Amount)
- Verify pagination controls appear when totalPages > 1

**Test: Transactions display correctly**
- Each row shows formatted date
- Description text is visible
- Category displays as colored pill
- Account name is shown
- Amount is formatted with currency symbol
- Income amounts show green with + prefix
- Expense amounts show red with - prefix
- Source icon appears on hover

### 2. Search & Filtering

**Test: Search filters transactions**
- Typing in search input calls `onSearch` callback
- Search results update in real-time
- Clear button (X) appears when search has value
- Clicking clear resets search and calls `onSearch('')`

**Test: Category filter works**
- Clicking "Category" button opens dropdown
- All categories are listed with colored dots
- Clicking a category toggles selection
- Selected categories show checkmark
- Filter badge shows count of selected
- Multiple categories can be selected
- Closing dropdown preserves selection

**Test: Account filter works**
- Clicking "Account" button opens dropdown
- All accounts are listed
- Selection behavior same as category filter

**Test: Source filter works**
- Options: Manual, WhatsApp, Email
- Selection behavior same as category filter

**Test: Date filter works**
- Clicking "Date" button opens dropdown
- Shows preset options (Last 7 days, 30 days, etc.)
- Selecting preset updates button label
- "Clear date filter" option appears when active

**Test: Clear all filters**
- "Clear all" button appears when any filter is active
- Shows count of active filters
- Clicking clears all filters and search

### 3. Sorting

**Test: Column header sorting**
- Clicking column header calls `onSort` callback
- Sort indicator shows on active column
- First click sorts ascending (up arrow)
- Second click sorts descending (down arrow)
- Third click resets sort

**Test: All sortable columns work**
- Date column is sortable
- Description column is sortable
- Category column is sortable
- Account column is sortable
- Amount column is sortable

### 4. Pagination

**Test: Pagination displays correctly**
- Shows "Page X of Y" text
- Previous/Next buttons visible
- Page numbers visible for small page counts
- Ellipsis shown for large page counts

**Test: Pagination navigation**
- Clicking page number calls `onPageChange` with page
- Clicking Previous calls `onPageChange` with currentPage - 1
- Clicking Next calls `onPageChange` with currentPage + 1
- Previous disabled when on page 1
- Next disabled when on last page

### 5. Row Actions

**Test: Action menu opens**
- Hovering row shows "..." button
- Clicking "..." opens dropdown menu
- Menu shows "Edit" and "Delete" options
- Clicking outside menu closes it

**Test: Edit action**
- Clicking "Edit" calls `onEdit` with transaction ID
- Menu closes after click

**Test: Delete action**
- Clicking "Delete" calls `onDelete` with transaction ID
- Menu closes after click
- (In implementation: show confirmation dialog before delete)

### 6. Create Transaction

**Test: New transaction button**
- Clicking "+ New Transaction" calls `onCreate`
- (In implementation: opens modal with form)

### 7. Transfer with Goal Allocation

**Test: Transfer to savings shows goal option**
- When destination is savings account with goals
- "Contribute to goals" toggle appears
- Toggle is OFF by default

**Test: Goal allocation - proportional mode**
- Toggle on shows allocation options
- "Proportional" is default selected
- Shows calculated allocation per goal
- Amounts based on monthly contribution weight

**Test: Goal allocation - manual mode**
- Selecting "Manual" shows input fields per goal
- User can enter specific amounts
- Shows "Unallocated" for remaining amount
- Validation: total cannot exceed transfer amount

### 8. Empty States

**Test: No transactions**
- When `transactions` array is empty
- Table shows "No transactions found"
- Suggests adjusting filters or adding new

**Test: No filtered results**
- When filters return no results
- Shows "No transactions match your filters"
- Shows "Clear filters" link

### 9. Summary Bar

**Test: Summary displays correctly**
- Transaction count shows formatted number
- Income shows green background and + amount
- Expenses shows red background and - amount
- Values reflect current filtered data

### 10. Responsive Layout

**Test: Mobile layout**
- Table scrolls horizontally on small screens
- Filter dropdowns stack appropriately
- Pagination adapts to screen size

**Test: Dark mode**
- All elements visible in dark mode
- Category pills readable
- Amount colors correct

## Sample Test Code

```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { TransactionList } from './components/TransactionList'
import sampleData from './sample-data.json'

describe('TransactionList', () => {
  const defaultProps = {
    transactions: sampleData.transactions,
    categories: sampleData.categories,
    accounts: sampleData.accounts,
    goalsByAccount: sampleData.goalsByAccount,
    summary: sampleData.summary,
    currentPage: 1,
    totalPages: 2,
  }

  it('renders transaction list with summary', () => {
    render(<TransactionList {...defaultProps} />)
    expect(screen.getByText('Transactions')).toBeInTheDocument()
    expect(screen.getByText('15')).toBeInTheDocument() // count
  })

  it('calls onCreate when button clicked', () => {
    const onCreate = jest.fn()
    render(<TransactionList {...defaultProps} onCreate={onCreate} />)
    fireEvent.click(screen.getByText('New Transaction'))
    expect(onCreate).toHaveBeenCalled()
  })

  it('shows empty state when no transactions', () => {
    render(<TransactionList {...defaultProps} transactions={[]} />)
    expect(screen.getByText('No transactions found')).toBeInTheDocument()
  })

  it('calls onSort when column clicked', () => {
    const onSort = jest.fn()
    render(<TransactionList {...defaultProps} onSort={onSort} />)
    fireEvent.click(screen.getByText('Date'))
    expect(onSort).toHaveBeenCalledWith('date', 'asc')
  })
})
```
