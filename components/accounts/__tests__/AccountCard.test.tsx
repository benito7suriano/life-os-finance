import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AccountCard } from '../AccountCard'
import sampleData from '../sample-data.json'
import type { Account } from '../types'

const accounts = sampleData.accounts as Account[]

// Individual accounts from sample data
const checkingAccount = accounts.find((a) => a.id === 'acc-001')! // Daily Expenses, positive change
const checkingAccountNegativeChange = accounts.find((a) => a.id === 'acc-002')! // Family Account, negative change
const creditCardAccount = accounts.find((a) => a.id === 'acc-005')! // Visa Gold
const loanAccount = accounts.find((a) => a.id === 'acc-008')! // Car Loan
const walletAccount = accounts.find((a) => a.id === 'acc-009')! // Personal Wallet
const walletNoChange = accounts.find((a) => a.id === 'acc-010')! // Travel Cash, zero change

describe('AccountCard', () => {
  // ---------------------------------------------------------------------------
  // 1. Common Display
  // ---------------------------------------------------------------------------
  describe('Common Display', () => {
    it('renders the account name', () => {
      render(<AccountCard account={checkingAccount} />)
      expect(screen.getByText('Daily Expenses')).toBeInTheDocument()
    })

    it('renders the formatted balance', () => {
      render(<AccountCard account={checkingAccount} />)
      expect(screen.getByText('$2,847.50')).toBeInTheDocument()
    })

    it('calls onClick when card is clicked', async () => {
      const user = userEvent.setup()
      const onClick = vi.fn()
      render(<AccountCard account={checkingAccount} onClick={onClick} />)
      await user.click(screen.getByRole('button'))
      expect(onClick).toHaveBeenCalledOnce()
    })
  })

  // ---------------------------------------------------------------------------
  // 2. Balance Change Indicators
  // ---------------------------------------------------------------------------
  describe('Balance Change Indicators', () => {
    it('shows positive change with +prefix and good color', () => {
      render(<AccountCard account={checkingAccount} />)
      expect(screen.getByText('+$425.00')).toBeInTheDocument()
      const changeEl = screen.getByText('+$425.00')
      // Vault theme: positive change uses the --good token color
      expect(changeEl.style.color).toBe('var(--good)')
    })

    it('shows negative change with -prefix and bad color', () => {
      render(<AccountCard account={checkingAccountNegativeChange} />)
      expect(screen.getByText('-$340.25')).toBeInTheDocument()
      const changeEl = screen.getByText('-$340.25')
      // Vault theme: negative change uses the --bad token color
      expect(changeEl.style.color).toBe('var(--bad)')
    })

    it('shows "No change" for zero change', () => {
      render(<AccountCard account={walletNoChange} />)
      expect(screen.getByText('No change')).toBeInTheDocument()
    })
  })

  // ---------------------------------------------------------------------------
  // 3. Checking Account
  // ---------------------------------------------------------------------------
  describe('Checking Account', () => {
    it('shows the institution name', () => {
      render(<AccountCard account={checkingAccount} />)
      expect(screen.getByText('Banco Agrícola')).toBeInTheDocument()
    })

    it('shows positive balance', () => {
      render(<AccountCard account={checkingAccount} />)
      expect(screen.getByText('$2,847.50')).toBeInTheDocument()
    })
  })

  // ---------------------------------------------------------------------------
  // 4. Credit Card
  // ---------------------------------------------------------------------------
  describe('Credit Card', () => {
    it('shows last 4 digits', () => {
      render(<AccountCard account={creditCardAccount} />)
      expect(screen.getByText('••••4521')).toBeInTheDocument()
    })

    it('shows negative balance in rose color', () => {
      render(<AccountCard account={creditCardAccount} />)
      const balanceEl = screen.getByText(/-\$1,245.80/)
      expect(balanceEl.className).toContain('rose')
    })
  })

  // ---------------------------------------------------------------------------
  // 5. Loan Account
  // ---------------------------------------------------------------------------
  describe('Loan Account', () => {
    it('shows institution name', () => {
      render(<AccountCard account={loanAccount} />)
      expect(screen.getByText('BAC Credomatic')).toBeInTheDocument()
    })

    it('shows negative balance in rose color', () => {
      render(<AccountCard account={loanAccount} />)
      const balanceEl = screen.getByText(/-\$8,750.00/)
      expect(balanceEl.className).toContain('rose')
    })

    it('shows progress bar with correct percentage', () => {
      render(<AccountCard account={loanAccount} />)
      expect(screen.getByText('Paid off')).toBeInTheDocument()
      expect(screen.getByText('60%')).toBeInTheDocument()
    })
  })

  // ---------------------------------------------------------------------------
  // 6. Wallet Account
  // ---------------------------------------------------------------------------
  describe('Wallet Account', () => {
    it('shows "Cash" subtitle', () => {
      render(<AccountCard account={walletAccount} />)
      expect(screen.getByText('Cash')).toBeInTheDocument()
    })

    it('does not show institution name', () => {
      render(<AccountCard account={walletAccount} />)
      expect(screen.queryByText('Banco Agrícola')).not.toBeInTheDocument()
      expect(screen.queryByText('Banco Cuscatlán')).not.toBeInTheDocument()
      expect(screen.queryByText('BAC Credomatic')).not.toBeInTheDocument()
      expect(screen.queryByText('Davivienda')).not.toBeInTheDocument()
    })
  })
})
