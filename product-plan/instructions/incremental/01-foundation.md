# Milestone 1: Foundation

> **Provide alongside:** `product-overview.md`
> **Prerequisites:** None

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

## Goal

Set up the foundational elements: design tokens, data model types, routing structure, and application shell.

## What to Implement

### 1. Design Tokens

Configure your styling system with these tokens:

- See `product-plan/design-system/tokens.css` for CSS custom properties
- See `product-plan/design-system/tailwind-colors.md` for Tailwind configuration
- See `product-plan/design-system/fonts.md` for Google Fonts setup

**Colors:**
- Primary: `emerald` - buttons, links, active states, positive amounts
- Secondary: `amber` - warnings, highlights, sinking fund indicators
- Neutral: `slate` - backgrounds, text, borders

**Typography:**
- Heading/Body: Inter
- Mono: JetBrains Mono (for currency amounts, account numbers)

### 2. Data Model Types

Create TypeScript interfaces for your core entities:

- See `product-plan/data-model/types.ts` for interface definitions
- See `product-plan/data-model/README.md` for entity relationships

**Core Entities:**
- User
- Account (checking, savings, credit_card, loan, wallet)
- Transaction (expense, income, transfer)
- Category (hierarchical with parent/child)
- Merchant
- Budget (monthly and sinking_fund types)
- Goal (linked to budgets and savings accounts)
- GoalContribution
- Institution
- CreditCardProvider

### 3. Routing Structure

Create routes for each section:

| Route | Section |
|-------|---------|
| `/` or `/dashboard` | Dashboard |
| `/transactions` | Transactions |
| `/accounts` | Accounts |
| `/budgets` | Budgets |
| `/automation` | Automation |
| `/settings` | Settings (optional) |

### 4. Application Shell

Copy the shell components from `product-plan/shell/components/` to your project:

- `AppShell.tsx` - Main layout wrapper with sidebar and content area
- `MainNav.tsx` - Navigation menu with icons and active states
- `UserMenu.tsx` - User avatar and dropdown menu
- `index.ts` - Barrel export file

**Wire Up Navigation:**

The shell expects these props:

```tsx
interface AppShellProps {
  children: React.ReactNode
  navigationItems: NavigationItem[]
  user?: User
  onNavigate?: (href: string) => void
  onLogout?: () => void
}

interface NavigationItem {
  label: string
  href: string
  icon?: 'dashboard' | 'transactions' | 'accounts' | 'budgets' | 'automation'
  isActive?: boolean
}
```

Configure navigation items:

```tsx
const navigationItems = [
  { label: 'Dashboard', href: '/dashboard', icon: 'dashboard', isActive: true },
  { label: 'Transactions', href: '/transactions', icon: 'transactions' },
  { label: 'Accounts', href: '/accounts', icon: 'accounts' },
  { label: 'Budgets', href: '/budgets', icon: 'budgets' },
  { label: 'Automation', href: '/automation', icon: 'automation' },
]
```

**User Menu:**

The user menu expects:
- User name
- User email
- Avatar URL (optional - falls back to initials)
- Logout callback
- Navigate callback (for settings link)

### 5. Database Schema

Design your database schema based on the data model. Key considerations:

- **Users table** with authentication fields
- **Accounts table** with polymorphic type field and type-specific columns
- **Transactions table** with from_account_id and to_account_id for transfers
- **Categories table** with parent_id for hierarchy
- **Budgets table** with type (monthly/sinking_fund) and optional linked_goal_id
- **Goals table** linked to both budgets and savings accounts
- **Goal_contributions table** for tracking allocations

## Files to Reference

- `product-plan/design-system/` - Design tokens
- `product-plan/data-model/` - Type definitions and relationships
- `product-plan/shell/README.md` - Shell design intent
- `product-plan/shell/components/` - Shell React components

## Done When

- [ ] Design tokens are configured (colors, fonts)
- [ ] Google Fonts (Inter, JetBrains Mono) are loading
- [ ] Data model types are defined
- [ ] Database schema is created
- [ ] Routes exist for all sections (can be placeholder pages)
- [ ] Shell renders with sidebar navigation
- [ ] Navigation links update active state and route correctly
- [ ] User menu shows user info and has working logout
- [ ] Sidebar collapses on desktop, drawer on mobile
- [ ] Dark mode toggle works (if implementing)
- [ ] Responsive on mobile devices
