import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
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
  describe('Composition', () => {
    it('renders the net worth hero with the amount', () => {
      render(<Dashboard {...defaultProps} />)
      expect(screen.getAllByText('Net worth').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('$12,450').length).toBeGreaterThanOrEqual(1)
    })

    it('renders the AI insight card with a derived overspend headline', () => {
      render(<Dashboard {...defaultProps} />)
      expect(screen.getByText('AI Insight')).toBeInTheDocument()
      // sample budget is in "warning" with $312 projected overspend
      expect(screen.getByText('$312.00')).toBeInTheDocument()
    })

    it('renders the four KPI tiles', () => {
      render(<Dashboard {...defaultProps} />)
      expect(screen.getByText('Income · this month')).toBeInTheDocument()
      expect(screen.getByText('Expenses · this month')).toBeInTheDocument()
      expect(screen.getByText('Savings · this month')).toBeInTheDocument()
    })

    it('renders the Statistic chart', () => {
      render(<Dashboard {...defaultProps} />)
      expect(screen.getByText('Statistic')).toBeInTheDocument()
    })

    it('renders the budget glance with status and spend', () => {
      render(<Dashboard {...defaultProps} />)
      expect(screen.getByText('on warning')).toBeInTheDocument()
      expect(screen.getByText('$2,340.50')).toBeInTheDocument()
    })

    it('renders the accounts mini list', () => {
      render(<Dashboard {...defaultProps} />)
      expect(screen.getByText('Accounts')).toBeInTheDocument()
      expect(screen.getByText('Visa Gold BAC')).toBeInTheDocument()
    })
  })

  describe('Recent Transactions', () => {
    it('shows recent activity (merchant or description)', () => {
      render(<Dashboard {...defaultProps} />)
      expect(screen.getByText('Super Selectos')).toBeInTheDocument()
      expect(screen.getByText('Netflix')).toBeInTheDocument()
      expect(screen.getByText('Uber')).toBeInTheDocument()
      // income txn has no merchant → falls back to description
      expect(screen.getByText('Salario quincenal')).toBeInTheDocument()
    })

    it('formats expense amounts with a minus sign', () => {
      render(<Dashboard {...defaultProps} />)
      expect(screen.getByText('−$45.32')).toBeInTheDocument()
    })

    it('calls onViewAllTransactions when "View all" is clicked', async () => {
      const user = userEvent.setup()
      const onViewAllTransactions = vi.fn()
      render(<Dashboard {...defaultProps} onViewAllTransactions={onViewAllTransactions} />)
      await user.click(screen.getByText('View all →'))
      expect(onViewAllTransactions).toHaveBeenCalled()
    })

    it('calls onViewTransaction with the transaction id when a row is clicked', async () => {
      const user = userEvent.setup()
      const onViewTransaction = vi.fn()
      render(<Dashboard {...defaultProps} onViewTransaction={onViewTransaction} />)
      await user.click(screen.getByText('Super Selectos'))
      expect(onViewTransaction).toHaveBeenCalledWith('txn-001')
    })
  })

  describe('Empty states', () => {
    it('shows an empty state when there are no transactions', () => {
      render(<Dashboard {...defaultProps} recentTransactions={[]} />)
      expect(screen.getByText('No transactions yet')).toBeInTheDocument()
    })

    it('shows a placeholder when there is not enough trend history', () => {
      render(<Dashboard {...defaultProps} monthlyTrend={[]} />)
      expect(screen.getByText('Not enough history yet')).toBeInTheDocument()
    })
  })
})
