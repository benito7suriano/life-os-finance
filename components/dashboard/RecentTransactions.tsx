'use client'

import type { Transaction } from './types'
import { ArrowDownLeft, ArrowUpRight, ArrowRight, ChevronRight } from 'lucide-react'

interface RecentTransactionsProps {
  transactions: Transaction[]
  onViewTransaction?: (id: string) => void
  onViewAll?: () => void
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount)
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  if (date.toDateString() === today.toDateString()) {
    return 'Today'
  }
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday'
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function RecentTransactions({
  transactions,
  onViewTransaction,
  onViewAll,
}: RecentTransactionsProps) {
  const typeConfig = {
    expense: {
      icon: ArrowDownLeft,
      color: 'text-red-600 dark:text-red-400',
      bgColor: 'bg-red-100 dark:bg-red-900/30',
      prefix: '-',
    },
    income: {
      icon: ArrowUpRight,
      color: 'text-emerald-600 dark:text-emerald-400',
      bgColor: 'bg-emerald-100 dark:bg-emerald-900/30',
      prefix: '+',
    },
    transfer: {
      icon: ArrowRight,
      color: 'text-slate-600 dark:text-slate-400',
      bgColor: 'bg-slate-100 dark:bg-slate-800',
      prefix: '',
    },
  }

  if (transactions.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">
          Recent Transactions
        </h3>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400">No transactions yet</p>
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
            Add your first transaction or connect automation to get started
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
          Recent Transactions
        </h3>
        <button
          onClick={() => onViewAll?.()}
          className="flex items-center gap-1 text-xs font-medium text-emerald-600 transition-colors hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
        >
          View All
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="space-y-1">
        {transactions.map((transaction) => {
          const config = typeConfig[transaction.type]
          const Icon = config.icon

          return (
            <button
              key={transaction.id}
              onClick={() => onViewTransaction?.(transaction.id)}
              className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              {/* Category color dot and icon */}
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${config.bgColor}`}>
                <Icon className={`h-4 w-4 ${config.color}`} />
              </div>

              {/* Description and category */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
                  {transaction.merchant?.name || transaction.description}
                </p>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                  {transaction.category.name} • {formatDate(transaction.date)}
                </p>
              </div>

              {/* Amount */}
              <div className="flex-shrink-0 text-right">
                <p className={`text-sm font-semibold font-[JetBrains_Mono,monospace] ${config.color}`}>
                  {config.prefix}{formatCurrency(transaction.amount)}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {transaction.account.name}
                </p>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
