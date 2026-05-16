import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BudgetsDashboard } from '../BudgetsDashboard'
import sampleData from '../sample-data.json'
import type { BudgetsProps } from '../types'

const defaultProps: BudgetsProps = {
  summary: sampleData.summary as BudgetsProps['summary'],
  categories: sampleData.categories as BudgetsProps['categories'],
  budgets: sampleData.budgets as BudgetsProps['budgets'],
  goals: sampleData.goals as BudgetsProps['goals'],
  goalContributions: sampleData.goalContributions as BudgetsProps['goalContributions'],
  savingsAccounts: sampleData.savingsAccounts as BudgetsProps['savingsAccounts'],
  monthlyHistory: sampleData.monthlyHistory as BudgetsProps['monthlyHistory'],
  transactions: sampleData.transactions as BudgetsProps['transactions'],
}

describe('BudgetsDashboard', () => {
  // ---------------------------------------------------------------------------
  // 1. Page Load / Header
  // ---------------------------------------------------------------------------
  describe('Page Header', () => {
    it('renders the page title', () => {
      render(<BudgetsDashboard {...defaultProps} />)
      expect(screen.getByRole('heading', { level: 1, name: 'Budgets' })).toBeInTheDocument()
    })

    it('renders the month subtitle', () => {
      render(<BudgetsDashboard {...defaultProps} />)
      expect(screen.getByText('January 2025')).toBeInTheDocument()
    })

    it('renders the Add Budget button', () => {
      render(<BudgetsDashboard {...defaultProps} />)
      expect(screen.getByText('Add Budget')).toBeInTheDocument()
    })
  })

  // ---------------------------------------------------------------------------
  // 2. Summary Cards
  // ---------------------------------------------------------------------------
  describe('Summary Cards', () => {
    it('displays Total Budgeted amount', () => {
      render(<BudgetsDashboard {...defaultProps} />)
      expect(screen.getByText('Total Budgeted')).toBeInTheDocument()
      expect(screen.getByText('$4,850.00')).toBeInTheDocument()
    })

    it('displays Total Spent amount', () => {
      render(<BudgetsDashboard {...defaultProps} />)
      expect(screen.getByText('Total Spent')).toBeInTheDocument()
      expect(screen.getByText('$3,124.67')).toBeInTheDocument()
    })

    it('displays Remaining amount', () => {
      render(<BudgetsDashboard {...defaultProps} />)
      expect(screen.getByText('Remaining')).toBeInTheDocument()
      expect(screen.getByText('$1,725.33')).toBeInTheDocument()
    })
  })

  // ---------------------------------------------------------------------------
  // 3. Spending Chart
  // ---------------------------------------------------------------------------
  describe('Spending Chart', () => {
    it('renders the Spending vs Budget header', () => {
      render(<BudgetsDashboard {...defaultProps} />)
      expect(screen.getByText('Spending vs Budget')).toBeInTheDocument()
    })

    it('renders the 6 months and 12 months toggle buttons', () => {
      render(<BudgetsDashboard {...defaultProps} />)
      expect(screen.getByText('6 months')).toBeInTheDocument()
      expect(screen.getByText('12 months')).toBeInTheDocument()
    })

    it('renders chart legend items', () => {
      render(<BudgetsDashboard {...defaultProps} />)
      // "Spent" appears in both legend and sort dropdown, so use getAllByText
      const spentElements = screen.getAllByText('Spent')
      expect(spentElements.length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText('Budgeted')).toBeInTheDocument()
    })
  })

  // ---------------------------------------------------------------------------
  // 4. Filter Controls
  // ---------------------------------------------------------------------------
  describe('Filter Controls', () => {
    it('renders the type filter dropdown', () => {
      render(<BudgetsDashboard {...defaultProps} />)
      const typeLabel = screen.getByText('Type:')
      const select = typeLabel.parentElement?.querySelector('select')
      expect(select).toBeInTheDocument()
    })

    it('renders the sort field dropdown', () => {
      render(<BudgetsDashboard {...defaultProps} />)
      const sortLabel = screen.getByText('Sort by:')
      const select = sortLabel.parentElement?.querySelector('select')
      expect(select).toBeInTheDocument()
    })

    it('calls onFilterChange when type filter changes', async () => {
      const user = userEvent.setup()
      const onFilterChange = vi.fn()
      render(<BudgetsDashboard {...defaultProps} onFilterChange={onFilterChange} />)
      const typeLabel = screen.getByText('Type:')
      const select = typeLabel.parentElement?.querySelector('select')
      await user.selectOptions(select!, 'monthly')
      expect(onFilterChange).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'monthly' })
      )
    })
  })

  // ---------------------------------------------------------------------------
  // 5. Budget Cards
  // ---------------------------------------------------------------------------
  describe('Budget Cards', () => {
    it('renders budget names from sample data', () => {
      render(<BudgetsDashboard {...defaultProps} />)
      expect(screen.getByText('Food & Dining')).toBeInTheDocument()
      expect(screen.getByText('Coffee shops')).toBeInTheDocument()
      expect(screen.getByText('Restaurants and bars')).toBeInTheDocument()
    })

    it('renders goal names from sample data', () => {
      render(<BudgetsDashboard {...defaultProps} />)
      expect(screen.getByText('Car Maintenance Fund')).toBeInTheDocument()
      expect(screen.getByText('Summer Vacation')).toBeInTheDocument()
    })

    it('renders Category badges for category-level budgets', () => {
      render(<BudgetsDashboard {...defaultProps} />)
      const categoryBadges = screen.getAllByText('Category')
      expect(categoryBadges.length).toBeGreaterThan(0)
    })

    it('renders Fund badges for sinking fund goals', () => {
      render(<BudgetsDashboard {...defaultProps} />)
      const fundBadges = screen.getAllByText('Fund')
      expect(fundBadges.length).toBeGreaterThan(0)
    })

    it('renders budget progress percentages', () => {
      render(<BudgetsDashboard {...defaultProps} />)
      // Food & Dining: 623.45 / 800 = 78%
      expect(screen.getByText('78%')).toBeInTheDocument()
    })
  })

  // ---------------------------------------------------------------------------
  // 6. Drawer
  // ---------------------------------------------------------------------------
  describe('Drawer', () => {
    it('opens the drawer when clicking a budget card', async () => {
      const user = userEvent.setup()
      render(<BudgetsDashboard {...defaultProps} />)
      await user.click(screen.getByText('Food & Dining'))
      // Drawer should now show the budget name as heading
      const headings = screen.getAllByText('Food & Dining')
      // One in card, one in drawer
      expect(headings.length).toBeGreaterThanOrEqual(2)
    })

    it('opens the drawer when clicking a goal card', async () => {
      const user = userEvent.setup()
      render(<BudgetsDashboard {...defaultProps} />)
      await user.click(screen.getByText('Car Maintenance Fund'))
      expect(screen.getByText('Sinking Fund')).toBeInTheDocument()
    })

    it('shows Edit Budget button in drawer for monthly budgets', async () => {
      const user = userEvent.setup()
      render(<BudgetsDashboard {...defaultProps} />)
      await user.click(screen.getByText('Coffee shops'))
      expect(screen.getByText('Edit Budget')).toBeInTheDocument()
    })

    it('shows Delete button in drawer', async () => {
      const user = userEvent.setup()
      render(<BudgetsDashboard {...defaultProps} />)
      await user.click(screen.getByText('Coffee shops'))
      expect(screen.getByText('Delete')).toBeInTheDocument()
    })
  })

  // ---------------------------------------------------------------------------
  // 7. Create Modal
  // ---------------------------------------------------------------------------
  describe('Create Modal', () => {
    it('opens the create modal when Add Budget is clicked', async () => {
      const user = userEvent.setup()
      render(<BudgetsDashboard {...defaultProps} />)
      await user.click(screen.getByText('Add Budget'))
      expect(screen.getByText('Create New Budget')).toBeInTheDocument()
    })

    it('shows budget type toggle in modal', async () => {
      const user = userEvent.setup()
      render(<BudgetsDashboard {...defaultProps} />)
      await user.click(screen.getByText('Add Budget'))
      expect(screen.getByText('Monthly Budget')).toBeInTheDocument()
      expect(screen.getByText('Sinking Fund')).toBeInTheDocument()
    })

    it('shows category select in modal', async () => {
      const user = userEvent.setup()
      render(<BudgetsDashboard {...defaultProps} />)
      await user.click(screen.getByText('Add Budget'))
      expect(screen.getByText('Select a category...')).toBeInTheDocument()
    })

    it('closes the modal when Cancel is clicked', async () => {
      const user = userEvent.setup()
      render(<BudgetsDashboard {...defaultProps} />)
      await user.click(screen.getByText('Add Budget'))
      expect(screen.getByText('Create New Budget')).toBeInTheDocument()
      await user.click(screen.getByText('Cancel'))
      expect(screen.queryByText('Create New Budget')).not.toBeInTheDocument()
    })
  })

  // ---------------------------------------------------------------------------
  // 8. Empty States
  // ---------------------------------------------------------------------------
  describe('Empty States', () => {
    it('shows "No budgets yet" when budgets and goals are empty', () => {
      render(
        <BudgetsDashboard {...defaultProps} budgets={[]} goals={[]} />
      )
      expect(screen.getByText('No budgets yet')).toBeInTheDocument()
      expect(screen.getByText('Create your first budget to start tracking spending')).toBeInTheDocument()
    })

    it('shows "Add your first budget" button in empty state', () => {
      render(
        <BudgetsDashboard {...defaultProps} budgets={[]} goals={[]} />
      )
      expect(screen.getByText('Add your first budget')).toBeInTheDocument()
    })

    it('opens create modal from empty state button', async () => {
      const user = userEvent.setup()
      render(
        <BudgetsDashboard {...defaultProps} budgets={[]} goals={[]} />
      )
      await user.click(screen.getByText('Add your first budget'))
      expect(screen.getByText('Create New Budget')).toBeInTheDocument()
    })
  })
})
