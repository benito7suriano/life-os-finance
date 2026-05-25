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
  // 1b. Multi-currency display (native primary, USD secondary)
  // ---------------------------------------------------------------------------
  describe('Multi-currency display', () => {
    // A DOP account: native balance is what the user sees on their bank
    // statement; balanceUsd is precomputed at the API boundary (252822 / 59).
    const dopAccount = {
      ...checkingAccount,
      id: 'acc-dop',
      name: 'Banco Popular DOP',
      balance: 252822,
      currency: 'DOP',
      balanceUsd: 4285.12,
      balanceChange: 0,
      balanceChangeUsd: 0,
    } as Account

    it('renders the native DOP balance, currency-labeled (not a bare $)', () => {
      render(<AccountCard account={dopAccount} />)
      // ICU may render "RD$252,822.00" or "DOP 252,822.00" depending on runtime.
      expect(screen.getByText(/(RD\$|DOP\s)252,822\.00/)).toBeInTheDocument()
    })

    it('renders the USD equivalent as a secondary line', () => {
      render(<AccountCard account={dopAccount} />)
      expect(screen.getByText('≈ $4,285.12')).toBeInTheDocument()
    })

    it('does NOT show a USD secondary line for USD accounts', () => {
      render(<AccountCard account={checkingAccount} />)
      expect(screen.queryByText(/^≈/)).not.toBeInTheDocument()
    })
  })

  // ---------------------------------------------------------------------------
  // 2. Balance Change Indicators
  // ---------------------------------------------------------------------------
  describe('Balance Change Indicators', () => {
    it('shows positive change with +prefix and emerald color', () => {
      render(<AccountCard account={checkingAccount} />)
      expect(screen.getByText('+$425.00')).toBeInTheDocument()
      const changeEl = screen.getByText('+$425.00')
      expect(changeEl.className).toContain('emerald')
    })

    it('shows negative change with -prefix and rose color', () => {
      render(<AccountCard account={checkingAccountNegativeChange} />)
      expect(screen.getByText('-$340.25')).toBeInTheDocument()
      const changeEl = screen.getByText('-$340.25')
      expect(changeEl.className).toContain('rose')
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
      // Negative balances use accounting notation: ($1,245.80), not -$1,245.80.
      const balanceEl = screen.getByText(/\(\$1,245.80\)/)
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
      // Negative balances use accounting notation: ($8,750.00), not -$8,750.00.
      const balanceEl = screen.getByText(/\(\$8,750.00\)/)
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
