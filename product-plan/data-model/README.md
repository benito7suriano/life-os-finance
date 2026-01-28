# Data Model

## Entities

### User
A registered user of the app with authentication credentials, preferences, and subscription status. Users own all their financial data including accounts, transactions, budgets, and goals.

### Account
A financial account that holds a balance. Types include checking, savings, credit card, loan, and wallet (cash). All types share common fields (name, icon, type, currency, balance) with type-specific fields as needed. Savings accounts can serve as "envelopes" for one or more Goals, displaying both the total balance and a breakdown by goal (with any unallocated funds shown as "personal savings").

### Transaction
A financial event that moves money. Uses a single table with a type field (expense, income, transfer). The `from_account` field indicates where money leaves; `to_account` indicates where it enters. For expenses, only `from_account` is set. For income, only `to_account` is set. For transfers, both are set. Transfers to a savings account can optionally allocate portions to Goals via GoalContributions. Expenses can optionally link to a Goal to draw from that sinking fund.

### Category
A label for organizing transactions (e.g., "Groceries", "Travel", "Salary"). Categories are hierarchical - a category can have a parent (e.g., "Food > Restaurants"). Includes system defaults and user-created categories. A category can be linked to both a Budget (monthly limit) and a Goal (sinking fund).

### Merchant
A business or payee where expenses occur (e.g., "Super Selectos", "Netflix", "Uber"). Global merchants are shared across all users; users can also create their own. Each merchant can have a default category for automatic categorization.

### Budget
A spending limit for a category. Can be either a monthly budget (resets on the 1st of each month) or a sinking fund budget (linked to a Goal, accumulates over time). Tracks spending against the limit and warns when approaching or exceeding it.

### Goal
A savings target for a sinking fund. Always linked to both a Budget (via `linkedBudgetId`) and a savings account (via `linkedAccountId`). Defines the target amount, target date, and tracks the current balance through GoalContributions. Multiple goals can share the same savings account. Status can be `active`, `completed`, or `archived`.

### GoalContribution
A record of funds allocated to a goal. Created when a user transfers money to a savings account and enables "Contribute to goals" in the transfer modal. Each contribution has an `amount` that represents the portion of the transfer allocated to a specific goal.

### Institution
A bank or financial institution (e.g., "Banco Agricola", "Banco Cuscatlan"). Linked to accounts for organization and potential future integrations.

### CreditCardProvider
A card network (Visa, Mastercard, American Express). Linked to credit card accounts.

### UserSubscription
A record of the user's app subscription history, tracking tier changes (free/pro) over time for billing and feature access.

## Relationships

- User has many Accounts
- User has many Transactions
- User has many Budgets
- User has many Goals
- User has many Categories (user-created)
- User has many Merchants (user-created)
- User has many UserSubscriptions
- Account belongs to User
- Account belongs to Institution (optional)
- Account belongs to CreditCardProvider (for credit cards)
- Transaction belongs to User
- Transaction has from_account (optional, references Account)
- Transaction has to_account (optional, references Account)
- Transaction belongs to Category (optional)
- Transaction belongs to Merchant (optional, for expenses)
- Transaction belongs to Goal (optional, for expenses from sinking funds)
- Transaction has many GoalContributions (for transfers to savings with goal allocation)
- Category has parent Category (optional, for hierarchy)
- Budget belongs to User
- Budget belongs to Category
- Budget belongs to Goal (optional, via linkedGoalId - only for sinking fund budgets)
- Goal belongs to User
- Goal belongs to Category
- Goal belongs to Budget (required, via linkedBudgetId)
- Goal belongs to Account (required, must be savings type)
- Goal has many GoalContributions
- GoalContribution belongs to Goal
- GoalContribution belongs to Transaction (the transfer that funded it)
- Merchant belongs to Category (default category, optional)
