import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TransactionModal } from '../TransactionModal'
import { DeleteConfirmDialog } from '../DeleteConfirmDialog'
import sampleData from '../sample-data.json'
import type { TransactionModalProps, DeleteConfirmDialogProps, Transaction } from '../types'

const defaultModalProps: TransactionModalProps = {
  isOpen: true,
  onClose: vi.fn(),
  onSave: vi.fn(),
  categories: sampleData.categories as TransactionModalProps['categories'],
  accounts: sampleData.accounts as TransactionModalProps['accounts'],
  goalsByAccount: sampleData.goalsByAccount as TransactionModalProps['goalsByAccount'],
}

const sampleEditTransaction: Transaction = {
  id: 'txn-002',
  date: '2026-01-21',
  description: 'Super Selectos groceries',
  categoryId: 'cat-003',
  accountId: 'acc-003',
  amount: -87.45,
  currency: 'USD',
  amountUsd: -87.45,
  type: 'expense',
  source: 'telegram',
}

describe('TransactionModal', () => {
  // ---------------------------------------------------------------------------
  // 1. Modal Open/Close
  // ---------------------------------------------------------------------------
  describe('Open/Close Behavior', () => {
    it('renders when isOpen is true', () => {
      render(<TransactionModal {...defaultModalProps} />)
      expect(screen.getByText('New Transaction')).toBeInTheDocument()
    })

    it('does not render when isOpen is false', () => {
      render(<TransactionModal {...defaultModalProps} isOpen={false} />)
      expect(screen.queryByText('New Transaction')).not.toBeInTheDocument()
    })

    it('calls onClose when Cancel button is clicked', async () => {
      const user = userEvent.setup()
      const onClose = vi.fn()
      render(<TransactionModal {...defaultModalProps} onClose={onClose} />)
      await user.click(screen.getByText('Cancel'))
      expect(onClose).toHaveBeenCalledOnce()
    })
  })

  // ---------------------------------------------------------------------------
  // 2. Create vs Edit Mode
  // ---------------------------------------------------------------------------
  describe('Create vs Edit Mode', () => {
    it('shows "New Transaction" title in create mode', () => {
      render(<TransactionModal {...defaultModalProps} />)
      expect(screen.getByText('New Transaction')).toBeInTheDocument()
    })

    it('shows "Edit Transaction" title in edit mode', () => {
      render(
        <TransactionModal
          {...defaultModalProps}
          editTransaction={sampleEditTransaction}
        />
      )
      expect(screen.getByText('Edit Transaction')).toBeInTheDocument()
    })

    it('pre-populates fields in edit mode', () => {
      render(
        <TransactionModal
          {...defaultModalProps}
          editTransaction={sampleEditTransaction}
        />
      )
      const descriptionInput = screen.getByLabelText('Description') as HTMLInputElement
      expect(descriptionInput.value).toBe('Super Selectos groceries')
      const amountInput = screen.getByLabelText('Amount') as HTMLInputElement
      expect(amountInput.value).toBe('87.45')
    })

    it('shows "Save Changes" button in edit mode', () => {
      render(
        <TransactionModal
          {...defaultModalProps}
          editTransaction={sampleEditTransaction}
        />
      )
      expect(screen.getByText('Save Changes')).toBeInTheDocument()
    })

    it('shows "Create Transaction" button in create mode', () => {
      render(<TransactionModal {...defaultModalProps} />)
      expect(screen.getByText('Create Transaction')).toBeInTheDocument()
    })
  })

  // ---------------------------------------------------------------------------
  // 3. Type Tabs
  // ---------------------------------------------------------------------------
  describe('Type Tabs', () => {
    it('renders Expense, Income, and Transfer tabs', () => {
      render(<TransactionModal {...defaultModalProps} />)
      expect(screen.getByText('Expense')).toBeInTheDocument()
      expect(screen.getByText('Income')).toBeInTheDocument()
      expect(screen.getByText('Transfer')).toBeInTheDocument()
    })

    it('defaults to Expense tab', () => {
      render(<TransactionModal {...defaultModalProps} />)
      const expenseTab = screen.getByText('Expense')
      // Active tab is indicated by the accent color (Vault theme)
      expect(expenseTab.closest('button')?.style.color).toBe('var(--accent-a)')
    })

    it('switches to Income tab when clicked', async () => {
      const user = userEvent.setup()
      render(<TransactionModal {...defaultModalProps} />)
      await user.click(screen.getByText('Income'))
      // Should show income categories
      const incomeTab = screen.getByText('Income')
      expect(incomeTab.closest('button')?.style.color).toBe('var(--accent-a)')
    })

    it('shows account fields when in Transfer tab', async () => {
      const user = userEvent.setup()
      render(<TransactionModal {...defaultModalProps} />)
      await user.click(screen.getByText('Transfer'))
      expect(screen.getByLabelText('From Account')).toBeInTheDocument()
      expect(screen.getByLabelText('To Account')).toBeInTheDocument()
    })

    it('shows category and single account for Expense tab', () => {
      render(<TransactionModal {...defaultModalProps} />)
      expect(screen.getByLabelText('Category')).toBeInTheDocument()
      expect(screen.getByLabelText('Account')).toBeInTheDocument()
    })
  })

  // ---------------------------------------------------------------------------
  // 4. Form Validation
  // ---------------------------------------------------------------------------
  describe('Form Validation', () => {
    it('does not call onSave when required fields are empty', async () => {
      const user = userEvent.setup()
      const onSave = vi.fn()
      render(<TransactionModal {...defaultModalProps} onSave={onSave} />)
      await user.click(screen.getByText('Create Transaction'))
      expect(onSave).not.toHaveBeenCalled()
    })

    it('shows validation errors for empty required fields', async () => {
      const user = userEvent.setup()
      render(<TransactionModal {...defaultModalProps} />)
      await user.click(screen.getByText('Create Transaction'))
      expect(screen.getByText('Description is required')).toBeInTheDocument()
    })

    it('shows validation error for zero amount', async () => {
      const user = userEvent.setup()
      render(<TransactionModal {...defaultModalProps} />)
      await user.type(screen.getByLabelText('Description'), 'Test transaction')
      await user.clear(screen.getByLabelText('Amount'))
      await user.type(screen.getByLabelText('Amount'), '0')
      await user.click(screen.getByText('Create Transaction'))
      expect(screen.getByText('Amount must be greater than 0')).toBeInTheDocument()
    })
  })

  // ---------------------------------------------------------------------------
  // 5. Transfer Goal Allocation
  // ---------------------------------------------------------------------------
  describe('Transfer Goal Allocation', () => {
    it('shows goal allocation toggle when to-account is savings with goals', async () => {
      const user = userEvent.setup()
      render(<TransactionModal {...defaultModalProps} />)
      await user.click(screen.getByText('Transfer'))

      // Select from account
      const fromSelect = screen.getByLabelText('From Account')
      await user.selectOptions(fromSelect, 'acc-001')

      // Select savings account (acc-002) as to-account
      const toSelect = screen.getByLabelText('To Account')
      await user.selectOptions(toSelect, 'acc-002')

      expect(screen.getByText('Contribute to goals')).toBeInTheDocument()
    })

    it('shows proportional/manual toggle when contribute to goals is enabled', async () => {
      const user = userEvent.setup()
      render(<TransactionModal {...defaultModalProps} />)
      await user.click(screen.getByText('Transfer'))

      const fromSelect = screen.getByLabelText('From Account')
      await user.selectOptions(fromSelect, 'acc-001')

      const toSelect = screen.getByLabelText('To Account')
      await user.selectOptions(toSelect, 'acc-002')

      // Toggle on contribute to goals
      await user.click(screen.getByText('Contribute to goals'))

      expect(screen.getByText('Proportional')).toBeInTheDocument()
      expect(screen.getByText('Manual')).toBeInTheDocument()
    })

    it('shows goal names when allocation is enabled', async () => {
      const user = userEvent.setup()
      render(<TransactionModal {...defaultModalProps} />)
      await user.click(screen.getByText('Transfer'))

      const fromSelect = screen.getByLabelText('From Account')
      await user.selectOptions(fromSelect, 'acc-001')

      const toSelect = screen.getByLabelText('To Account')
      await user.selectOptions(toSelect, 'acc-002')

      await user.click(screen.getByText('Contribute to goals'))

      expect(screen.getByText('Emergency Fund')).toBeInTheDocument()
      expect(screen.getByText('Vacation Fund')).toBeInTheDocument()
    })
  })

  // ---------------------------------------------------------------------------
  // 6. Save Callback
  // ---------------------------------------------------------------------------
  describe('Save Callback', () => {
    it('calls onSave with form data when all fields are valid', async () => {
      const user = userEvent.setup()
      const onSave = vi.fn()
      render(<TransactionModal {...defaultModalProps} onSave={onSave} />)

      await user.type(screen.getByLabelText('Description'), 'Test expense')
      await user.clear(screen.getByLabelText('Amount'))
      await user.type(screen.getByLabelText('Amount'), '50')

      // Select category
      const categorySelect = screen.getByLabelText('Category')
      await user.selectOptions(categorySelect, 'cat-003')

      // Select account
      const accountSelect = screen.getByLabelText('Account')
      await user.selectOptions(accountSelect, 'acc-001')

      await user.click(screen.getByText('Create Transaction'))
      expect(onSave).toHaveBeenCalledOnce()
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'expense',
          description: 'Test expense',
          amount: 50,
          categoryId: 'cat-003',
          accountId: 'acc-001',
        })
      )
    })
  })
})

// =============================================================================
// DeleteConfirmDialog
// =============================================================================

describe('DeleteConfirmDialog', () => {
  const defaultDeleteProps: DeleteConfirmDialogProps = {
    isOpen: true,
    onClose: vi.fn(),
    onConfirm: vi.fn(),
    transactionDescription: 'Super Selectos groceries',
  }

  it('renders when isOpen is true', () => {
    render(<DeleteConfirmDialog {...defaultDeleteProps} />)
    expect(screen.getByText('Delete Transaction')).toBeInTheDocument()
  })

  it('does not render when isOpen is false', () => {
    render(<DeleteConfirmDialog {...defaultDeleteProps} isOpen={false} />)
    expect(screen.queryByText('Delete Transaction')).not.toBeInTheDocument()
  })

  it('shows the transaction description', () => {
    render(<DeleteConfirmDialog {...defaultDeleteProps} />)
    expect(screen.getByText(/Super Selectos groceries/)).toBeInTheDocument()
  })

  it('shows warning text', () => {
    render(<DeleteConfirmDialog {...defaultDeleteProps} />)
    expect(screen.getByText('This action cannot be undone.')).toBeInTheDocument()
  })

  it('calls onClose when Cancel is clicked', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<DeleteConfirmDialog {...defaultDeleteProps} onClose={onClose} />)
    await user.click(screen.getByText('Cancel'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls onConfirm when Delete is clicked', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(<DeleteConfirmDialog {...defaultDeleteProps} onConfirm={onConfirm} />)
    await user.click(screen.getByText('Delete'))
    expect(onConfirm).toHaveBeenCalledOnce()
  })
})
