'use client'

import { useState } from 'react'
import type { Account, AccountsProps, AccountType } from './types'
import { AccountCard } from './AccountCard'
import { AccountDrawer } from './AccountDrawer'
import { toUsd, formatCurrency } from '@/lib/fx'
import { Card, Button } from '@/components/ui'
import { Plus, Landmark, CreditCard, Building2, Wallet, TrendingUp, TrendingDown } from 'lucide-react'

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

function accountCurrency(account: Account): string {
  return 'currency' in account && account.currency ? account.currency : 'USD'
}

function sumUsd(accounts: Account[]): number {
  return accounts.reduce((sum, acc) => sum + toUsd(Number(acc.balance), accountCurrency(acc)), 0)
}

function groupAccountsByCategory(accounts: Account[]): Map<string, Account[]> {
  const grouped = new Map<string, Account[]>()
  for (const category of categories) {
    const categoryAccounts = accounts.filter((acc) => category.key.includes(acc.type))
    if (categoryAccounts.length > 0) grouped.set(category.label, categoryAccounts)
  }
  return grouped
}

function countAccountsByType(accounts: Account[]): { label: string; count: number }[] {
  const counts: { label: string; count: number }[] = []
  const bankAccounts = accounts.filter((acc) => acc.type === 'checking' || acc.type === 'savings').length
  const creditCards = accounts.filter((acc) => acc.type === 'credit_card').length
  const loans = accounts.filter((acc) => acc.type === 'loan').length
  const wallets = accounts.filter((acc) => acc.type === 'wallet').length
  if (bankAccounts > 0) counts.push({ label: 'Bank Accounts', count: bankAccounts })
  if (creditCards > 0) counts.push({ label: 'Credit Cards', count: creditCards })
  if (loans > 0) counts.push({ label: 'Loans', count: loans })
  if (wallets > 0) counts.push({ label: 'Wallets', count: wallets })
  return counts
}

const eyebrow: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: 'var(--fg3)',
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
    <div className="mx-auto max-w-6xl p-4 md:p-6 lg:px-8 lg:py-6">
      {/* Page Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--fg)' }}>Accounts</h1>
          <p style={{ marginTop: 4, fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--fg3)' }}>Manage your financial accounts</p>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex cursor-pointer items-center gap-2" style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--fg2)' }}>
            <input
              type="checkbox"
              checked={showArchived || false}
              onChange={() => onToggleArchived?.()}
              className="h-4 w-4 rounded"
              style={{ accentColor: 'var(--accent-solid)' }}
            />
            Show Archived
          </label>
          <Button variant="primary" icon={Plus} onClick={handleCreateClick}>
            New Account
          </Button>
        </div>
      </div>

      {/* Summary hero */}
      {accounts.length > 0 && (
        <Card accent pad={24} style={{ marginBottom: 32, overflow: 'hidden' }}>
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <p style={eyebrow}>Cash Balance (USD)</p>
              <p style={{ marginTop: 8, fontFamily: 'var(--font-display)', fontSize: 36, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--fg)' }}>
                {formatCurrency(cashTotalUsd, 'USD', { accounting: true })}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {accountCounts.map(({ label, count }) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-2 rounded-full px-3 py-1.5"
                  style={{ background: 'rgba(255,255,255,0.06)', fontFamily: 'var(--font-sans)', fontSize: 12 }}
                >
                  <span style={{ color: 'var(--fg2)' }}>{label}</span>
                  <span style={{ color: 'var(--fg)', fontWeight: 600 }}>{count}</span>
                </span>
              ))}
            </div>
          </div>

          {/* Net worth trend */}
          <div className="mt-4 flex items-center gap-2 pt-4" style={{ borderTop: '1px solid var(--card-border)' }}>
            {netWorthChange >= 0 ? <TrendingUp className="h-4 w-4" style={{ color: 'var(--good)' }} /> : <TrendingDown className="h-4 w-4" style={{ color: 'var(--bad)' }} />}
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--fg2)' }}>
              Net worth {netWorthChange >= 0 ? 'up' : 'down'}{' '}
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 500, color: netWorthChange >= 0 ? 'var(--good)' : 'var(--bad)' }}>
                {netWorthChange >= 0 ? '+' : ''}
                {formatCurrency(netWorthChange)}
              </span>{' '}
              this month
            </span>
          </div>
        </Card>
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
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--fg2)' }}>
                  <CategoryIcon className="h-4 w-4" />
                </div>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600, color: 'var(--fg)' }}>{category.label}</h2>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg4)' }}>({categoryAccounts.length})</span>
                <span className="ml-auto" style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--fg2)' }}>
                  {formatCurrency(sumUsd(categoryAccounts), 'USD', { accounting: true })}
                </span>
              </div>

              {/* Account Cards Grid */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {categoryAccounts.map((account) => (
                  <AccountCard key={account.id} account={account} onClick={() => handleCardClick(account)} />
                ))}
              </div>
            </section>
          )
        })}
      </div>

      {/* Empty State */}
      {accounts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl" style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--fg3)' }}>
            <Wallet className="h-8 w-8" />
          </div>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, color: 'var(--fg)', marginBottom: 8 }}>No accounts yet</h3>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 14, color: 'var(--fg3)', maxWidth: 360, marginBottom: 24 }}>
            Add your bank accounts, credit cards, loans, and cash to start tracking your finances.
          </p>
          <Button variant="primary" icon={Plus} onClick={handleCreateClick}>
            Add Your First Account
          </Button>
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
