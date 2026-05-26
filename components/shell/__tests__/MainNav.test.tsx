import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MainNav } from '@/components/shell/MainNav'
import { LayoutDashboard, Receipt, Wallet } from 'lucide-react'

describe('MainNav', () => {
  const defaultItems = [
    { label: 'Dashboard', href: '/dashboard', Icon: LayoutDashboard, isActive: true },
    { label: 'Transactions', href: '/transactions', Icon: Receipt, isActive: false },
    { label: 'Accounts', href: '/accounts', Icon: Wallet, isActive: false },
  ]

  it('renders all navigation items when expanded', () => {
    render(<MainNav items={defaultItems} isCollapsed={false} />)
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Transactions')).toBeInTheDocument()
    expect(screen.getByText('Accounts')).toBeInTheDocument()
  })

  it('hides inline labels when collapsed and exposes them as link titles', () => {
    render(<MainNav items={defaultItems} isCollapsed={true} />)
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument()
    expect(screen.getByTitle('Dashboard')).toBeInTheDocument()
    expect(screen.getByTitle('Transactions')).toBeInTheDocument()
  })

  it('calls onNavigate when a nav item is clicked', async () => {
    const user = userEvent.setup()
    const onNavigate = vi.fn()
    render(<MainNav items={defaultItems} isCollapsed={false} onNavigate={onNavigate} />)

    await user.click(screen.getByText('Transactions'))
    expect(onNavigate).toHaveBeenCalledWith('/transactions')
  })

  it('applies accent color to the active item', () => {
    render(<MainNav items={defaultItems} isCollapsed={false} />)
    const dashboardLink = screen.getByText('Dashboard').closest('a')
    expect(dashboardLink?.style.color).toBe('var(--accent-a)')
  })

  it('does not apply accent color to inactive items', () => {
    render(<MainNav items={defaultItems} isCollapsed={false} />)
    const transactionsLink = screen.getByText('Transactions').closest('a')
    expect(transactionsLink?.style.color).not.toBe('var(--accent-a)')
  })

  it('renders a glowing indicator bar on the active item', () => {
    render(<MainNav items={defaultItems} isCollapsed={false} />)
    const dashboardLink = screen.getByText('Dashboard').closest('a')
    const indicator = dashboardLink?.querySelector('span')
    expect(indicator?.style.boxShadow).toContain('--accent-solid')
  })
})
