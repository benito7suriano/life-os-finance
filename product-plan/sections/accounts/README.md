# Accounts Section

## Overview

The Accounts section provides a centralized view of all financial accounts organized by type. Users can view their total balance, see account cards with balance trends, and manage account details through a side drawer.

## Components

### AccountsView
Main container component that displays the accounts overview including:
- Page header with "Accounts" title and "+ New Account" button
- Total balance summary with account type counts
- Account cards grouped by category (Bank Accounts, Credit Cards, Loans, Wallet/Cash)
- Empty state when no accounts exist

### AccountCard
Individual account card displaying:
- Account type icon
- Account name and institution
- Current balance (formatted as negative for debt accounts)
- Balance change indicator (up/down/no change this month)
- Credit card: last 4 digits badge
- Loan: progress bar showing percentage paid off

### AccountDrawer
Side drawer for viewing and editing account details:
- Account type selector (for new accounts only)
- Type-specific form fields
- Delete confirmation
- Save/Cancel actions

## Usage

```tsx
import { AccountsView, AccountCard, AccountDrawer } from './components'
import sampleData from './sample-data.json'

function AccountsPage() {
  return (
    <AccountsView
      accounts={sampleData.accounts}
      institutions={sampleData.institutions}
      creditCardProviders={sampleData.creditCardProviders}
      onViewAccount={(id) => console.log('View', id)}
      onEditAccount={(id) => console.log('Edit', id)}
      onDeleteAccount={(id) => console.log('Delete', id)}
      onCreateAccount={() => console.log('Create new')}
    />
  )
}
```

## Account Types

1. **Checking** - Daily transaction accounts with optional debit card
2. **Savings** - Accumulation accounts with optional linked goals
3. **Credit Card** - Spending against credit limit with payment dates
4. **Loan** - Debt accounts with payment schedules
5. **Wallet** - Physical cash on hand

## Data Requirements

See `types.ts` for complete TypeScript interfaces and `sample-data.json` for example data structure.
