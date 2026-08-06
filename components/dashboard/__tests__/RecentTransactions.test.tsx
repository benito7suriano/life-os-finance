import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RecentTransactions } from '../RecentTransactions'
import type { Transaction } from '../types'

const base = {
  description: '',
  merchant: undefined,
  category: { id: 'c1', name: 'Groceries', color: '#10b981' },
  account: { id: 'a1', name: 'Checking' },
  date: '2026-08-04',
  time: '',
}

describe('RecentTransactions currency + transfer rendering', () => {
  it('renders native currency instead of a hardcoded dollar sign', () => {
    const transactions: Transaction[] = [
      { ...base, id: 't1', type: 'expense', amount: 1500, currency: 'DOP', description: 'Supermercado' },
      { ...base, id: 't2', type: 'income', amount: 45.32, currency: 'USD', description: 'Refund' },
    ]
    render(<RecentTransactions transactions={transactions} />)
    // DOP renders with the DOP symbol, not "$1,500.00"
    expect(screen.getByText(/−DOP\s*1,500\.00/)).toBeInTheDocument()
    expect(screen.getByText(/\+\$45\.32/)).toBeInTheDocument()
    expect(screen.queryByText('−$1,500.00')).not.toBeInTheDocument()
  })

  it('renders transfers neutrally with the cross-currency destination leg', () => {
    const transactions: Transaction[] = [
      {
        ...base,
        id: 't3',
        type: 'transfer',
        amount: 5900,
        currency: 'DOP',
        toAmount: 100,
        toCurrency: 'USD',
        description: 'Card payment',
        category: { id: '', name: 'Transfer', color: '#94a3b8' },
      },
    ]
    render(<RecentTransactions transactions={transactions} />)
    expect(screen.getByText(/DOP\s*5,900\.00/)).toBeInTheDocument()
    expect(screen.getByText(/→\s*\$100\.00/)).toBeInTheDocument()
    // No +/- sign on transfers
    expect(screen.queryByText(/[+−]DOP\s*5,900\.00/)).not.toBeInTheDocument()
  })
})
