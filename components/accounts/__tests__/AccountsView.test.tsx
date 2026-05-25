import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AccountsView } from '../AccountsView'
import sampleData from '../sample-data.json'
import type { AccountsProps } from '../types'

const defaultProps: AccountsProps = {
  accounts: sampleData.accounts as AccountsProps['accounts'],
  institutions: sampleData.institutions as AccountsProps['institutions'],
  creditCardProviders: sampleData.creditCardProviders as AccountsProps['creditCardProviders'],
  onViewAccount: vi.fn(),
  onEditAccount: vi.fn(),
  onDeleteAccount: vi.fn(),
  onCreateAccount: vi.fn(),
  onSave: vi.fn(),
  showArchived: false,
  onToggleArchived: vi.fn(),
  onRestoreAccount: vi.fn(),
}

describe('AccountsView', () => {
  // ---------------------------------------------------------------------------
  // 1. Page Header
  // ---------------------------------------------------------------------------
  describe('Page Header', () => {
    it('renders the page title', () => {
      render(<AccountsView {...defaultProps} />)
      expect(screen.getByRole('heading', { level: 1, name: 'Accounts' })).toBeInTheDocument()
    })

    it('renders the page subtitle', () => {
      render(<AccountsView {...defaultProps} />)
      expect(screen.getByText('Manage your financial accounts')).toBeInTheDocument()
    })

    it('renders the New Account button', () => {
      render(<AccountsView {...defaultProps} />)
      expect(screen.getByRole('button', { name: /New Account/ })).toBeInTheDocument()
    })

    it('renders the Show Archived checkbox', () => {
      render(<AccountsView {...defaultProps} />)
      expect(screen.getByText('Show Archived')).toBeInTheDocument()
    })
  })

  // ---------------------------------------------------------------------------
  // 1b. Combined balance is currency-normalized (regression: the $1M bug)
  // ---------------------------------------------------------------------------
  describe('Combined balance across currencies', () => {
    // $1,000 USD + 59,000 DOP (= $1,000 at 59/USD). The headline must be the
    // USD SUM ($2,000) — never the raw mixed-currency sum (60,000).
    const mixedAccounts = [
      {
        id: 'usd-chk', type: 'checking', name: 'USD Checking',
        beneficiaryName: 'Me', balance: 1000, currency: 'USD',
        balanceUsd: 1000, balanceChange: 0, balanceChangeUsd: 0,
      },
      {
        id: 'dop-chk', type: 'checking', name: 'DOP Checking',
        beneficiaryName: 'Me', balance: 59000, currency: 'DOP',
        balanceUsd: 1000, balanceChange: 0, balanceChangeUsd: 0,
      },
    ] as unknown as AccountsProps['accounts']

    it('sums balanceUsd, not raw native balances', () => {
      render(<AccountsView {...defaultProps} accounts={mixedAccounts} />)
      // Headline + the "Bank Accounts" category total both read $2,000.00.
      expect(screen.getAllByText('$2,000.00').length).toBeGreaterThan(0)
      // The raw mixed-currency sum (1000 + 59000) must never appear.
      expect(screen.queryByText('$60,000.00')).not.toBeInTheDocument()
    })
  })

  // ---------------------------------------------------------------------------
  // 2. Summary Card
  // ---------------------------------------------------------------------------
  describe('Summary Card', () => {
    it('displays the cash balance label', () => {
      render(<AccountsView {...defaultProps} />)
      expect(screen.getByText('Cash Balance (USD)')).toBeInTheDocument()
    })

    it('displays account type counts', () => {
      render(<AccountsView {...defaultProps} />)
      // "Bank Accounts", "Credit Cards", "Loans" appear in both summary pills and group headings
      expect(screen.getAllByText('Bank Accounts').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('Credit Cards').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('Loans').length).toBeGreaterThanOrEqual(1)
      // "Wallets" only appears in the summary card (group heading is "Wallet / Cash")
      expect(screen.getByText('Wallets')).toBeInTheDocument()
    })

    it('displays net worth change this month', () => {
      render(<AccountsView {...defaultProps} />)
      expect(screen.getByText(/Net worth/)).toBeInTheDocument()
    })
  })

  // ---------------------------------------------------------------------------
  // 3. Account Groups
  // ---------------------------------------------------------------------------
  describe('Account Groups', () => {
    it('groups checking and savings under Bank Accounts', () => {
      render(<AccountsView {...defaultProps} />)
      expect(screen.getByRole('heading', { level: 2, name: 'Bank Accounts' })).toBeInTheDocument()
    })

    it('shows Credit Cards group', () => {
      render(<AccountsView {...defaultProps} />)
      expect(screen.getByRole('heading', { level: 2, name: 'Credit Cards' })).toBeInTheDocument()
    })

    it('shows Loans group', () => {
      render(<AccountsView {...defaultProps} />)
      expect(screen.getByRole('heading', { level: 2, name: 'Loans' })).toBeInTheDocument()
    })

    it('shows Wallet / Cash group', () => {
      render(<AccountsView {...defaultProps} />)
      expect(screen.getByRole('heading', { level: 2, name: 'Wallet / Cash' })).toBeInTheDocument()
    })

    it('hides empty groups', () => {
      const propsWithOnlyChecking: AccountsProps = {
        ...defaultProps,
        accounts: sampleData.accounts.filter((a) => a.type === 'checking') as AccountsProps['accounts'],
      }
      render(<AccountsView {...propsWithOnlyChecking} />)
      expect(screen.queryByRole('heading', { level: 2, name: 'Credit Cards' })).not.toBeInTheDocument()
      expect(screen.queryByRole('heading', { level: 2, name: 'Loans' })).not.toBeInTheDocument()
      expect(screen.queryByRole('heading', { level: 2, name: 'Wallet / Cash' })).not.toBeInTheDocument()
    })
  })

  // ---------------------------------------------------------------------------
  // 4. Empty State
  // ---------------------------------------------------------------------------
  describe('Empty State', () => {
    it('shows "No accounts yet" message when accounts is empty', () => {
      render(<AccountsView {...defaultProps} accounts={[]} />)
      expect(screen.getByText('No accounts yet')).toBeInTheDocument()
    })

    it('shows "Add Your First Account" button when accounts is empty', () => {
      render(<AccountsView {...defaultProps} accounts={[]} />)
      expect(screen.getByText('Add Your First Account')).toBeInTheDocument()
    })

    it('does not show summary card when accounts is empty', () => {
      render(<AccountsView {...defaultProps} accounts={[]} />)
      expect(screen.queryByText('Cash Balance (USD)')).not.toBeInTheDocument()
    })
  })

  // ---------------------------------------------------------------------------
  // 5. Drawer Integration
  // ---------------------------------------------------------------------------
  describe('Drawer Integration', () => {
    it('calls onViewAccount when clicking an account card', async () => {
      const user = userEvent.setup()
      const onViewAccount = vi.fn()
      render(<AccountsView {...defaultProps} onViewAccount={onViewAccount} />)
      await user.click(screen.getByText('Daily Expenses'))
      expect(onViewAccount).toHaveBeenCalledWith('acc-001')
    })

    it('calls onCreateAccount when New Account button is clicked', async () => {
      const user = userEvent.setup()
      const onCreateAccount = vi.fn()
      render(<AccountsView {...defaultProps} onCreateAccount={onCreateAccount} />)
      await user.click(screen.getByRole('button', { name: /New Account/ }))
      expect(onCreateAccount).toHaveBeenCalledOnce()
    })
  })

  // ---------------------------------------------------------------------------
  // 6. Archive Toggle
  // ---------------------------------------------------------------------------
  describe('Archive Toggle', () => {
    it('renders the archive checkbox', () => {
      render(<AccountsView {...defaultProps} />)
      const checkbox = screen.getByLabelText('Show Archived')
      expect(checkbox).toBeInTheDocument()
    })

    it('calls onToggleArchived when checkbox is clicked', async () => {
      const user = userEvent.setup()
      const onToggleArchived = vi.fn()
      render(<AccountsView {...defaultProps} onToggleArchived={onToggleArchived} />)
      await user.click(screen.getByLabelText('Show Archived'))
      expect(onToggleArchived).toHaveBeenCalledOnce()
    })
  })
})
