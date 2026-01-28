import type { Account } from '../types'
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

interface AccountCardProps {
  account: Account
  onClick?: () => void
}

const typeIcons = {
  checking: Landmark,
  savings: PiggyBank,
  credit_card: CreditCard,
  loan: Building2,
  wallet: Wallet,
}

function formatCurrency(amount: number): string {
  const absAmount = Math.abs(amount)
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(absAmount)
}

function formatBalanceChange(change: number): string {
  const prefix = change > 0 ? '+' : change < 0 ? '-' : ''
  return `${prefix}${formatCurrency(Math.abs(change))}`
}

function getInstitutionOrProvider(account: Account): string | null {
  switch (account.type) {
    case 'checking':
    case 'savings':
    case 'loan':
      return account.institutionName || null
    case 'credit_card':
      return account.institutionName || account.providerName
    case 'wallet':
      return null
  }
}

export function AccountCard({ account, onClick }: AccountCardProps) {
  const Icon = typeIcons[account.type]
  const institution = getInstitutionOrProvider(account)
  const isDebt = account.type === 'credit_card' || account.type === 'loan'
  const displayBalance = isDebt ? Math.abs(account.balance) : account.balance
  const balanceChange = account.balanceChange

  return (
    <button
      onClick={onClick}
      className="group relative w-full text-left bg-white dark:bg-slate-800 rounded-xl p-5
                 border border-slate-200 dark:border-slate-700
                 hover:border-emerald-300 dark:hover:border-emerald-600
                 hover:shadow-lg hover:shadow-emerald-500/5
                 transition-all duration-200 ease-out
                 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2
                 dark:focus:ring-offset-slate-900"
    >
      {/* Top row: Icon + Name + Institution */}
      <div className="flex items-start gap-3 mb-4">
        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-700
                        flex items-center justify-center
                        group-hover:bg-emerald-50 dark:group-hover:bg-emerald-900/30
                        transition-colors duration-200">
          <Icon className="w-5 h-5 text-slate-500 dark:text-slate-400
                          group-hover:text-emerald-600 dark:group-hover:text-emerald-400
                          transition-colors duration-200" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-slate-900 dark:text-white truncate">
            {account.name}
          </h3>
          {institution && (
            <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
              {institution}
            </p>
          )}
          {account.type === 'wallet' && (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Cash
            </p>
          )}
        </div>
      </div>

      {/* Balance */}
      <div className="mb-3">
        <p className={`text-2xl font-bold tracking-tight ${
          isDebt
            ? 'text-rose-600 dark:text-rose-400'
            : 'text-slate-900 dark:text-white'
        }`}>
          {isDebt && '-'}{formatCurrency(displayBalance)}
        </p>
      </div>

      {/* Balance change indicator */}
      <div className="flex items-center gap-1.5">
        {balanceChange > 0 ? (
          <>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
            <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
              {formatBalanceChange(balanceChange)}
            </span>
          </>
        ) : balanceChange < 0 ? (
          <>
            <TrendingDown className="w-4 h-4 text-rose-500" />
            <span className="text-sm font-medium text-rose-600 dark:text-rose-400">
              {formatBalanceChange(balanceChange)}
            </span>
          </>
        ) : (
          <>
            <Minus className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
              No change
            </span>
          </>
        )}
        <span className="text-sm text-slate-400 dark:text-slate-500">this month</span>
      </div>

      {/* Credit card specific: last 4 digits */}
      {account.type === 'credit_card' && (
        <div className="absolute top-5 right-5">
          <span className="text-xs font-mono text-slate-400 dark:text-slate-500">
            ••••{account.last4Digits}
          </span>
        </div>
      )}

      {/* Loan specific: progress indicator */}
      {account.type === 'loan' && (
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700">
          <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-1.5">
            <span>Paid off</span>
            <span>
              {Math.round(((account.originalAmount - Math.abs(account.balance)) / account.originalAmount) * 100)}%
            </span>
          </div>
          <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-500"
              style={{
                width: `${((account.originalAmount - Math.abs(account.balance)) / account.originalAmount) * 100}%`
              }}
            />
          </div>
        </div>
      )}
    </button>
  )
}
