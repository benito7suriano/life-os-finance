# Accounts Tests

## Overview

These test specifications describe the key user flows and behaviors to verify for the Accounts section. Adapt these to your testing framework.

## Test Categories

### 1. Page Load & Display

**Test: Accounts page renders with all elements**
- Verify page header shows "Accounts" title
- Verify subtitle shows "Manage your financial accounts"
- Verify "+ New Account" button is visible
- Verify total balance summary card is displayed
- Verify account type counts are shown (Bank Accounts, Credit Cards, Loans, Wallets)

**Test: Account categories display correctly**
- Bank Accounts section shows checking and savings accounts
- Credit Cards section shows credit card accounts
- Loans section shows loan accounts
- Wallet/Cash section shows wallet accounts
- Each section has appropriate icon and count indicator

### 2. Account Cards

**Test: Account card displays correct information**
- Account name is visible
- Institution name is shown (where applicable)
- Current balance is formatted correctly
- Balance change indicator shows correct direction (up/down/neutral)
- Balance change amount is formatted correctly

**Test: Checking account card**
- Shows Landmark icon
- Displays institution name
- Shows balance as positive number

**Test: Savings account card**
- Shows PiggyBank icon
- Displays institution name
- Shows interest rate if available

**Test: Credit card account card**
- Shows CreditCard icon
- Displays last 4 digits in top-right corner
- Shows balance as negative (debt)
- Balance displayed in rose/red color

**Test: Loan account card**
- Shows Building2 icon
- Displays institution name
- Shows balance as negative (debt)
- Progress bar shows percentage paid off
- Percentage calculation: (originalAmount - abs(balance)) / originalAmount

**Test: Wallet account card**
- Shows Wallet icon
- Displays "Cash" as subtitle
- No institution shown

### 3. Balance Change Indicators

**Test: Positive balance change**
- Shows TrendingUp icon in emerald/green
- Amount shows with + prefix
- Text color is emerald/green

**Test: Negative balance change**
- Shows TrendingDown icon in rose/red
- Amount shows with - prefix
- Text color is rose/red

**Test: Zero balance change**
- Shows Minus icon in neutral color
- Shows "No change" text

### 4. Total Balance Summary

**Test: Summary card calculations**
- Total balance sums all account balances correctly
- Handles negative balances (credit cards, loans) in calculation
- Account type counts are accurate

**Test: Net worth trend**
- Shows net worth change indicator
- Displays change amount with correct sign

### 5. Account Drawer

**Test: Drawer opens on card click**
- Clicking any account card opens the drawer
- Drawer shows account details
- onViewAccount callback is called with account ID

**Test: Drawer displays account details**
- Account type label is shown
- Type-specific fields are displayed
- Balance and other metrics are formatted correctly

**Test: Create mode**
- Clicking "+ New Account" opens drawer in create mode
- Account type selector is shown
- Form fields update based on selected type

**Test: Edit mode**
- Opening existing account shows pre-filled form
- Account type selector is hidden (type cannot change)
- Save button says "Save Changes"

**Test: Type-specific form fields**

*Checking/Savings:*
- Account Name (required)
- Beneficiary Name (required)
- Balance (required)
- Currency dropdown
- Institution dropdown (optional)
- Account Number (optional)
- Interest Rate (optional)
- Has Debit Card checkbox (checking only)

*Credit Card:*
- Account Name (required)
- Card Provider dropdown (required)
- Institution dropdown (required)
- Last 4 Digits (required, 4 digits)
- Expiration Date (required)
- Current Balance (required)
- Credit Limit (required)
- Cutoff Day (required, 1-31)
- Payment Day (required, 1-31)
- Interest Rate (required)

*Loan:*
- Account Name (required)
- Institution dropdown (optional)
- Original Amount (required)
- Amount Owed (required)
- Interest Rate (required)
- Term in Months (required)
- Payment Amount (required)
- Payment Frequency dropdown
- Due Day (optional, 1-31)
- Origination Date (optional)
- Maturity Date (required)

*Wallet:*
- Account Name (required)
- Balance (required)
- Currency dropdown
- Icon dropdown

### 6. Form Validation

**Test: Required field validation**
- Form cannot submit with empty required fields
- Error indicators show on invalid fields

**Test: Numeric field validation**
- Balance accepts decimal numbers
- Interest rate accepts decimal percentages
- Day fields accept 1-31 only

### 7. Delete Account

**Test: Delete button**
- Delete button visible in edit mode
- Clicking Delete shows confirmation
- Confirming calls onDeleteAccount with ID
- Drawer closes after delete

**Test: Cancel delete**
- Clicking Cancel in confirmation returns to edit view
- Account is not deleted

### 8. Empty State

**Test: No accounts**
- When `accounts` array is empty
- Shows empty state illustration
- Shows "No accounts yet" message
- Shows "Add Your First Account" button
- Clicking button opens create drawer

### 9. Responsive Layout

**Test: Grid responsiveness**
- Desktop: 3 cards per row
- Tablet: 2 cards per row
- Mobile: 1 card per row

**Test: Drawer responsiveness**
- Drawer is full-width on mobile
- Max-width constraint on larger screens

### 10. Dark Mode

**Test: All elements visible in dark mode**
- Card backgrounds use dark variants
- Text colors maintain contrast
- Balance colors (green/red) remain visible
- Icons have appropriate dark mode colors

## Sample Test Code

```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { AccountsView } from './components/AccountsView'
import sampleData from './sample-data.json'

describe('AccountsView', () => {
  const defaultProps = {
    accounts: sampleData.accounts,
    institutions: sampleData.institutions,
    creditCardProviders: sampleData.creditCardProviders,
  }

  it('renders accounts page with summary', () => {
    render(<AccountsView {...defaultProps} />)
    expect(screen.getByText('Accounts')).toBeInTheDocument()
    expect(screen.getByText('New Account')).toBeInTheDocument()
  })

  it('displays account cards grouped by type', () => {
    render(<AccountsView {...defaultProps} />)
    expect(screen.getByText('Bank Accounts')).toBeInTheDocument()
    expect(screen.getByText('Credit Cards')).toBeInTheDocument()
    expect(screen.getByText('Loans')).toBeInTheDocument()
    expect(screen.getByText('Wallet / Cash')).toBeInTheDocument()
  })

  it('opens drawer when card is clicked', () => {
    const onViewAccount = jest.fn()
    render(<AccountsView {...defaultProps} onViewAccount={onViewAccount} />)
    fireEvent.click(screen.getByText('Daily Expenses'))
    expect(onViewAccount).toHaveBeenCalledWith('acc-001')
  })

  it('shows empty state when no accounts', () => {
    render(<AccountsView {...defaultProps} accounts={[]} />)
    expect(screen.getByText('No accounts yet')).toBeInTheDocument()
  })

  it('calculates total balance correctly', () => {
    render(<AccountsView {...defaultProps} />)
    // Sum of all account balances including negative ones
    // Expected: checking + savings - credit cards - loans + wallets
  })
})
```
