'use client'

import type { TransactionsProps, SortField, SortDirection } from './types'
import { TransactionFiltersBar } from './TransactionFilters'
import { TransactionRow } from './TransactionRow'
import { Plus, ArrowUpDown, ArrowUp, ArrowDown, TrendingUp, TrendingDown, ChevronLeft, ChevronRight, Receipt } from 'lucide-react'

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount)
}

export function TransactionList({
  transactions,
  categories,
  accounts,
  summary,
  currentPage,
  totalPages,
  sortField,
  sortDirection,
  filters,
  searchQuery,
  hasAnyTransactions = true,
  onCreate,
  onEdit,
  onDelete,
  onPageChange,
  onSort,
  onFilterChange,
  onSearch,
  onClearFilters,
}: TransactionsProps) {
  // Helper to get category and account by ID
  const getCategoryById = (id: string) => categories.find(c => c.id === id)
  const getAccountById = (id: string) => accounts.find(a => a.id === id)

  // Sort indicator component
  const SortIndicator = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4 opacity-0 transition-opacity group-hover:opacity-50" />
    }
    return sortDirection === 'asc'
      ? <ArrowUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
      : <ArrowDown className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
  }

  const handleSort = (field: SortField) => {
    const newDirection: SortDirection = sortField === field && sortDirection === 'asc' ? 'desc' : 'asc'
    onSort?.(field, newDirection)
  }

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pages: (number | 'ellipsis')[] = []
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
    } else {
      if (currentPage <= 3) {
        pages.push(1, 2, 3, 4, 'ellipsis', totalPages)
      } else if (currentPage >= totalPages - 2) {
        pages.push(1, 'ellipsis', totalPages - 3, totalPages - 2, totalPages - 1, totalPages)
      } else {
        pages.push(1, 'ellipsis', currentPage - 1, currentPage, currentPage + 1, 'ellipsis', totalPages)
      }
    }
    return pages
  }

  // Determine empty state type
  const getEmptyState = () => {
    if (!hasAnyTransactions) {
      return {
        title: 'No transactions yet',
        description: 'Start tracking your finances by adding your first transaction.',
        showCta: true,
      }
    }
    if (searchQuery) {
      return {
        title: `No transactions found for "${searchQuery}"`,
        description: 'Try a different search term or adjust your filters.',
        showCta: false,
      }
    }
    return {
      title: 'No transactions match your filters',
      description: 'Try adjusting your filters or clear them to see all transactions.',
      showCta: false,
      showClearFilters: true,
    }
  }

  return (
    <div className="min-h-full rounded-xl bg-white p-6 shadow-sm dark:bg-slate-800/50">
      <div className="space-y-6">
        {/* Page Header */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
              Transactions
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              View and manage all your financial transactions
            </p>
          </div>

          {/* New Transaction Button */}
          <button
            onClick={onCreate}
            className="flex h-10 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-700 active:bg-emerald-800"
          >
            <Plus className="h-4 w-4" />
            <span>New Transaction</span>
          </button>
        </header>

        {/* Summary Bar */}
        <div className="grid gap-4 sm:grid-cols-3">
          {/* Transaction Count */}
          <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-200 dark:bg-slate-700">
              <span className="text-lg font-semibold text-slate-700 dark:text-slate-300">#</span>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Transactions
              </p>
              <p className="text-lg font-semibold text-slate-900 dark:text-white">
                {summary.count.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Total Income */}
          <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-800 dark:bg-emerald-900/20">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-200 dark:bg-emerald-800">
              <TrendingUp className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Income
              </p>
              <p className="font-[JetBrains_Mono,monospace] text-lg font-semibold text-emerald-700 dark:text-emerald-400">
                +{formatCurrency(summary.totalIncomeUsd)}
              </p>
            </div>
          </div>

          {/* Total Expenses */}
          <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-800 dark:bg-red-900/20">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-200 dark:bg-red-800">
              <TrendingDown className="h-5 w-5 text-red-700 dark:text-red-400" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-red-600 dark:text-red-400">
                Expenses
              </p>
              <p className="font-[JetBrains_Mono,monospace] text-lg font-semibold text-red-700 dark:text-red-400">
                -{formatCurrency(summary.totalExpensesUsd)}
              </p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <TransactionFiltersBar
          categories={categories}
          accounts={accounts}
          filters={filters}
          onFilterChange={onFilterChange}
          onSearch={onSearch}
        />

        {/* Table */}
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
                <th className="px-4 py-3 text-left">
                  <button
                    onClick={() => handleSort('date')}
                    className="group flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 transition-colors hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
                  >
                    Date
                    <SortIndicator field="date" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left">
                  <button
                    onClick={() => handleSort('description')}
                    className="group flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 transition-colors hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
                  >
                    Description
                    <SortIndicator field="description" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left">
                  <button
                    onClick={() => handleSort('category')}
                    className="group flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 transition-colors hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
                  >
                    Category
                    <SortIndicator field="category" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left">
                  <button
                    onClick={() => handleSort('account')}
                    className="group flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 transition-colors hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
                  >
                    Account
                    <SortIndicator field="account" />
                  </button>
                </th>
                <th className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleSort('amount')}
                    className="group ml-auto flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 transition-colors hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
                  >
                    Amount
                    <SortIndicator field="amount" />
                  </button>
                </th>
                <th className="w-16 px-4 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    {(() => {
                      const emptyState = getEmptyState()
                      return (
                        <div className="flex flex-col items-center">
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-700">
                            <Receipt className="h-6 w-6 text-slate-400 dark:text-slate-500" />
                          </div>
                          <p className="mt-3 text-sm font-medium text-slate-900 dark:text-white">
                            {emptyState.title}
                          </p>
                          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                            {emptyState.description}
                          </p>
                          {emptyState.showCta && (
                            <button
                              onClick={onCreate}
                              className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
                            >
                              <Plus className="h-4 w-4" />
                              Add your first transaction
                            </button>
                          )}
                          {'showClearFilters' in emptyState && emptyState.showClearFilters && (
                            <button
                              onClick={onClearFilters}
                              className="mt-4 text-sm font-medium text-emerald-600 transition-colors hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
                            >
                              Clear filters
                            </button>
                          )}
                        </div>
                      )
                    })()}
                  </td>
                </tr>
              ) : (
                transactions.map((transaction) => {
                  const category = getCategoryById(transaction.categoryId) ?? {
                    id: '',
                    name: 'Uncategorized',
                    color: '#94a3b8',
                    type: (transaction.type === 'income' ? 'income' : 'expense') as 'income' | 'expense',
                  }
                  const account = getAccountById(transaction.accountId) ?? {
                    id: '',
                    name: 'Unknown account',
                    type: 'checking' as const,
                    icon: 'wallet',
                  }

                  return (
                    <TransactionRow
                      key={transaction.id}
                      transaction={transaction}
                      category={category}
                      account={account}
                      onEdit={() => onEdit?.(transaction.id)}
                      onDelete={() => onDelete?.(transaction.id)}
                    />
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Page {currentPage} of {totalPages}
            </p>

            <div className="flex items-center gap-1">
              {/* Previous */}
              <button
                onClick={() => onPageChange?.(currentPage - 1)}
                disabled={currentPage === 1}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:hover:text-slate-300"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              {/* Page Numbers */}
              {getPageNumbers().map((page, index) =>
                page === 'ellipsis' ? (
                  <span
                    key={`ellipsis-${index}`}
                    className="flex h-9 w-9 items-center justify-center text-slate-400"
                  >
                    ...
                  </span>
                ) : (
                  <button
                    key={page}
                    onClick={() => onPageChange?.(page)}
                    className={`flex h-9 w-9 items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                      currentPage === page
                        ? 'bg-emerald-600 text-white'
                        : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                    }`}
                  >
                    {page}
                  </button>
                )
              )}

              {/* Next */}
              <button
                onClick={() => onPageChange?.(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:hover:text-slate-300"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
