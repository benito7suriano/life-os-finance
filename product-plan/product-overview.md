# Ledger - Product Overview

## Summary

Ledger is an AI-driven personal finance app for El Salvador that eliminates the friction of manual transaction entry. By integrating with WhatsApp and email-tools Salvadorans already use daily-Ledger automatically logs transactions and delivers clear financial insights, empowering users to take control of their money without the hassle.

### Key Problems Solved

1. **Manual entry kills personal finance apps** - WhatsApp bot and email forwarding let users log transactions effortlessly through tools they already use-no app-switching or manual data entry required.

2. **Sophisticated finance apps aren't available in El Salvador** - Built specifically for the Salvadoran market with support for local banks (Banco Agricola, Banco Cuscatlan), USD currency, and local habits like WhatsApp communication.

3. **Lack of meaningful insights makes tracking feel pointless** - A rich dashboard surfaces net worth, monthly cash flow, spending by category, and budget projections-turning raw data into actionable clarity.

### Key Features

- WhatsApp bot for instant transaction logging (text, voice, or images)
- Email forwarding automation for bank notifications and invoices
- Personalized dashboard with net worth, expenses, income, and trends
- Budget tracker with category-based spending limits

## Planned Sections

1. **Dashboard** - The home view showing net worth, monthly cash flow, spending breakdown, and recent transactions at a glance.

2. **Transactions** - A filterable, searchable history of all logged transactions with categorization and details.

3. **Accounts** - Manage bank accounts (checking, savings), credit cards, and cash accounts that hold your balances.

4. **Budgets** - Track spending against category-based budgets for recurring expenses (groceries, subscriptions) and one-time goals (car maintenance, travel).

5. **Automation** - Set up WhatsApp bot and email forwarding to automatically log transactions without manual entry.

## Data Model

**Core Entities:**
- User
- Account (checking, savings, credit_card, loan, wallet)
- Transaction (expense, income, transfer)
- Category (hierarchical with subcategories)
- Merchant
- Budget
- Goal (sinking funds)
- GoalContribution
- Institution
- CreditCardProvider
- UserSubscription

See `data-model/README.md` for full entity descriptions and relationships.

## Design System

**Colors:**
- Primary: `emerald` - Used for buttons, links, key accents
- Secondary: `amber` - Used for tags, highlights, warning states
- Neutral: `slate` - Used for backgrounds, text, borders

**Typography:**
- Heading: Inter
- Body: Inter
- Mono: JetBrains Mono

## Implementation Sequence

Build this product in milestones:

1. **Foundation** - Set up design tokens, data model types, routing, and application shell
2. **Dashboard** - Financial overview with KPIs, charts, and quick actions
3. **Transactions** - Filterable transaction list with CRUD operations
4. **Accounts** - Account management with type-specific forms
5. **Budgets** - Budget tracking with monthly budgets and sinking funds
6. **Automation** - WhatsApp and email channel setup

Each milestone has a dedicated instruction document in `instructions/incremental/`.
