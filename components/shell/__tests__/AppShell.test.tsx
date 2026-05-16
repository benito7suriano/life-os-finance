import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppShell } from '@/components/shell/AppShell'

describe('AppShell', () => {
  const defaultNavItems = [
    { label: 'Dashboard', href: '/dashboard', icon: 'dashboard' as const, isActive: true },
    { label: 'Transactions', href: '/transactions', icon: 'transactions' as const },
    { label: 'Accounts', href: '/accounts', icon: 'accounts' as const },
    { label: 'Budgets', href: '/budgets', icon: 'budgets' as const },
    { label: 'Automation', href: '/automation', icon: 'automation' as const },
  ]

  const defaultUser = {
    name: 'John Doe',
    email: 'john@example.com',
  }

  it('renders the Ledger brand name', () => {
    render(
      <AppShell navigationItems={defaultNavItems} user={defaultUser}>
        <div>Content</div>
      </AppShell>
    )
    const brandElements = screen.getAllByText('Ledger')
    expect(brandElements.length).toBeGreaterThanOrEqual(1)
  })

  it('renders children in the main content area', () => {
    render(
      <AppShell navigationItems={defaultNavItems} user={defaultUser}>
        <div data-testid="page-content">Dashboard content</div>
      </AppShell>
    )
    expect(screen.getByTestId('page-content')).toBeInTheDocument()
  })

  it('renders all navigation items', () => {
    render(
      <AppShell navigationItems={defaultNavItems} user={defaultUser}>
        <div>Content</div>
      </AppShell>
    )
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Transactions')).toBeInTheDocument()
    expect(screen.getByText('Accounts')).toBeInTheDocument()
    expect(screen.getByText('Budgets')).toBeInTheDocument()
    expect(screen.getByText('Automation')).toBeInTheDocument()
  })

  it('renders user menu with user info', () => {
    render(
      <AppShell navigationItems={defaultNavItems} user={defaultUser}>
        <div>Content</div>
      </AppShell>
    )
    expect(screen.getByText('John Doe')).toBeInTheDocument()
    expect(screen.getByText('john@example.com')).toBeInTheDocument()
  })

  it('calls onNavigate when a nav item is clicked', async () => {
    const user = userEvent.setup()
    const onNavigate = vi.fn()
    render(
      <AppShell navigationItems={defaultNavItems} user={defaultUser} onNavigate={onNavigate}>
        <div>Content</div>
      </AppShell>
    )

    await user.click(screen.getByText('Transactions'))
    expect(onNavigate).toHaveBeenCalledWith('/transactions')
  })

  it('does not render user menu when no user provided', () => {
    render(
      <AppShell navigationItems={defaultNavItems}>
        <div>Content</div>
      </AppShell>
    )
    expect(screen.queryByText('John Doe')).not.toBeInTheDocument()
  })

  it('renders the Smart Finance tagline', () => {
    render(
      <AppShell navigationItems={defaultNavItems} user={defaultUser}>
        <div>Content</div>
      </AppShell>
    )
    expect(screen.getByText('Smart Finance')).toBeInTheDocument()
  })
})
