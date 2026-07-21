import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AccountsMini } from '../AccountsMini'
import { NetWorthHero } from '../NetWorthHero'
import type { Account, Summary } from '../types'

// A USD account and a DOP account whose native balance (59,000) is worth
// exactly $1,000. The bug was aggregating native `balance`, which summed
// 1,000 + 59,000 = 60,000 and reported it as USD.
const accounts: Account[] = [
  { id: '1', name: 'US Checking', type: 'checking', balance: 1000, balanceUsd: 1000, currency: 'USD', icon: 'wallet' },
  { id: '2', name: 'Peso Ahorros', type: 'savings', balance: 59000, balanceUsd: 1000, currency: 'DOP', icon: 'wallet' },
]

const summary: Summary = {
  netWorth: { amount: 2000, previousAmount: 0, change: 0, changePercent: 0, trend: 'stable' },
  monthlyExpenses: { amount: 0, previousMonth: 0, change: 0, changePercent: 0 },
  monthlyIncome: { amount: 0, previousMonth: 0, change: 0, changePercent: 0 },
  budgetProjection: { totalBudget: 0, spent: 0, remaining: 0, percentUsed: 0, daysRemaining: 0, projectedOverspend: 0, status: 'on_track' },
}

describe('dashboard currency aggregation', () => {
  it('sums the combined balance in USD, not native amounts', () => {
    render(<AccountsMini accounts={accounts} />)
    // $2,000.00 (USD-normalized), NOT $60,000.00 (naive native sum)
    expect(screen.getByText('$2,000.00')).toBeInTheDocument()
    expect(screen.queryByText('$60,000.00')).not.toBeInTheDocument()
  })

  it('shows each account balance in its native currency', () => {
    render(<AccountsMini accounts={accounts} />)
    expect(screen.getByText('$1,000.00')).toBeInTheDocument()
    // DOP account renders in DOP (symbol varies by ICU: "RD$" or "DOP "),
    // never as a bare "$" — the whole point of native display.
    const dop = screen.getByText(/\bDOP\b|RD\$/)
    expect(dop.textContent).toContain('59,000.00')
  })

  it('computes net-worth assets in USD across currencies', () => {
    render(<NetWorthHero summary={summary} accounts={accounts} trend={[]} />)
    // assets = $1,000 + $1,000 = $2,000.00, across 2 accounts
    expect(screen.getByText('$2,000.00')).toBeInTheDocument()
    expect(screen.getByText('2 accounts')).toBeInTheDocument()
  })
})
