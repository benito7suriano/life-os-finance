import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AccountDrawer } from '../AccountDrawer'
import sampleData from '../sample-data.json'
import type { Account, AccountDrawerProps, SavingsAccount } from '../types'

const accounts = sampleData.accounts as Account[]

const institutions = sampleData.institutions as AccountDrawerProps['institutions']
const creditCardProviders = sampleData.creditCardProviders as AccountDrawerProps['creditCardProviders']

// Individual accounts from sample data
const checkingAccount = accounts.find((a) => a.id === 'acc-001')! // Daily Expenses
const creditCardAccount = accounts.find((a) => a.id === 'acc-005')! // Visa Gold
const loanAccount = accounts.find((a) => a.id === 'acc-007')! // Home Mortgage
const walletAccount = accounts.find((a) => a.id === 'acc-009')! // Personal Wallet

const baseDrawerProps: AccountDrawerProps = {
  isOpen: true,
  onClose: vi.fn(),
  onSave: vi.fn(),
  onDelete: vi.fn(),
  onRestore: vi.fn(),
  institutions,
  creditCardProviders,
}

describe('AccountDrawer', () => {
  // ---------------------------------------------------------------------------
  // 1. Open / Close
  // ---------------------------------------------------------------------------
  describe('Open / Close', () => {
    it('renders when isOpen is true', () => {
      render(<AccountDrawer {...baseDrawerProps} isOpen={true} />)
      expect(screen.getByText('New Account')).toBeInTheDocument()
    })

    it('is hidden when isOpen is false', () => {
      const { container } = render(<AccountDrawer {...baseDrawerProps} isOpen={false} />)
      const drawer = container.querySelector('.translate-x-full')
      expect(drawer).toBeInTheDocument()
    })

    it('calls onClose when Cancel button is clicked', async () => {
      const user = userEvent.setup()
      const onClose = vi.fn()
      render(<AccountDrawer {...baseDrawerProps} onClose={onClose} />)
      await user.click(screen.getByText('Cancel'))
      expect(onClose).toHaveBeenCalledOnce()
    })
  })

  // ---------------------------------------------------------------------------
  // 2. Create vs Edit Mode
  // ---------------------------------------------------------------------------
  describe('Create vs Edit Mode', () => {
    it('shows "New Account" title in create mode', () => {
      render(<AccountDrawer {...baseDrawerProps} />)
      expect(screen.getByText('New Account')).toBeInTheDocument()
    })

    it('shows "Edit Checking Account" title in edit mode for checking', () => {
      render(<AccountDrawer {...baseDrawerProps} account={checkingAccount} />)
      expect(screen.getByText('Edit Checking Account')).toBeInTheDocument()
    })

    it('shows "Edit Credit Card" title in edit mode for credit card', () => {
      render(<AccountDrawer {...baseDrawerProps} account={creditCardAccount} />)
      expect(screen.getByText('Edit Credit Card')).toBeInTheDocument()
    })

    it('shows "Edit Loan" title in edit mode for loan', () => {
      render(<AccountDrawer {...baseDrawerProps} account={loanAccount} />)
      expect(screen.getByText('Edit Loan')).toBeInTheDocument()
    })

    it('shows type selector only in create mode', () => {
      render(<AccountDrawer {...baseDrawerProps} />)
      expect(screen.getByText('Account Type')).toBeInTheDocument()
    })

    it('hides type selector in edit mode', () => {
      render(<AccountDrawer {...baseDrawerProps} account={checkingAccount} />)
      expect(screen.queryByText('Account Type')).not.toBeInTheDocument()
    })

    it('shows "Create Account" button in create mode', () => {
      render(<AccountDrawer {...baseDrawerProps} />)
      expect(screen.getByText('Create Account')).toBeInTheDocument()
    })

    it('shows "Save Changes" button in edit mode', () => {
      render(<AccountDrawer {...baseDrawerProps} account={checkingAccount} />)
      expect(screen.getByText('Save Changes')).toBeInTheDocument()
    })
  })

  // ---------------------------------------------------------------------------
  // 3. Type-Specific Fields
  // ---------------------------------------------------------------------------
  describe('Type-Specific Fields', () => {
    it('shows checking-specific fields: beneficiary, balance, currency, institution, debit card', () => {
      render(<AccountDrawer {...baseDrawerProps} account={checkingAccount} />)
      expect(screen.getByText('Beneficiary Name')).toBeInTheDocument()
      expect(screen.getByText('Balance')).toBeInTheDocument()
      expect(screen.getByText('Currency')).toBeInTheDocument()
      expect(screen.getByText('Institution (optional)')).toBeInTheDocument()
      expect(screen.getByText('Has debit card')).toBeInTheDocument()
    })

    it('shows credit card-specific fields: provider, institution, last4, expiration, balance, limit, cutoff, payment, interest', () => {
      render(<AccountDrawer {...baseDrawerProps} account={creditCardAccount} />)
      expect(screen.getByText('Card Provider')).toBeInTheDocument()
      expect(screen.getByText('Institution')).toBeInTheDocument()
      expect(screen.getByText('Last 4 Digits')).toBeInTheDocument()
      expect(screen.getByText('Expiration Date')).toBeInTheDocument()
      expect(screen.getByText('Current Balance')).toBeInTheDocument()
      expect(screen.getByText('Credit Limit')).toBeInTheDocument()
      expect(screen.getByText('Cutoff Day')).toBeInTheDocument()
      expect(screen.getByText('Payment Day')).toBeInTheDocument()
      expect(screen.getByText('Interest %')).toBeInTheDocument()
    })

    it('shows loan-specific fields: institution, original, owed, interest, term, payment, frequency, dates', () => {
      render(<AccountDrawer {...baseDrawerProps} account={loanAccount} />)
      expect(screen.getByText('Institution (optional)')).toBeInTheDocument()
      expect(screen.getByText('Original Amount')).toBeInTheDocument()
      expect(screen.getByText('Amount Owed')).toBeInTheDocument()
      expect(screen.getByText('Interest Rate %')).toBeInTheDocument()
      expect(screen.getByText('Term (months)')).toBeInTheDocument()
      expect(screen.getByText('Payment Amount')).toBeInTheDocument()
      expect(screen.getByText('Frequency')).toBeInTheDocument()
      expect(screen.getByText('Origination Date')).toBeInTheDocument()
      expect(screen.getByText('Maturity Date')).toBeInTheDocument()
    })

    it('shows wallet-specific fields: balance, currency, icon', () => {
      render(<AccountDrawer {...baseDrawerProps} account={walletAccount} />)
      expect(screen.getByText('Balance')).toBeInTheDocument()
      expect(screen.getByText('Currency')).toBeInTheDocument()
      expect(screen.getByText('Icon')).toBeInTheDocument()
    })
  })

  // ---------------------------------------------------------------------------
  // 4. Delete
  // ---------------------------------------------------------------------------
  describe('Delete', () => {
    it('shows delete button in edit mode', () => {
      render(<AccountDrawer {...baseDrawerProps} account={checkingAccount} />)
      expect(screen.getByText('Delete')).toBeInTheDocument()
    })

    it('calls onDelete when delete button is clicked', async () => {
      const user = userEvent.setup()
      const onDelete = vi.fn()
      render(<AccountDrawer {...baseDrawerProps} account={checkingAccount} onDelete={onDelete} />)
      await user.click(screen.getByText('Delete'))
      expect(onDelete).toHaveBeenCalledWith('acc-001')
    })

    it('does not show delete button in create mode', () => {
      render(<AccountDrawer {...baseDrawerProps} />)
      expect(screen.queryByText('Delete')).not.toBeInTheDocument()
    })
  })

  // ---------------------------------------------------------------------------
  // 5. Restore
  // ---------------------------------------------------------------------------
  describe('Restore', () => {
    it('shows restore button for archived accounts', () => {
      const archivedAccount: Account = {
        ...checkingAccount,
        deletedAt: '2026-01-15T00:00:00Z',
      }
      render(<AccountDrawer {...baseDrawerProps} account={archivedAccount} />)
      expect(screen.getByText('Restore')).toBeInTheDocument()
    })

    it('calls onRestore when restore button is clicked', async () => {
      const user = userEvent.setup()
      const onRestore = vi.fn()
      const archivedAccount: Account = {
        ...checkingAccount,
        deletedAt: '2026-01-15T00:00:00Z',
      }
      render(<AccountDrawer {...baseDrawerProps} account={archivedAccount} onRestore={onRestore} />)
      await user.click(screen.getByText('Restore'))
      expect(onRestore).toHaveBeenCalledWith('acc-001')
    })

    it('does not show delete button for archived accounts', () => {
      const archivedAccount: Account = {
        ...checkingAccount,
        deletedAt: '2026-01-15T00:00:00Z',
      }
      render(<AccountDrawer {...baseDrawerProps} account={archivedAccount} />)
      expect(screen.queryByText('Delete')).not.toBeInTheDocument()
    })
  })

  // ---------------------------------------------------------------------------
  // 6. Linked Goals
  // ---------------------------------------------------------------------------
  describe('Linked Goals', () => {
    it('shows goals section for savings accounts with linked goals', () => {
      const savingsWithGoals: SavingsAccount = {
        id: 'acc-003',
        type: 'savings',
        name: 'Emergency Fund',
        beneficiaryName: 'Carlos Mendoza',
        institutionId: 'inst-001',
        institutionName: 'Banco Agrícola',
        accountNumber: '5555666677',
        balance: 15000.00,
        currency: 'USD',
        interestRate: 2.5,
        balanceChange: 500.00,
        linkedGoals: [
          {
            id: 'goal-001',
            name: 'Emergency Reserve',
            currentBalance: 8000,
            targetAmount: 10000,
            targetDate: '2026-12-31',
            status: 'active',
          },
          {
            id: 'goal-002',
            name: 'New Laptop',
            currentBalance: 1200,
            targetAmount: 2000,
            targetDate: '2026-06-30',
            status: 'active',
          },
        ],
        unallocatedBalance: 5800,
      }
      render(<AccountDrawer {...baseDrawerProps} account={savingsWithGoals} />)
      expect(screen.getByText('Linked Goals')).toBeInTheDocument()
      expect(screen.getByText('Emergency Reserve')).toBeInTheDocument()
      expect(screen.getByText('New Laptop')).toBeInTheDocument()
    })

    it('shows unallocated balance as personal savings', () => {
      const savingsWithGoals: SavingsAccount = {
        id: 'acc-003',
        type: 'savings',
        name: 'Emergency Fund',
        beneficiaryName: 'Carlos Mendoza',
        institutionId: 'inst-001',
        institutionName: 'Banco Agrícola',
        accountNumber: '5555666677',
        balance: 15000.00,
        currency: 'USD',
        interestRate: 2.5,
        balanceChange: 500.00,
        linkedGoals: [
          {
            id: 'goal-001',
            name: 'Emergency Reserve',
            currentBalance: 8000,
            targetAmount: 10000,
            targetDate: '2026-12-31',
            status: 'active',
          },
        ],
        unallocatedBalance: 7000,
      }
      render(<AccountDrawer {...baseDrawerProps} account={savingsWithGoals} />)
      expect(screen.getByText('Personal savings')).toBeInTheDocument()
      expect(screen.getByText('$7,000.00')).toBeInTheDocument()
    })

    it('does not show goals section for savings without linked goals', () => {
      const savingsAccount = accounts.find((a) => a.id === 'acc-003')!
      render(<AccountDrawer {...baseDrawerProps} account={savingsAccount} />)
      expect(screen.queryByText('Linked Goals')).not.toBeInTheDocument()
    })
  })
})
