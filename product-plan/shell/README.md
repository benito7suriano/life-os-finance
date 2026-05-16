# Application Shell

## Overview

Ledger uses a minimal collapsible sidebar navigation pattern. The shell provides only navigation and user menu - all page-specific actions (notifications, primary actions) live within each section's content area, giving sections full control over their header layout.

## Navigation Structure

- **Dashboard** - Home view with net worth, cash flow, spending breakdown
- **Transactions** - Filterable transaction history
- **Accounts** - Bank accounts, credit cards, wallets
- **Budgets** - Monthly limits and savings goals
- **Automation** - WhatsApp bot and email forwarding setup

## User Menu

Located at the bottom of the sidebar. Contains:
- User avatar (initials-based fallback)
- User name and email
- Dropdown menu with Settings and Logout

## Layout Pattern

**Minimal Sidebar** - The sidebar handles navigation only. No persistent header bar. Each section is responsible for its own page header, actions, and breadcrumbs.

### Sidebar Header
- Logo icon (emerald background)
- Product name: "Ledger"
- Tagline: "Smart Finance"
- Collapse/expand toggle button

### Main Content Area
- No persistent header on desktop
- Mobile: minimal header with hamburger menu and logo
- Content area with padding for section views
- Sections handle their own page headers

## Responsive Behavior

- **Desktop (1024px+):** Full sidebar with labels, can be collapsed to icon-only
- **Tablet (768px-1023px):** Sidebar collapsed by default, icon-only with tooltips
- **Mobile (<768px):** Sidebar hidden off-screen. Minimal header with hamburger menu.

## Design Notes

- Sidebar width: 256px expanded, 64px collapsed
- Transition: 200ms ease for collapse/expand
- Dark mode: Full support with `dark:` variants
- Icons: lucide-react, 20px size in nav items
- Avatar: 32px with emerald background for initials

## Components Provided

- `AppShell.tsx` - Main layout wrapper with sidebar and content area
- `MainNav.tsx` - Navigation menu with icons and active states
- `UserMenu.tsx` - User avatar and dropdown menu
- `index.ts` - Barrel export file

## Callback Props

| Callback | Description |
|----------|-------------|
| `onNavigate` | Called when user clicks a nav item |
| `onLogout` | Called when user clicks logout |
| `onSettings` | Called when user clicks settings |
