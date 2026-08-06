import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TransactionList } from '../TransactionList'
import sampleData from '../sample-data.json'
import type { TransactionsProps } from '../types'

const defaultProps: TransactionsProps = {
  transactions: sampleData.transactions as TransactionsProps['transactions'],
  categories: sampleData.categories as TransactionsProps['categories'],
  accounts: sampleData.accounts as TransactionsProps['accounts'],
  goalsByAccount: sampleData.goalsByAccount as TransactionsProps['goalsByAccount'],
  summary: sampleData.summary as TransactionsProps['summary'],
  currentPage: 1,
  totalPages: 3,
  hasAnyTransactions: true,
}

describe('TransactionList', () => {
  // ---------------------------------------------------------------------------
  // 1. Page Header
  // ---------------------------------------------------------------------------
  describe('Page Header', () => {
    it('renders the page title', () => {
      render(<TransactionList {...defaultProps} />)
      expect(screen.getByRole('heading', { level: 1, name: 'Transactions' })).toBeInTheDocument()
    })

    it('renders the page subtitle', () => {
      render(<TransactionList {...defaultProps} />)
      expect(screen.getByText('View and manage all your financial transactions')).toBeInTheDocument()
    })

    it('renders the New Transaction button', () => {
      render(<TransactionList {...defaultProps} />)
      expect(screen.getByText('New Transaction')).toBeInTheDocument()
    })

    it('calls onCreate when New Transaction button is clicked', async () => {
      const user = userEvent.setup()
      const onCreate = vi.fn()
      render(<TransactionList {...defaultProps} onCreate={onCreate} />)
      await user.click(screen.getByText('New Transaction'))
      expect(onCreate).toHaveBeenCalledOnce()
    })
  })

  // ---------------------------------------------------------------------------
  // 2. Summary Bar
  // ---------------------------------------------------------------------------
  describe('Summary Bar', () => {
    it('displays the transaction count', () => {
      render(<TransactionList {...defaultProps} />)
      expect(screen.getByText('15')).toBeInTheDocument()
    })

    it('displays income total', () => {
      render(<TransactionList {...defaultProps} />)
      expect(screen.getByText('+$9,350.00')).toBeInTheDocument()
    })

    it('displays expense total', () => {
      render(<TransactionList {...defaultProps} />)
      expect(screen.getByText('-$794.33')).toBeInTheDocument()
    })
  })

  // ---------------------------------------------------------------------------
  // 3. Table Rendering
  // ---------------------------------------------------------------------------
  describe('Table Rendering', () => {
    it('renders all column headers', () => {
      render(<TransactionList {...defaultProps} />)
      const thead = screen.getAllByRole('columnheader')
      // 5 sortable columns + 1 actions column
      expect(thead.length).toBe(6)
      expect(within(thead[0]).getByText('Date')).toBeInTheDocument()
      expect(within(thead[1]).getByText('Description')).toBeInTheDocument()
      expect(within(thead[2]).getByText('Category')).toBeInTheDocument()
      expect(within(thead[3]).getByText('Account')).toBeInTheDocument()
      expect(within(thead[4]).getByText('Amount')).toBeInTheDocument()
    })

    it('renders transaction descriptions from sample data', () => {
      render(<TransactionList {...defaultProps} />)
      expect(screen.getByText('Monthly salary deposit')).toBeInTheDocument()
      expect(screen.getByText('Super Selectos groceries')).toBeInTheDocument()
      expect(screen.getByText('Uber ride to downtown')).toBeInTheDocument()
    })

    it('renders category pills in table rows', () => {
      render(<TransactionList {...defaultProps} />)
      const table = screen.getByRole('table')
      expect(within(table).getByText('Salary')).toBeInTheDocument()
      expect(within(table).getByText('Groceries')).toBeInTheDocument()
      // Transportation appears in multiple rows
      const transportationPills = within(table).getAllByText('Transportation')
      expect(transportationPills.length).toBeGreaterThan(0)
    })

    it('renders account names', () => {
      render(<TransactionList {...defaultProps} />)
      const mainCheckingCells = screen.getAllByText('Main Checking')
      expect(mainCheckingCells.length).toBeGreaterThan(0)
    })

    it('renders formatted amounts with color coding', () => {
      render(<TransactionList {...defaultProps} />)
      // Income: +$4,500.00
      expect(screen.getByText('+$4,500.00')).toBeInTheDocument()
      // Expense: -$87.45
      expect(screen.getByText('-$87.45')).toBeInTheDocument()
    })
  })

  // ---------------------------------------------------------------------------
  // 4. Empty States
  // ---------------------------------------------------------------------------
  describe('Empty States', () => {
    it('shows "No transactions yet" when hasAnyTransactions is false', () => {
      render(
        <TransactionList
          {...defaultProps}
          transactions={[]}
          hasAnyTransactions={false}
        />
      )
      expect(screen.getByText('No transactions yet')).toBeInTheDocument()
      expect(screen.getByText('Add your first transaction')).toBeInTheDocument()
    })

    it('shows search-specific empty state when searchQuery is set', () => {
      render(
        <TransactionList
          {...defaultProps}
          transactions={[]}
          searchQuery="nonexistent"
          hasAnyTransactions={true}
        />
      )
      expect(screen.getByText('No transactions found for "nonexistent"')).toBeInTheDocument()
    })

    it('shows filter-specific empty state with clear filters link', () => {
      render(
        <TransactionList
          {...defaultProps}
          transactions={[]}
          hasAnyTransactions={true}
        />
      )
      expect(screen.getByText('No transactions match your filters')).toBeInTheDocument()
      expect(screen.getByText('Clear filters')).toBeInTheDocument()
    })

    it('calls onClearFilters when clear filters link is clicked', async () => {
      const user = userEvent.setup()
      const onClearFilters = vi.fn()
      render(
        <TransactionList
          {...defaultProps}
          transactions={[]}
          hasAnyTransactions={true}
          onClearFilters={onClearFilters}
        />
      )
      await user.click(screen.getByText('Clear filters'))
      expect(onClearFilters).toHaveBeenCalledOnce()
    })
  })

  // ---------------------------------------------------------------------------
  // 5. Sorting
  // ---------------------------------------------------------------------------
  describe('Sorting', () => {
    const getColumnHeaderButton = (name: string) => {
      const headers = screen.getAllByRole('columnheader')
      for (const header of headers) {
        const btn = within(header).queryByText(name)
        if (btn) return btn
      }
      throw new Error(`Column header "${name}" not found`)
    }

    it('calls onSort when Date column header is clicked', async () => {
      const user = userEvent.setup()
      const onSort = vi.fn()
      render(<TransactionList {...defaultProps} onSort={onSort} />)
      await user.click(getColumnHeaderButton('Date'))
      expect(onSort).toHaveBeenCalledWith('date', 'asc')
    })

    it('calls onSort with desc when clicking already sorted asc column', async () => {
      const user = userEvent.setup()
      const onSort = vi.fn()
      render(
        <TransactionList
          {...defaultProps}
          sortField="date"
          sortDirection="asc"
          onSort={onSort}
        />
      )
      await user.click(getColumnHeaderButton('Date'))
      expect(onSort).toHaveBeenCalledWith('date', 'desc')
    })

    it('calls onSort for each sortable column', async () => {
      const user = userEvent.setup()
      const onSort = vi.fn()
      render(<TransactionList {...defaultProps} onSort={onSort} />)

      await user.click(getColumnHeaderButton('Description'))
      expect(onSort).toHaveBeenCalledWith('description', 'asc')

      await user.click(getColumnHeaderButton('Category'))
      expect(onSort).toHaveBeenCalledWith('category', 'asc')

      await user.click(getColumnHeaderButton('Account'))
      expect(onSort).toHaveBeenCalledWith('account', 'asc')

      await user.click(getColumnHeaderButton('Amount'))
      expect(onSort).toHaveBeenCalledWith('amount', 'asc')
    })
  })

  // ---------------------------------------------------------------------------
  // 6. Pagination
  // ---------------------------------------------------------------------------
  describe('Pagination', () => {
    it('shows pagination when totalPages > 1', () => {
      render(<TransactionList {...defaultProps} totalPages={3} currentPage={1} />)
      expect(screen.getByText('Page 1 of 3')).toBeInTheDocument()
    })

    it('does not show pagination when totalPages is 1', () => {
      render(<TransactionList {...defaultProps} totalPages={1} currentPage={1} />)
      expect(screen.queryByText('Page 1 of 1')).not.toBeInTheDocument()
    })

    it('calls onPageChange when clicking next page', async () => {
      const user = userEvent.setup()
      const onPageChange = vi.fn()
      render(
        <TransactionList
          {...defaultProps}
          totalPages={3}
          currentPage={1}
          onPageChange={onPageChange}
        />
      )
      // Click page 2 button
      await user.click(screen.getByText('2'))
      expect(onPageChange).toHaveBeenCalledWith(2)
    })

    it('disables previous button on first page', () => {
      render(
        <TransactionList {...defaultProps} totalPages={3} currentPage={1} />
      )
      const buttons = screen.getAllByRole('button')
      const prevButton = buttons.find(btn => btn.querySelector('.lucide-chevron-left'))
      expect(prevButton).toBeDisabled()
    })

    it('disables next button on last page', () => {
      render(
        <TransactionList {...defaultProps} totalPages={3} currentPage={3} />
      )
      const buttons = screen.getAllByRole('button')
      const nextButton = buttons.find(btn => btn.querySelector('.lucide-chevron-right'))
      expect(nextButton).toBeDisabled()
    })
  })

  // ---------------------------------------------------------------------------
  // 7. Filter and Search Callbacks
  // ---------------------------------------------------------------------------
  describe('Filter and Search', () => {
    it('renders search input', () => {
      render(<TransactionList {...defaultProps} />)
      expect(screen.getByPlaceholderText('Search transactions...')).toBeInTheDocument()
    })

    it('calls onSearch when typing in search input', async () => {
      const user = userEvent.setup()
      const onSearch = vi.fn()
      render(<TransactionList {...defaultProps} onSearch={onSearch} />)
      await user.type(screen.getByPlaceholderText('Search transactions...'), 'salary')
      expect(onSearch).toHaveBeenCalled()
    })

    it('renders filter buttons', () => {
      render(<TransactionList {...defaultProps} />)
      // Category and Account appear in both table headers and filter buttons
      const categoryElements = screen.getAllByText('Category')
      expect(categoryElements.length).toBeGreaterThanOrEqual(2)
      const accountElements = screen.getAllByText('Account')
      expect(accountElements.length).toBeGreaterThanOrEqual(2)
      expect(screen.getByText('Source')).toBeInTheDocument()
      expect(screen.getByText('Type')).toBeInTheDocument()
    })

    it('offers Manual/Imported/Telegram source options (no WhatsApp/Email)', async () => {
      const user = userEvent.setup()
      render(<TransactionList {...defaultProps} />)
      await user.click(screen.getByText('Source'))
      expect(screen.getByText('Imported')).toBeInTheDocument()
      expect(screen.getByText('Telegram')).toBeInTheDocument()
      expect(screen.queryByText('WhatsApp')).not.toBeInTheDocument()
      expect(screen.queryByText('Email')).not.toBeInTheDocument()
    })

    it('calls onFilterChange with types when a type option is toggled', async () => {
      const user = userEvent.setup()
      const onFilterChange = vi.fn()
      render(<TransactionList {...defaultProps} onFilterChange={onFilterChange} />)
      await user.click(screen.getByText('Type'))
      await user.click(screen.getByText('Expense'))
      expect(onFilterChange).toHaveBeenCalledWith(expect.objectContaining({ types: ['expense'] }))
    })
  })

  // ---------------------------------------------------------------------------
  // 8. Transfer rendering
  // ---------------------------------------------------------------------------
  describe('Transfer rendering', () => {
    it('renders a transfer with a neutral Transfer pill, both accounts, and no sign', () => {
      render(<TransactionList {...defaultProps} />)
      const row = screen.getByText('Visa credit card payment').closest('tr')!
      expect(within(row).getByText('Transfer')).toBeInTheDocument()
      expect(within(row).getByText('Main Checking')).toBeInTheDocument()
      expect(within(row).getByText('Visa Credit Card')).toBeInTheDocument()
      // Amount is unsigned — no +/-, and never the green income treatment
      expect(within(row).getByText('$450.00')).toBeInTheDocument()
      expect(within(row).queryByText('+$450.00')).not.toBeInTheDocument()
      expect(within(row).queryByText('-$450.00')).not.toBeInTheDocument()
      expect(within(row).queryByText('Uncategorized')).not.toBeInTheDocument()
    })
  })
})
