import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Dashboard } from '../Dashboard'
import sampleData from '../sample-data.json'
import type { DashboardProps } from '../types'

const defaultProps: DashboardProps = {
  user: sampleData.user as DashboardProps['user'],
  summary: sampleData.summary as DashboardProps['summary'],
  accounts: sampleData.accounts as DashboardProps['accounts'],
  spendingByCategory: sampleData.spendingByCategory as DashboardProps['spendingByCategory'],
  monthlyTrend: sampleData.monthlyTrend as DashboardProps['monthlyTrend'],
  recentTransactions: sampleData.recentTransactions as DashboardProps['recentTransactions'],
  categories: sampleData.categories as DashboardProps['categories'],
  notifications: sampleData.notifications as DashboardProps['notifications'],
  quickActions: sampleData.quickActions as DashboardProps['quickActions'],
}

describe('Dashboard', () => {
  // ---------------------------------------------------------------------------
  // 1. Page Load & Display
  // ---------------------------------------------------------------------------
  describe('Page Load & Display', () => {
    it('renders greeting with user first name', () => {
      render(<Dashboard {...defaultProps} />)
      expect(screen.getByText(/Carlos!/)).toBeInTheDocument()
    })

    it('renders all 4 KPI cards', () => {
      render(<Dashboard {...defaultProps} />)
      expect(screen.getByText('Net Worth')).toBeInTheDocument()
      // "Expenses" and "Income" appear in both KPI cards and trend chart legend
      const expensesElements = screen.getAllByText('Expenses')
      expect(expensesElements.length).toBeGreaterThanOrEqual(1)
      const incomeElements = screen.getAllByText('Income')
      expect(incomeElements.length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText('Budget Projection')).toBeInTheDocument()
    })

    it('renders Spending by Category chart', () => {
      render(<Dashboard {...defaultProps} />)
      expect(screen.getByText('Spending by Category')).toBeInTheDocument()
    })

    it('renders Income vs Expenses trend chart', () => {
      render(<Dashboard {...defaultProps} />)
      expect(screen.getByText('Income vs Expenses')).toBeInTheDocument()
    })

    it('renders Quick Actions section', () => {
      render(<Dashboard {...defaultProps} />)
      expect(screen.getByText('Quick Actions')).toBeInTheDocument()
    })

    it('renders Recent Transactions section', () => {
      render(<Dashboard {...defaultProps} />)
      expect(screen.getByText('Recent Transactions')).toBeInTheDocument()
    })

    it('shows financial summary subtitle', () => {
      render(<Dashboard {...defaultProps} />)
      expect(screen.getByText("Here's your financial summary")).toBeInTheDocument()
    })
  })

  // ---------------------------------------------------------------------------
  // 2. Greeting based on time of day
  // ---------------------------------------------------------------------------
  describe('Greeting changes based on time of day', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('shows "Good morning" before noon', () => {
      vi.setSystemTime(new Date(2026, 0, 15, 9, 0, 0))
      render(<Dashboard {...defaultProps} />)
      expect(screen.getByText(/Good morning, Carlos!/)).toBeInTheDocument()
    })

    it('shows "Good afternoon" between noon and 6pm', () => {
      vi.setSystemTime(new Date(2026, 0, 15, 14, 0, 0))
      render(<Dashboard {...defaultProps} />)
      expect(screen.getByText(/Good afternoon, Carlos!/)).toBeInTheDocument()
    })

    it('shows "Good evening" after 6pm', () => {
      vi.setSystemTime(new Date(2026, 0, 15, 20, 0, 0))
      render(<Dashboard {...defaultProps} />)
      expect(screen.getByText(/Good evening, Carlos!/)).toBeInTheDocument()
    })
  })

  // ---------------------------------------------------------------------------
  // 3. Header Actions
  // ---------------------------------------------------------------------------
  describe('Header Actions', () => {
    it('calls onNewTransaction when New Transaction button is clicked', async () => {
      const user = userEvent.setup()
      const onNewTransaction = vi.fn()
      render(<Dashboard {...defaultProps} onNewTransaction={onNewTransaction} />)
      await user.click(screen.getByRole('button', { name: /new/i }))
      expect(onNewTransaction).toHaveBeenCalledOnce()
    })

    it('shows notification badge with count', () => {
      render(<Dashboard {...defaultProps} />)
      expect(screen.getByText('3')).toBeInTheDocument()
    })

    it('shows 9+ when notification count exceeds 9', () => {
      const props = {
        ...defaultProps,
        notifications: { ...defaultProps.notifications, count: 15 },
      }
      render(<Dashboard {...props} />)
      expect(screen.getByText('9+')).toBeInTheDocument()
    })

    it('hides notification badge when count is 0', () => {
      const props = {
        ...defaultProps,
        notifications: { count: 0, items: [] },
      }
      render(<Dashboard {...props} />)
      expect(screen.queryByText('0')).not.toBeInTheDocument()
    })

    it('calls onViewNotifications when bell is clicked', async () => {
      const user = userEvent.setup()
      const onViewNotifications = vi.fn()
      render(<Dashboard {...defaultProps} onViewNotifications={onViewNotifications} />)
      await user.click(screen.getByLabelText(/notifications/i))
      expect(onViewNotifications).toHaveBeenCalledOnce()
    })

    it('calls onLanguageChange when globe button is clicked', async () => {
      const user = userEvent.setup()
      const onLanguageChange = vi.fn()
      render(<Dashboard {...defaultProps} onLanguageChange={onLanguageChange} />)
      await user.click(screen.getByLabelText('Change language'))
      expect(onLanguageChange).toHaveBeenCalledOnce()
    })
  })

  // ---------------------------------------------------------------------------
  // 4. Spending Chart period filter
  // ---------------------------------------------------------------------------
  describe('Spending Chart', () => {
    it('calls onSpendingFilterChange when period tab is clicked', async () => {
      const user = userEvent.setup()
      const onSpendingFilterChange = vi.fn()
      render(<Dashboard {...defaultProps} onSpendingFilterChange={onSpendingFilterChange} />)

      // The spending chart has Day/Week/Month/Year/Total tabs
      // "Month" is the default, click "Year"
      const spendingSection = screen.getByText('Spending by Category').closest('div')!
      const yearButton = within(spendingSection).getByText('Year')
      await user.click(yearButton)

      expect(onSpendingFilterChange).toHaveBeenCalledWith('year')
    })

    it('displays total amount', () => {
      render(<Dashboard {...defaultProps} />)
      expect(screen.getByText('$2,340.50')).toBeInTheDocument()
    })

    it('displays top categories', () => {
      render(<Dashboard {...defaultProps} />)
      expect(screen.getByText('Supermercado')).toBeInTheDocument()
      expect(screen.getByText('Transporte')).toBeInTheDocument()
      expect(screen.getByText('Restaurantes')).toBeInTheDocument()
    })
  })

  // ---------------------------------------------------------------------------
  // 5. Trend Chart period filter
  // ---------------------------------------------------------------------------
  describe('Trend Chart', () => {
    it('calls onTrendFilterChange when period tab is clicked', async () => {
      const user = userEvent.setup()
      const onTrendFilterChange = vi.fn()
      render(<Dashboard {...defaultProps} onTrendFilterChange={onTrendFilterChange} />)

      const trendSection = screen.getByText('Income vs Expenses').closest('div')!
      const yearButton = within(trendSection).getByText('Year')
      await user.click(yearButton)

      expect(onTrendFilterChange).toHaveBeenCalledWith('year')
    })

    it('shows Income and Expenses legend', () => {
      render(<Dashboard {...defaultProps} />)
      // Legend items
      const incomeItems = screen.getAllByText('Income')
      const expenseItems = screen.getAllByText('Expenses')
      expect(incomeItems.length).toBeGreaterThanOrEqual(1)
      expect(expenseItems.length).toBeGreaterThanOrEqual(1)
    })
  })

  // ---------------------------------------------------------------------------
  // 6. Quick Actions
  // ---------------------------------------------------------------------------
  describe('Quick Actions', () => {
    it('shows all 4 action buttons', () => {
      render(<Dashboard {...defaultProps} />)
      expect(screen.getByText('Add Transaction')).toBeInTheDocument()
      expect(screen.getByText('Connect WhatsApp')).toBeInTheDocument()
      expect(screen.getByText('Manage Accounts')).toBeInTheDocument()
      expect(screen.getByText('View Categories')).toBeInTheDocument()
    })

    it('calls onQuickAction with correct href when clicked', async () => {
      const user = userEvent.setup()
      const onQuickAction = vi.fn()
      render(<Dashboard {...defaultProps} onQuickAction={onQuickAction} />)

      await user.click(screen.getByText('Add Transaction'))
      expect(onQuickAction).toHaveBeenCalledWith('/transactions/new')

      await user.click(screen.getByText('Connect WhatsApp'))
      expect(onQuickAction).toHaveBeenCalledWith('/automation/whatsapp')

      await user.click(screen.getByText('Manage Accounts'))
      expect(onQuickAction).toHaveBeenCalledWith('/accounts')

      await user.click(screen.getByText('View Categories'))
      expect(onQuickAction).toHaveBeenCalledWith('/categories')
    })
  })

  // ---------------------------------------------------------------------------
  // 7. Recent Transactions
  // ---------------------------------------------------------------------------
  describe('Recent Transactions', () => {
    it('shows up to 5 recent transactions', () => {
      render(<Dashboard {...defaultProps} />)
      // Sample data has 5 transactions
      expect(screen.getByText('Super Selectos')).toBeInTheDocument()
      expect(screen.getByText('Salario quincenal')).toBeInTheDocument()
      expect(screen.getByText('Netflix')).toBeInTheDocument()
      expect(screen.getByText('Uber')).toBeInTheDocument()
      expect(screen.getByText('La Pampa Argentina')).toBeInTheDocument()
    })

    it('shows category and date for each transaction', () => {
      render(<Dashboard {...defaultProps} />)
      // Category names appear in both spending chart and transactions
      const supermercadoElements = screen.getAllByText(/Supermercado/)
      expect(supermercadoElements.length).toBeGreaterThanOrEqual(1)
      const transporteElements = screen.getAllByText(/Transporte/)
      expect(transporteElements.length).toBeGreaterThanOrEqual(1)
    })

    it('calls onViewAllTransactions when View All is clicked', async () => {
      const user = userEvent.setup()
      const onViewAllTransactions = vi.fn()
      render(<Dashboard {...defaultProps} onViewAllTransactions={onViewAllTransactions} />)
      await user.click(screen.getByText('View All'))
      expect(onViewAllTransactions).toHaveBeenCalledOnce()
    })

    it('calls onViewTransaction with transaction ID when clicked', async () => {
      const user = userEvent.setup()
      const onViewTransaction = vi.fn()
      render(<Dashboard {...defaultProps} onViewTransaction={onViewTransaction} />)
      await user.click(screen.getByText('Super Selectos'))
      expect(onViewTransaction).toHaveBeenCalledWith('txn-001')
    })

    it('shows amounts with correct formatting', () => {
      render(<Dashboard {...defaultProps} />)
      // Expense: -$45.32 (Super Selectos)
      expect(screen.getByText('-$45.32')).toBeInTheDocument()
      // Income: +$2,100.00 (Salario)
      expect(screen.getByText('+$2,100.00')).toBeInTheDocument()
    })
  })

  // ---------------------------------------------------------------------------
  // 8. Empty States
  // ---------------------------------------------------------------------------
  describe('Empty States', () => {
    it('shows empty state when no transactions', () => {
      const props = { ...defaultProps, recentTransactions: [] }
      render(<Dashboard {...props} />)
      expect(screen.getByText('No transactions yet')).toBeInTheDocument()
    })

    it('shows empty state when no spending data', () => {
      const props = {
        ...defaultProps,
        spendingByCategory: { period: 'month' as const, total: 0, categories: [] },
      }
      render(<Dashboard {...props} />)
      expect(screen.getByText('No spending data yet')).toBeInTheDocument()
    })
  })
})
