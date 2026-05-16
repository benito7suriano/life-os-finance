# Budgets Tests

## Overview

These test specifications describe the key user flows and behaviors to verify for the Budgets section. Adapt these to your testing framework.

## Test Categories

### 1. Page Load & Display

**Test: Budgets page renders with all elements**
- Verify page header shows "Budgets" title
- Verify current month is displayed
- Verify "Add Budget" button is visible
- Verify summary cards are displayed

**Test: Summary cards show correct values**
- Total Budgeted shows formatted amount
- Total Spent shows formatted amount
- Remaining shows formatted amount with correct sign
- Progress bar shows correct percentage

### 2. Spending Chart

**Test: Chart renders correctly**
- Chart displays with legend
- Time range toggle shows 6 months / 12 months options
- Default is 12 months view
- Spent line is solid emerald
- Budgeted line is dashed gray

**Test: Time range toggle works**
- Clicking "6 months" filters chart data to last 6 months
- Clicking "12 months" shows full 12 months
- Active button has highlighted style
- onTimeRangeChange callback is called

**Test: Chart data points**
- All visible months have data points
- X-axis shows month abbreviations
- Y-axis shows formatted amounts

### 3. Filter Controls

**Test: Type filter works**
- Dropdown shows All, Monthly Budgets, Sinking Funds
- Selecting "Monthly Budgets" hides goals
- Selecting "Sinking Funds" hides regular budgets
- "All" shows both

**Test: Sort controls work**
- Sort field dropdown shows: % Used, Name, Amount, Spent
- Default is "% Used" descending
- Sort direction button toggles asc/desc
- Arrow icon rotates based on direction

### 4. Budget Cards Grid

**Test: Cards display correctly**
- Cards show in 3-column grid on desktop
- Cards show in 2-column on tablet
- Cards show in 1-column on mobile
- Each card has progress ring

**Test: Monthly budget card**
- Shows budget name
- Shows spent / budgeted amounts
- Shows percentage remaining
- No "Fund" label

**Test: Sinking fund card**
- Shows goal name
- Shows saved / target amounts
- Shows "Fund" label in amber
- Shows progress to goal

**Test: Category budget card**
- Shows "Category" label
- Has slightly different background

**Test: Over-budget state**
- Progress ring fills completely
- Percentage shows > 100%
- Amber color for over-budget
- Shows "X% over" text

**Test: Goal reached state**
- Progress ring shows 100%+
- Emerald/green color
- Shows "Goal reached!" text

### 5. Budget Drawer

**Test: Drawer opens on card click**
- Clicking budget card opens drawer
- Drawer slides in from right
- Backdrop appears
- onViewBudget callback called

**Test: Monthly budget drawer content**
- Shows "Budgeted" stat
- Shows "Spent" stat
- Progress bar visible
- Recent transactions listed

**Test: Sinking fund drawer content**
- Shows "Sinking Fund" label
- Shows "Target" stat
- Shows "Saved" stat
- Shows monthly contribution info
- Shows linked account name

**Test: Edit functionality**
- Clicking "Edit Budget/Goal" enables editing
- Amount field becomes editable
- Save and Cancel buttons appear
- onSave callback receives updated values

**Test: Delete functionality**
- Delete button visible
- Clicking shows confirmation
- Confirming calls onDelete
- Canceling returns to view mode

### 6. Create Budget Modal

**Test: Modal opens**
- Clicking "Add Budget" opens modal
- Modal centered with backdrop
- Close button in header

**Test: Budget type toggle**
- Two options: Monthly Budget, Sinking Fund
- Default is Monthly Budget
- Switching updates form fields

**Test: Monthly budget form**
- Category dropdown required
- Subcategory dropdown optional
- Monthly amount input required
- Submit creates budget

**Test: Sinking fund form**
- Category dropdown required
- Goal Name input required
- Target Amount required
- Monthly Contribution required
- Submit creates goal

**Test: Form validation**
- Cannot submit empty required fields
- Amount must be positive number
- Error states shown appropriately

### 7. Empty State

**Test: No budgets state**
- When budgets and goals arrays are empty
- Shows empty state illustration
- Shows "No budgets yet" message
- Shows "Add your first budget" link

### 8. Transactions List

**Test: Transactions filtered correctly**
- For category budget: shows transactions in that category
- For subcategory budget: shows only subcategory transactions
- For goal: shows contributions and related expenses

**Test: Transaction display**
- Date formatted correctly
- Description visible
- Account name shown
- Amount formatted with +/- for contributions

**Test: No transactions state**
- Shows "No transactions yet this month"
- When filtered transactions is empty

### 9. Sorting Behavior

**Test: Default sort**
- Cards sorted by % used descending
- Highest usage first

**Test: Name sort**
- Alphabetical by name
- A-Z for ascending, Z-A for descending

**Test: Amount sort**
- By budgeted/target amount
- Combines budgets and goals

**Test: Spent sort**
- By spent/saved amount
- Combines budgets and goals

### 10. Responsive Layout

**Test: Mobile layout**
- Cards stack in single column
- Summary cards stack
- Filter controls wrap appropriately

**Test: Dark mode**
- All elements visible
- Chart colors maintain contrast
- Card backgrounds use dark variants

## Sample Test Code

```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { BudgetsDashboard } from './components/BudgetsDashboard'
import sampleData from './sample-data.json'

describe('BudgetsDashboard', () => {
  const defaultProps = {
    summary: sampleData.summary,
    categories: sampleData.categories,
    budgets: sampleData.budgets,
    goals: sampleData.goals,
    monthlyHistory: sampleData.monthlyHistory,
    transactions: sampleData.transactions,
  }

  it('renders budgets page with summary', () => {
    render(<BudgetsDashboard {...defaultProps} />)
    expect(screen.getByText('Budgets')).toBeInTheDocument()
    expect(screen.getByText('January 2025')).toBeInTheDocument()
  })

  it('displays summary cards correctly', () => {
    render(<BudgetsDashboard {...defaultProps} />)
    expect(screen.getByText('Total Budgeted')).toBeInTheDocument()
    expect(screen.getByText('Total Spent')).toBeInTheDocument()
    expect(screen.getByText('Remaining')).toBeInTheDocument()
  })

  it('opens drawer when card is clicked', () => {
    const onViewBudget = jest.fn()
    render(<BudgetsDashboard {...defaultProps} onViewBudget={onViewBudget} />)
    fireEvent.click(screen.getByText('Food & Dining'))
    expect(onViewBudget).toHaveBeenCalledWith('budget-001')
  })

  it('filters by budget type', () => {
    render(<BudgetsDashboard {...defaultProps} />)
    const typeFilter = screen.getByDisplayValue('All')
    fireEvent.change(typeFilter, { target: { value: 'sinking_fund' } })
    // Should only show goals, not monthly budgets
  })

  it('toggles time range on chart', () => {
    const onTimeRangeChange = jest.fn()
    render(<BudgetsDashboard {...defaultProps} onTimeRangeChange={onTimeRangeChange} />)
    fireEvent.click(screen.getByText('6 months'))
    expect(onTimeRangeChange).toHaveBeenCalledWith('6months')
  })

  it('shows empty state when no budgets', () => {
    render(<BudgetsDashboard {...defaultProps} budgets={[]} goals={[]} />)
    expect(screen.getByText('No budgets yet')).toBeInTheDocument()
  })
})
```
