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

  it('renders all navigation items', () => {
    render(<MainNav items={defaultItems} isCollapsed={false} />)
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Transactions')).toBeInTheDocument()
    expect(screen.getByText('Accounts')).toBeInTheDocument()
  })

  it('hides inline labels when collapsed (only tooltips remain)', () => {
    render(<MainNav items={defaultItems} isCollapsed={true} />)
    // When collapsed, the label <span> is not rendered, but a tooltip <span> still exists.
    // The tooltip is pointer-events-none and opacity-0 (visually hidden).
    const dashboardElements = screen.queryAllByText('Dashboard')
    dashboardElements.forEach((el) => {
      expect(el.className).toContain('pointer-events-none')
    })
    const transactionsElements = screen.queryAllByText('Transactions')
    transactionsElements.forEach((el) => {
      expect(el.className).toContain('pointer-events-none')
    })
  })

  it('calls onNavigate when a nav item is clicked', async () => {
    const user = userEvent.setup()
    const onNavigate = vi.fn()
    render(<MainNav items={defaultItems} isCollapsed={false} onNavigate={onNavigate} />)

    await user.click(screen.getByText('Transactions'))
    expect(onNavigate).toHaveBeenCalledWith('/transactions')
  })

  it('applies active styling to the active item', () => {
    render(<MainNav items={defaultItems} isCollapsed={false} />)
    const dashboardLink = screen.getByText('Dashboard').closest('a')
    expect(dashboardLink?.className).toContain('text-emerald-700')
  })

  it('does not apply active styling to inactive items', () => {
    render(<MainNav items={defaultItems} isCollapsed={false} />)
    const transactionsLink = screen.getByText('Transactions').closest('a')
    expect(transactionsLink?.className).not.toContain('text-emerald-700')
  })

  it('renders tooltips when collapsed', () => {
    render(<MainNav items={defaultItems} isCollapsed={true} />)
    // Tooltips are rendered but hidden via opacity-0
    const tooltips = document.querySelectorAll('.opacity-0')
    expect(tooltips.length).toBeGreaterThan(0)
  })

  it('shows active indicator bar on active item', () => {
    render(<MainNav items={defaultItems} isCollapsed={false} />)
    const activeIndicator = document.querySelector('.bg-emerald-600')
    expect(activeIndicator).toBeInTheDocument()
  })
})
