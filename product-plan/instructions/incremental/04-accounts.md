# Milestone 4: Accounts

> **Provide alongside:** `product-overview.md`
> **Prerequisites:** Milestone 1 (Foundation) complete

## Goal

Implement the Accounts section - a centralized view of all financial accounts organized by type with management capabilities and savings account goal breakdowns.

## Overview

The Accounts section provides a comprehensive view of all financial accounts. Users can see their total balance, view accounts grouped by type (Bank Accounts, Credit Cards, Loans, Wallet/Cash), and manage accounts through a side drawer. Savings accounts have special support for displaying linked goal allocations.

**Key Functionality:**
- View total balance summary with counts by account type
- Browse accounts in a responsive grid grouped by type
- See balance change indicators on each account card
- Create new accounts with type-specific forms
- Edit existing account details
- Delete accounts with confirmation
- For savings accounts: view goal breakdown showing how funds are allocated

## Recommended Approach: Test-Driven Development

Before implementing this section, **write tests first** based on the test specifications provided.

See `product-plan/sections/accounts/tests.md` for detailed test-writing instructions including:
- Key user flows for each account type
- Type-specific form validation tests
- Savings account goal breakdown tests
- Empty state tests

**TDD Workflow:**
1. Read `tests.md` and write failing tests for the key user flows
2. Implement the feature to make tests pass
3. Refactor while keeping tests green

## What to Implement

### Components

Copy the section components from `product-plan/sections/accounts/components/`:

- `AccountsView.tsx` - Main container with summary and grouped cards
- `AccountCard.tsx` - Individual account card with type-specific display
- `AccountDrawer.tsx` - Side drawer for create/edit forms

### Data Layer

The components expect these data shapes:

```typescript
interface AccountsProps {
  accounts: Account[]           // Union of all account types
  institutions: Institution[]   // For dropdowns
  creditCardProviders: CreditCardProvider[]
  // ... callbacks
}
```

Account types have different fields:
- **Checking:** beneficiaryName, institution, accountNumber, currency, interestRate, hasDebitCard
- **Savings:** beneficiaryName, institution, accountNumber, currency, interestRate, linkedGoals
- **Credit Card:** provider, institution, last4Digits, expiration, cutoffDate, paymentDate, interestRate, creditLimit
- **Loan:** institution, originalAmount, interestRate, paymentAmount, paymentFrequency, dueDay, termMonths, maturityDate
- **Wallet:** icon, currency

### Callbacks

Wire up these user actions:

| Callback | Description |
|----------|-------------|
| `onViewAccount` | Opens account detail drawer |
| `onEditAccount` | Opens account in edit mode |
| `onDeleteAccount` | Deletes account after confirmation |
| `onCreateAccount` | Opens create drawer |
| `onViewGoal` | Navigates to goal detail in Budgets section |

### Savings Account Goal Breakdown

For savings accounts with linked goals, the detail drawer shows:
- List of all goals linked to this account
- Each goal: name, progress bar, current/target amount, target date
- "Personal savings" row for unallocated funds (balance - sum of goal balances)

This allows users to see how their savings are distributed across different goals.

### Empty States

Implement empty state UI for when no records exist yet:

- **No accounts:** Show "No accounts yet" with CTA to add first account
- **No accounts in a type group:** Don't show the group header at all
- **No linked goals (savings):** Show "No goals linked" with option to create one

## Files to Reference

- `product-plan/sections/accounts/README.md` - Feature overview
- `product-plan/sections/accounts/tests.md` - Test-writing instructions
- `product-plan/sections/accounts/components/` - React components
- `product-plan/sections/accounts/types.ts` - TypeScript interfaces
- `product-plan/sections/accounts/sample-data.json` - Test data

## Expected User Flows

### Flow 1: Create a Checking Account

1. User clicks "+ New Account" button
2. User selects "Checking" account type
3. User fills in name, beneficiary, institution, balance
4. User clicks "Save"
5. **Outcome:** New account card appears under "Bank Accounts"

### Flow 2: Create a Credit Card

1. User clicks "+ New Account" button
2. User selects "Credit Card" type
3. User fills in name, provider, institution, last 4 digits, etc.
4. User clicks "Save"
5. **Outcome:** New card appears under "Credit Cards" with correct balance display

### Flow 3: View Savings Account Goals

1. User clicks on a savings account card
2. Drawer opens showing account details
3. User scrolls to "Goals" section
4. User sees each goal with progress bar and amounts
5. User sees "Personal savings" for unallocated funds
6. **Outcome:** User understands how their savings are allocated

### Flow 4: Delete an Account

1. User clicks on an account card to open drawer
2. User clicks "Delete Account"
3. User confirms deletion
4. **Outcome:** Account removed from grid, totals update

## Done When

- [ ] Tests written for key user flows
- [ ] All tests pass
- [ ] Total balance summary displays correctly
- [ ] Accounts grouped by type (Bank Accounts, Credit Cards, Loans, Wallet/Cash)
- [ ] Account cards show balance change indicator
- [ ] Create drawer shows type-specific form fields
- [ ] All account types can be created with their specific fields
- [ ] Edit drawer pre-populates existing data
- [ ] Delete removes account with confirmation
- [ ] Savings accounts show linked goals breakdown
- [ ] "Personal savings" calculated correctly (balance - goal allocations)
- [ ] Empty states display properly
- [ ] Responsive grid (3 cols desktop, 2 tablet, 1 mobile)
- [ ] Dark mode supported
