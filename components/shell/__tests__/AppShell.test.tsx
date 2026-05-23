import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppShell } from '@/components/shell/AppShell'

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
}))

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
      </AppShell>,
    )
    const brandElements = screen.getAllByText('Ledger')
    expect(brandElements.length).toBeGreaterThanOrEqual(1)
  })

  it('renders children in the main content area', () => {
    render(
      <AppShell navigationItems={defaultNavItems} user={defaultUser}>
        <div data-testid="page-content">Dashboard content</div>
      </AppShell>,
    )
    expect(screen.getByTestId('page-content')).toBeInTheDocument()
  })

  it('renders all navigation items (collapsed rail exposes them as titles)', () => {
    render(
      <AppShell navigationItems={defaultNavItems} user={defaultUser}>
        <div>Content</div>
      </AppShell>,
    )
    expect(screen.getByTitle('Dashboard')).toBeInTheDocument()
    expect(screen.getByTitle('Transactions')).toBeInTheDocument()
    expect(screen.getByTitle('Accounts')).toBeInTheDocument()
    expect(screen.getByTitle('Budgets')).toBeInTheDocument()
    expect(screen.getByTitle('Automation')).toBeInTheDocument()
  })

  it('renders the user avatar initials', () => {
    render(
      <AppShell navigationItems={defaultNavItems} user={defaultUser}>
        <div>Content</div>
      </AppShell>,
    )
    // collapsed rail shows initials; topbar avatar also renders them
    expect(screen.getAllByText('JD').length).toBeGreaterThanOrEqual(1)
  })

  it('calls onNavigate when a nav item is clicked', async () => {
    const user = userEvent.setup()
    const onNavigate = vi.fn()
    render(
      <AppShell navigationItems={defaultNavItems} user={defaultUser} onNavigate={onNavigate}>
        <div>Content</div>
      </AppShell>,
    )

    await user.click(screen.getByTitle('Transactions'))
    expect(onNavigate).toHaveBeenCalledWith('/transactions')
  })

  it('does not render user info when no user provided', () => {
    render(
      <AppShell navigationItems={defaultNavItems}>
        <div>Content</div>
      </AppShell>,
    )
    expect(screen.queryByText('JD')).not.toBeInTheDocument()
  })
})
