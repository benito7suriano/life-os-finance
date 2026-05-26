'use client'

import { useState } from 'react'
import type { Account, AccountCardProps } from './types'
import { formatCurrency } from '@/lib/fx'
import {
  Building2,
  CreditCard,
  Landmark,
  TrendingUp,
  TrendingDown,
  Minus,
  Wallet,
  PiggyBank,
} from 'lucide-react'

const typeIcons = {
  checking: Landmark,
  savings: PiggyBank,
  credit_card: CreditCard,
  loan: Building2,
  wallet: Wallet,
  investment: TrendingUp,
}

function formatBalanceChange(change: number, currency: string = 'USD'): string {
  const prefix = change > 0 ? '+' : change < 0 ? '-' : ''
  return `${prefix}${formatCurrency(Math.abs(change), currency)}`
}

function getInstitutionOrProvider(account: Account): string | null {
  switch (account.type) {
    case 'checking':
    case 'savings':
    case 'loan':
    case 'investment':
      return account.institutionName || null
    case 'credit_card':
      return account.institutionName || account.providerName
    case 'wallet':
      return null
  }
}

function getAccountCurrency(account: Account): string {
  if ('currency' in account && account.currency) return account.currency
  return 'USD'
}

export function AccountCard({ account, onClick }: AccountCardProps) {
  const Icon = typeIcons[account.type]
  const institution = getInstitutionOrProvider(account)
  const isNegative = account.balance < 0
  const balanceChange = account.balanceChange
  const isArchived = !!account.deletedAt

  const changeColor = balanceChange > 0 ? 'var(--good)' : balanceChange < 0 ? 'var(--bad)' : 'var(--fg3)'
  const [hover, setHover] = useState(false)

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="w-full text-left"
      style={{
        position: 'relative',
        opacity: isArchived ? 0.6 : 1,
        background: 'var(--card-bg)',
        border: `1px solid ${hover ? 'var(--card-border-hi)' : 'var(--card-border)'}`,
        borderRadius: 'var(--card-radius)',
        padding: 20,
        boxShadow: 'var(--card-shadow)',
        cursor: 'pointer',
        transition: 'border-color .15s, transform .15s',
        transform: hover ? 'translateY(-1px)' : undefined,
      }}
    >
      {/* Archived badge */}
      {isArchived && (
        <div className="absolute right-3 top-3">
          <span
            className="rounded-full px-2 py-0.5"
            style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', background: 'rgba(255,255,255,0.06)', color: 'var(--fg3)' }}
          >
            Archived
          </span>
        </div>
      )}

      {/* Top row: Icon + Name + Institution */}
      <div className="mb-4 flex items-start gap-3">
        <div
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg"
          style={{ background: 'var(--accent-soft)', color: 'var(--accent-a)' }}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate" style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 600, color: 'var(--fg)' }}>
            {account.name}
          </h3>
          {institution && (
            <p className="truncate" style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--fg3)' }}>
              {institution}
            </p>
          )}
          {account.type === 'wallet' && <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--fg3)' }}>Cash</p>}
        </div>
      </div>

      {/* Balance */}
      <div className="mb-3">
        <p style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em', color: isNegative ? 'var(--bad)' : 'var(--fg)' }}>
          {formatCurrency(account.balance, getAccountCurrency(account), { accounting: true })}
        </p>
      </div>

      {/* Balance change indicator */}
      <div className="flex items-center gap-1.5">
        {balanceChange > 0 ? (
          <TrendingUp className="h-4 w-4" style={{ color: 'var(--good)' }} />
        ) : balanceChange < 0 ? (
          <TrendingDown className="h-4 w-4" style={{ color: 'var(--bad)' }} />
        ) : (
          <Minus className="h-4 w-4" style={{ color: 'var(--fg3)' }} />
        )}
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 500, color: changeColor }}>
          {balanceChange === 0 ? 'No change' : formatBalanceChange(balanceChange, getAccountCurrency(account))}
        </span>
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--fg4)' }}>this month</span>
      </div>

      {/* Credit card: last 4 digits */}
      {account.type === 'credit_card' && !isArchived && (
        <div className="absolute right-5 top-5">
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg3)' }}>••••{account.last4Digits}</span>
        </div>
      )}

      {/* Loan: progress */}
      {account.type === 'loan' && (
        <div className="mt-4 pt-3" style={{ borderTop: '1px solid var(--card-border)' }}>
          <div className="mb-1.5 flex justify-between" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg3)' }}>
            <span>Paid off</span>
            <span>{Math.round(((account.originalAmount - Math.abs(account.balance)) / account.originalAmount) * 100)}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div
              className="h-full rounded-full"
              style={{ width: `${((account.originalAmount - Math.abs(account.balance)) / account.originalAmount) * 100}%`, background: 'var(--accent-gradient)' }}
            />
          </div>
        </div>
      )}
    </button>
  )
}
