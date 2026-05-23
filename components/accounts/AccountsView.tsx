'use client'

import { useState } from 'react'
import type {
  Account,
  AccountsProps,
  AccountType,
} from './types'
import { AccountCard } from './AccountCard'
import { AccountDrawer } from './AccountDrawer'
import { toUsd, formatCurrency } from '@/lib/fx'
import {
  Plus,
  Landmark,
  CreditCard,
  Building2,
  Wallet,
  TrendingUp,
  TrendingDown,
} from 'lucide-react'

type AccountCategory = {
  key: AccountType[]
  label: string
  icon: React.ElementType
}

// NOTE: `investment` accounts are intentionally NOT shown here — they remain in
// the database and will get a dedicated assets page later.
const categories: AccountCategory[] = [
  { key: ['checking', 'savings'], label: 'Bank Accounts', icon: Landmark },
  { key: ['credit_card'], label: 'Credit Cards', icon: CreditCard },
  { key: ['loan'], label: 'Loans', icon: Building2 },
  { key: ['wallet'], label: 'Wallet / Cash', icon: Wallet },
]

/** Account's native currency, defaulting to USD when absent (e.g. older rows). */
function accountCurrency(account: Account): string {
  return 'currency' in account && account.currency ? account.currency : 'USD'
}

/** Sum a set of accounts in USD, converting each from its native currency. */
function sumUsd(accounts: Account[]): number {
  return accounts.reduce((sum, acc) => sum + toUsd(Number(acc.balance), accountCurrency(acc)), 0)
}

function groupAccountsByCategory(accounts: Account[]): Map<string, Account[]> {
  const grouped = new Map<string, Account[]>()

  for (const category of categories) {
    const categoryAccounts = accounts.filter((acc) =>
      category.key.includes(acc.type)
    )
    if (categoryAccounts.length > 0) {
      grouped.set(category.label, categoryAccounts)
    }
  }

  return grouped
}

function countAccountsByType(accounts: Account[]): { label: string; count: number }[] {
  const counts: { label: string; count: number }[] = []

  const bankAccounts = accounts.filter(
    (acc) => acc.type === 'checking' || acc.type === 'savings'
  ).length
  const creditCards = accounts.filter((acc) => acc.type === 'credit_card').length
  const loans = accounts.filter((acc) => acc.type === 'loan').length
  const wallets = accounts.filter((acc) => acc.type === 'wallet').length

  if (bankAccounts > 0) counts.push({ label: 'Bank Accounts', count: bankAccounts })
  if (creditCards > 0) counts.push({ label: 'Credit Cards', count: creditCards })
  if (loans > 0) counts.push({ label: 'Loans', count: loans })
  if (wallets > 0) counts.push({ label: 'Wallets', count: wallets })

  return counts
}

export function AccountsView({
  accounts,
  institutions,
  creditCardProviders,
  onViewAccount,
  onEditAccount,
  onDeleteAccount,
  onCreateAccount,
  onSave,
  showArchived,
  onToggleArchived,
  onRestoreAccount,
}: AccountsProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [selectedAccount, setSelectedAccount] = useState<Account | undefined>()

  const groupedAccounts = groupAccountsByCategory(accounts)
  // Headline = cash-only (bank + wallet − credit/loan), USD-converted.
  // Investment accounts are excluded from the Accounts page entirely (kept in DB
  // for a future dedicated assets page).
  const cashAccounts = accounts.filter((acc) => acc.type !== 'investment')
  const cashTotalUsd = sumUsd(cashAccounts)
  const accountCounts = countAccountsByType(accounts)
  const netWorthChange = accounts.reduce((sum, acc) => sum + acc.balanceChange, 0)

  const handleCardClick = (account: Account) => {
    setSelectedAccount(account)
    setIsDrawerOpen(true)
    onViewAccount?.(account.id)
  }

  const handleCreateClick = () => {
    setSelectedAccount(undefined)
    setIsDrawerOpen(true)
    onCreateAccount?.()
  }

  const handleDrawerClose = () => {
    setIsDrawerOpen(false)
    setSelectedAccount(undefined)
  }

  const handleSave = (data: Partial<Account>) => {
    onSave?.(data)
    handleDrawerClose()
  }

  const handleDelete = (id: string) => {
    onDeleteAccount?.(id)
    handleDrawerClose()
  }

  const handleRestore = (id: string) => {
    onRestoreAccount?.(id)
    handleDrawerClose()
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Accounts
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Manage your financial accounts
          </p>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={showArchived || false}
              onChange={() => onToggleArchived?.()}
              className="w-4 h-4 rounded border-slate-300 text-emerald-600
                         focus:ring-emerald-500 dark:border-slate-600 dark:bg-slate-800"
            />
            Show Archived
          </label>
          <button
            onClick={handleCreateClick}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5
                       bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg
                       shadow-sm shadow-emerald-600/20 hover:shadow-emerald-600/30
                       transition-all duration-200
                       focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2
                       dark:focus:ring-offset-slate-900"
          >
            <Plus className="w-5 h-5" />
            New Account
          </button>
        </div>
      </div>

      {/* Summary Card */}
      {accounts.length > 0 && (
        <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-2xl p-6 mb-8
                        shadow-lg shadow-emerald-600/20">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <p className="text-emerald-100 text-sm font-medium mb-1">
                Cash Balance (USD)
              </p>
              <p className="text-3xl md:text-4xl font-bold text-white tracking-tight">
                {formatCurrency(cashTotalUsd, 'USD', { accounting: true })}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              {accountCounts.map(({ label, count }) => (
                <div
                  key={label}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full
                             bg-white/10 backdrop-blur-sm"
                >
                  <span className="text-emerald-100 text-sm">{label}</span>
                  <span className="text-white font-semibold">{count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Net Worth Trend */}
          <div className="flex items-center gap-2 mt-4 pt-4 border-t border-emerald-500/30">
            {netWorthChange >= 0 ? (
              <TrendingUp className="w-4 h-4 text-emerald-200" />
            ) : (
              <TrendingDown className="w-4 h-4 text-emerald-200" />
            )}
            <span className="text-emerald-100 text-sm">
              Net worth {netWorthChange >= 0 ? 'up' : 'down'}{' '}
              <span className="text-white font-medium">
                {netWorthChange >= 0 ? '+' : ''}{formatCurrency(netWorthChange)}
              </span>{' '}
              this month
            </span>
          </div>
        </div>
      )}

      {/* Account Groups */}
      <div className="space-y-10">
        {categories.map((category) => {
          const categoryAccounts = groupedAccounts.get(category.label)
          if (!categoryAccounts || categoryAccounts.length === 0) return null

          const CategoryIcon = category.icon

          return (
            <section key={category.label}>
              {/* Category Header */}
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg
                                bg-slate-100 dark:bg-slate-800">
                  <CategoryIcon className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                </div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  {category.label}
                </h2>
                <span className="text-sm text-slate-400 dark:text-slate-500">
                  ({categoryAccounts.length})
                </span>
                <span className="ml-auto text-sm font-medium text-slate-500 dark:text-slate-400">
                  {formatCurrency(sumUsd(categoryAccounts), 'USD', { accounting: true })}
                </span>
              </div>

              {/* Account Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {categoryAccounts.map((account) => (
                  <AccountCard
                    key={account.id}
                    account={account}
                    onClick={() => handleCardClick(account)}
                  />
                ))}
              </div>
            </section>
          )
        })}
      </div>

      {/* Empty State */}
      {accounts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800
                          flex items-center justify-center mb-4">
            <Wallet className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
            No accounts yet
          </h3>
          <p className="text-slate-500 dark:text-slate-400 mb-6 max-w-sm">
            Add your bank accounts, credit cards, loans, and cash to start tracking your finances.
          </p>
          <button
            onClick={handleCreateClick}
            className="inline-flex items-center gap-2 px-4 py-2.5
                       bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg
                       transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add Your First Account
          </button>
        </div>
      )}

      {/* Account Drawer */}
      <AccountDrawer
        account={selectedAccount}
        isOpen={isDrawerOpen}
        onClose={handleDrawerClose}
        onSave={handleSave}
        onDelete={handleDelete}
        onRestore={handleRestore}
        institutions={institutions}
        creditCardProviders={creditCardProviders}
      />
    </div>
  )
}
