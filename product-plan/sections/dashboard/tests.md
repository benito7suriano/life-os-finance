# Dashboard Tests

## Overview

These test specifications describe the key user flows and behaviors to verify for the Dashboard section. Adapt these to your testing framework (Jest, Vitest, Playwright, Cypress, etc.).

## Test Categories

### 1. Page Load & Display

**Test: Dashboard renders with all sections**
- Verify page header shows personalized greeting with user's first name
- Verify all 4 KPI cards are visible (Net Worth, Expenses, Income, Budget Projection)
- Verify Spending by Category chart is visible
- Verify Income vs Expenses trend chart is visible
- Verify Quick Actions section is visible
- Verify Recent Transactions section is visible

**Test: Greeting changes based on time of day**
- Before noon: "Good morning, [Name]!"
- Noon to 6pm: "Good afternoon, [Name]!"
- After 6pm: "Good evening, [Name]!"

### 2. KPI Cards

**Test: Net Worth card displays correctly**
- Shows formatted currency amount
- Shows change amount and percentage
- Shows up arrow (green) when trend is "up"
- Shows down arrow (red) when trend is "down"
- Shows stable indicator when trend is "stable"

**Test: Monthly Expenses card displays correctly**
- Shows formatted negative currency amount (with minus sign)
- Shows "This month" subtitle

**Test: Monthly Income card displays correctly**
- Shows formatted positive currency amount (with plus sign)
- Shows "This month" subtitle

**Test: Budget Projection card displays correctly**
- Shows percentage used
- Shows correct status styling:
  - Green background when "on_track"
  - Amber background when "warning"
  - Red background when "over_budget"
- Shows appropriate status message

### 3. Spending by Category Chart

**Test: Chart displays spending data**
- Donut chart segments match category colors
- Total amount is displayed
- Top 3 categories are listed with amounts

**Test: Period filter works**
- Clicking each filter tab (Day/Week/Month/Year/Total) triggers callback
- Active tab is visually highlighted
- Chart updates when period changes

### 4. Income vs Expenses Trend Chart

**Test: Chart displays trend data**
- Bar chart shows income bars (green) and expense bars (red)
- X-axis shows period labels
- Legend shows Income and Expenses

**Test: Period filter works**
- Clicking each filter tab (Day/Week/Month/Year) triggers callback
- Active tab is visually highlighted

### 5. Quick Actions

**Test: All quick actions are displayed**
- Shows 4 action buttons in a grid
- Each button has correct icon and label

**Test: Quick action click triggers callback**
- Clicking "Add Transaction" calls `onQuickAction` with "/transactions/new"
- Clicking "Connect WhatsApp" calls `onQuickAction` with "/automation/whatsapp"
- Clicking "Manage Accounts" calls `onQuickAction` with "/accounts"
- Clicking "View Categories" calls `onQuickAction` with "/categories"

### 6. Recent Transactions

**Test: Transactions list displays correctly**
- Shows up to 5 recent transactions
- Each transaction shows:
  - Type icon (expense/income/transfer)
  - Merchant name or description
  - Category name
  - Date (formatted as "Today", "Yesterday", or "Jan 15")
  - Amount with correct color (red for expense, green for income)
  - Account name

**Test: View All link triggers callback**
- Clicking "View All" calls `onViewAllTransactions`

**Test: Transaction click triggers callback**
- Clicking a transaction row calls `onViewTransaction` with transaction ID

### 7. Header Actions

**Test: New Transaction button**
- Button is visible with "New Transaction" label (desktop) or "New" (mobile)
- Clicking calls `onNewTransaction`

**Test: Notifications bell**
- Shows notification count badge when count > 0
- Badge shows "9+" when count > 9
- Clicking calls `onViewNotifications`

**Test: Language switcher**
- Globe icon button is visible
- Clicking calls `onLanguageChange`

### 8. Empty States

**Test: No transactions**
- When `recentTransactions` is empty, show "No transactions yet" message
- Show CTA to add first transaction

**Test: No spending data**
- When `spendingByCategory.categories` is empty, chart shows empty state

### 9. Responsive Layout

**Test: Mobile layout**
- KPI cards stack (1 column on mobile, 2 on tablet, 4 on desktop)
- Charts stack vertically
- Quick actions grid is 2x2
- "New Transaction" button shows abbreviated text

**Test: Dark mode**
- All components render correctly in dark mode
- Colors adapt appropriately

## Sample Test Code (Jest/React Testing Library)

```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { Dashboard } from './components/Dashboard'
import sampleData from './sample-data.json'

describe('Dashboard', () => {
  const defaultProps = {
    user: sampleData.user,
    summary: sampleData.summary,
    accounts: sampleData.accounts,
    spendingByCategory: sampleData.spendingByCategory,
    monthlyTrend: sampleData.monthlyTrend,
    recentTransactions: sampleData.recentTransactions,
    categories: sampleData.categories,
    notifications: sampleData.notifications,
    quickActions: sampleData.quickActions,
  }

  it('renders greeting with user name', () => {
    render(<Dashboard {...defaultProps} />)
    expect(screen.getByText(/Carlos!/)).toBeInTheDocument()
  })

  it('renders all KPI cards', () => {
    render(<Dashboard {...defaultProps} />)
    expect(screen.getByText('Net Worth')).toBeInTheDocument()
    expect(screen.getByText('Expenses')).toBeInTheDocument()
    expect(screen.getByText('Income')).toBeInTheDocument()
    expect(screen.getByText('Budget Projection')).toBeInTheDocument()
  })

  it('calls onNewTransaction when button clicked', () => {
    const onNewTransaction = jest.fn()
    render(<Dashboard {...defaultProps} onNewTransaction={onNewTransaction} />)
    fireEvent.click(screen.getByRole('button', { name: /new/i }))
    expect(onNewTransaction).toHaveBeenCalled()
  })

  it('shows notification badge with count', () => {
    render(<Dashboard {...defaultProps} />)
    expect(screen.getByText('3')).toBeInTheDocument()
  })
})
```
