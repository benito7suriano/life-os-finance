# Ledger - Complete Implementation Instructions

---

## About These Instructions

**What you're receiving:**
- Finished UI designs (React components with full styling)
- Data model definitions (TypeScript types and sample data)
- UI/UX specifications (user flows, requirements, screenshots)
- Design system tokens (colors, typography, spacing)
- Test-writing instructions for each section (for TDD approach)

**What you need to build:**
- Backend API endpoints and database schema
- Authentication and authorization
- Data fetching and state management
- Business logic and validation
- Integration of the provided UI components with real data

**Important guidelines:**
- **DO NOT** redesign or restyle the provided components - use them as-is
- **DO** wire up the callback props to your routing and API calls
- **DO** replace sample data with real data from your backend
- **DO** implement proper error handling and loading states
- **DO** implement empty states when no records exist (first-time users, after deletions)
- **DO** use test-driven development - write tests first using `tests.md` instructions
- The components are props-based and ready to integrate - focus on the backend and data layer

---

## Test-Driven Development

Each section includes a `tests.md` file with detailed test-writing instructions. These are **framework-agnostic** - adapt them to your testing setup (Jest, Vitest, Playwright, Cypress, RSpec, Minitest, PHPUnit, etc.).

**For each section:**
1. Read `product-plan/sections/[section-id]/tests.md`
2. Write failing tests for key user flows (success and failure paths)
3. Implement the feature to make tests pass
4. Refactor while keeping tests green

The test instructions include:
- Specific UI elements, button labels, and interactions to verify
- Expected success and failure behaviors
- Empty state handling (when no records exist yet)
- Data assertions and state validations

---

## Product Overview

Ledger is an AI-driven personal finance app for El Salvador that eliminates the friction of manual transaction entry. By integrating with WhatsApp and email, Ledger automatically logs transactions and delivers clear financial insights.

### Key Features
- WhatsApp bot for instant transaction logging (text, voice, or images)
- Email forwarding automation for bank notifications and invoices
- Personalized dashboard with net worth, expenses, income, and trends
- Budget tracker with category-based spending limits and sinking funds

### Sections
1. **Dashboard** - Financial overview with KPIs and charts
2. **Transactions** - Filterable transaction history with CRUD
3. **Accounts** - Account management with type-specific forms
4. **Budgets** - Monthly budgets and sinking funds
5. **Automation** - WhatsApp and email channel setup

### Design System
- **Primary:** emerald (buttons, links, active states)
- **Secondary:** amber (warnings, highlights)
- **Neutral:** slate (backgrounds, text, borders)
- **Fonts:** Inter (headings/body), JetBrains Mono (amounts)

---

# Milestone 1: Foundation

## Goal

Set up the foundational elements: design tokens, data model types, routing structure, and application shell.

## What to Implement

### 1. Design Tokens

- See `product-plan/design-system/tokens.css` for CSS custom properties
- See `product-plan/design-system/tailwind-colors.md` for Tailwind configuration
- See `product-plan/design-system/fonts.md` for Google Fonts setup

### 2. Data Model Types

- See `product-plan/data-model/types.ts` for interface definitions
- See `product-plan/data-model/README.md` for entity relationships

Core entities: User, Account, Transaction, Category, Merchant, Budget, Goal, GoalContribution, Institution, CreditCardProvider

### 3. Routing Structure

| Route | Section |
|-------|---------|
| `/` or `/dashboard` | Dashboard |
| `/transactions` | Transactions |
| `/accounts` | Accounts |
| `/budgets` | Budgets |
| `/automation` | Automation |

### 4. Application Shell

Copy shell components from `product-plan/shell/components/`:
- `AppShell.tsx` - Main layout with sidebar
- `MainNav.tsx` - Navigation menu
- `UserMenu.tsx` - User avatar and dropdown

Configure navigation items for all sections. Wire up `onNavigate` and `onLogout` callbacks.

## Done When

- [ ] Design tokens configured
- [ ] Data model types defined
- [ ] Database schema created
- [ ] Routes exist for all sections
- [ ] Shell renders with navigation
- [ ] User menu works

---

# Milestone 2: Dashboard

## Goal

Implement the Dashboard - the home view with KPIs, spending chart, trend chart, quick actions, and recent transactions.

## Components

From `product-plan/sections/dashboard/components/`:
- `Dashboard.tsx` - Main container
- `KpiCards.tsx` - Four metric cards
- `SpendingChart.tsx` - Donut chart by category
- `TrendChart.tsx` - Income vs expense bars
- `QuickActions.tsx` - Action buttons
- `RecentTransactions.tsx` - Transaction list

## Key Data

```typescript
interface DashboardProps {
  user: User
  summary: Summary
  spendingByCategory: SpendingByCategory
  monthlyTrend: MonthlyTrendItem[]
  recentTransactions: Transaction[]
  // callbacks...
}
```

## User Flows

1. **View Summary** - See 4 KPI cards at a glance
2. **Analyze Spending** - Use pie chart period filters
3. **Review Trends** - View income vs expense over time
4. **Quick Actions** - Add transaction, manage accounts, etc.

See `product-plan/sections/dashboard/tests.md` for test-writing instructions.

---

# Milestone 3: Transactions

## Goal

Implement Transactions - searchable, filterable history with create/edit/delete and goal allocation for transfers.

## Components

From `product-plan/sections/transactions/components/`:
- `TransactionList.tsx` - Main container with table
- `TransactionFilters.tsx` - Filter bar
- `TransactionRow.tsx` - Individual row

## Key Features

- Paginated table (10 per page)
- Search, filter, sort
- Create expense, income, transfer
- **Transfer to savings with goals:** "Contribute to goals" toggle with proportional/manual allocation

## User Flows

1. **Create Expense** - Fill form, save
2. **Create Transfer with Goals** - Toggle on, allocate proportionally or manually
3. **Filter/Search** - Find specific transactions
4. **Delete** - Remove with confirmation

See `product-plan/sections/transactions/tests.md` for test-writing instructions.

---

# Milestone 4: Accounts

## Goal

Implement Accounts - centralized view with type-specific forms and savings goal breakdown.

## Components

From `product-plan/sections/accounts/components/`:
- `AccountsView.tsx` - Main container
- `AccountCard.tsx` - Account card
- `AccountDrawer.tsx` - Create/edit drawer

## Account Types

- **Checking:** name, institution, balance, hasDebitCard
- **Savings:** name, institution, balance, linkedGoals
- **Credit Card:** provider, last4, expiration, creditLimit
- **Loan:** originalAmount, interestRate, paymentAmount
- **Wallet:** icon, balance

## Savings Goal Breakdown

For savings accounts, show linked goals with progress bars and "Personal savings" for unallocated funds.

See `product-plan/sections/accounts/tests.md` for test-writing instructions.

---

# Milestone 5: Budgets

## Goal

Implement Budgets - monthly limits and sinking funds with goal tracking.

## Components

From `product-plan/sections/budgets/components/`:
- `BudgetsDashboard.tsx` - Main container
- `BudgetCard.tsx` - Budget card
- `BudgetDrawer.tsx` - Detail drawer
- `CreateBudgetModal.tsx` - Create form
- `SpendingChart.tsx` - Trend chart

## Budget Types

- **Monthly:** Resets on 1st of month, tracks spending vs limit
- **Sinking Fund:** Accumulates toward goal, linked to savings account

## Sinking Fund Creation

1. Toggle "This is a sinking fund"
2. Enter goal amount and target date
3. Select savings account
4. System calculates monthly contribution
5. Creates both Budget and Goal

See `product-plan/sections/budgets/tests.md` for test-writing instructions.

---

# Milestone 6: Automation

## Goal

Implement Automation - WhatsApp and email channel setup for automatic transaction logging.

## Components

From `product-plan/sections/automation/components/`:
- `AutomationSettings.tsx` - Main container
- `ChannelCard.tsx` - Connected channel display
- `SetupCard.tsx` - Setup flow

## Channel States

- **Connected:** Green badge, toggle ON, stats shown
- **Paused:** Amber badge, toggle OFF, warning message
- **Disconnected:** Setup flow shown

## Setup Flows

**WhatsApp:**
1. Show bot phone number
2. User adds bot and sends message
3. User enters verification code

**Email:**
1. Show unique forwarding address
2. User copies and sets up forwarding

## Backend Requirements

- WhatsApp Business API integration
- Email webhook for forwarding
- AI receipt parsing service
- Transaction creation from parsed data

See `product-plan/sections/automation/tests.md` for test-writing instructions.

---

## Files Reference

| Path | Description |
|------|-------------|
| `product-plan/product-overview.md` | Product summary |
| `product-plan/design-system/` | Design tokens |
| `product-plan/data-model/` | Entity types |
| `product-plan/shell/` | Shell components |
| `product-plan/sections/[section]/README.md` | Section overview |
| `product-plan/sections/[section]/tests.md` | Test instructions |
| `product-plan/sections/[section]/components/` | React components |
| `product-plan/sections/[section]/types.ts` | TypeScript types |
| `product-plan/sections/[section]/sample-data.json` | Test data |
