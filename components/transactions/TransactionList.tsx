'use client'

import type { TransactionsProps, SortField, SortDirection } from './types'
import { TransactionFiltersBar } from './TransactionFilters'
import { TransactionRow } from './TransactionRow'
import { Plus, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, Receipt } from 'lucide-react'
import { Card, Button, Empty, formatCurrency } from '@/components/ui'

const COLUMNS: { field: SortField; label: string; align: 'left' | 'right' }[] = [
  { field: 'date', label: 'Date', align: 'left' },
  { field: 'description', label: 'Description', align: 'left' },
  { field: 'category', label: 'Category', align: 'left' },
  { field: 'account', label: 'Account', align: 'left' },
  { field: 'amount', label: 'Amount', align: 'right' },
]

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
  const getCategoryById = (id: string) => categories.find((c) => c.id === id)
  const getAccountById = (id: string) => accounts.find((a) => a.id === id)

  const SortIndicator = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-50" />
    }
    return sortDirection === 'asc'
      ? <ArrowUp className="h-3.5 w-3.5" style={{ color: 'var(--accent-a)' }} />
      : <ArrowDown className="h-3.5 w-3.5" style={{ color: 'var(--accent-a)' }} />
  }

  const handleSort = (field: SortField) => {
    const newDirection: SortDirection = sortField === field && sortDirection === 'asc' ? 'desc' : 'asc'
    onSort?.(field, newDirection)
  }

  const getPageNumbers = () => {
    const pages: (number | 'ellipsis')[] = []
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
    } else if (currentPage <= 3) {
      pages.push(1, 2, 3, 4, 'ellipsis', totalPages)
    } else if (currentPage >= totalPages - 2) {
      pages.push(1, 'ellipsis', totalPages - 3, totalPages - 2, totalPages - 1, totalPages)
    } else {
      pages.push(1, 'ellipsis', currentPage - 1, currentPage, currentPage + 1, 'ellipsis', totalPages)
    }
    return pages
  }

  const getEmptyState = () => {
    if (!hasAnyTransactions) {
      return { title: 'No transactions yet', description: 'Start tracking your finances by adding your first transaction.', showCta: true }
    }
    if (searchQuery) {
      return { title: `No transactions found for "${searchQuery}"`, description: 'Try a different search term or adjust your filters.', showCta: false }
    }
    return { title: 'No transactions match your filters', description: 'Try adjusting your filters or clear them to see all transactions.', showCta: false, showClearFilters: true }
  }

  const headLabel: React.CSSProperties = {
    fontFamily: 'var(--font-mono)',
    fontSize: 10,
    fontWeight: 500,
    letterSpacing: '0.16em',
    textTransform: 'uppercase',
    color: 'var(--fg3)',
  }

  const summaryCards: { label: string; value: string; color: string }[] = [
    { label: 'Transactions', value: summary.count.toLocaleString(), color: 'var(--fg)' },
    { label: 'Income', value: `+${formatCurrency(summary.totalIncomeUsd)}`, color: 'var(--good)' },
    { label: 'Expenses', value: `-${formatCurrency(summary.totalExpensesUsd)}`, color: 'var(--bad)' },
  ]

  return (
    <div className="grid gap-4 p-4 md:p-6 lg:px-8 lg:py-6">
      {/* Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--fg)' }}>
            Transactions
          </h1>
          <p style={{ marginTop: 4, fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--fg3)' }}>
            View and manage all your financial transactions
          </p>
        </div>
        <Button variant="primary" icon={Plus} onClick={onCreate}>
          New Transaction
        </Button>
      </header>

      {/* Summary strip */}
      <div className="grid gap-4 sm:grid-cols-3">
        {summaryCards.map((s) => (
          <Card key={s.label} pad={16}>
            <div style={headLabel}>{s.label}</div>
            <div style={{ marginTop: 8, fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600, color: s.color }}>{s.value}</div>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <TransactionFiltersBar categories={categories} accounts={accounts} filters={filters} onFilterChange={onFilterChange} onSearch={onSearch} />

      {/* Table */}
      <Card pad={0} style={{ overflow: 'hidden' }}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--card-border)' }}>
                {COLUMNS.map((col) => (
                  <th key={col.field} className="px-4 py-3" style={{ textAlign: col.align }}>
                    <button
                      onClick={() => handleSort(col.field)}
                      className={`group flex items-center gap-1.5 ${col.align === 'right' ? 'ml-auto' : ''}`}
                      style={headLabel}
                    >
                      {col.label}
                      <SortIndicator field={col.field} />
                    </button>
                  </th>
                ))}
                <th className="w-16 px-4 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8">
                    {(() => {
                      const emptyState = getEmptyState()
                      return (
                        <Empty
                          icon={Receipt}
                          title={emptyState.title}
                          body={emptyState.description}
                          action={
                            <div className="mt-4 flex justify-center">
                              {emptyState.showCta && (
                                <Button variant="primary" icon={Plus} onClick={onCreate}>
                                  Add your first transaction
                                </Button>
                              )}
                              {'showClearFilters' in emptyState && emptyState.showClearFilters && (
                                <Button variant="ghost" onClick={onClearFilters}>
                                  Clear filters
                                </Button>
                              )}
                            </div>
                          }
                        />
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
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg3)' }}>
            Page {currentPage} of {totalPages}
          </p>

          <div className="flex items-center gap-1">
            <button
              onClick={() => onPageChange?.(currentPage - 1)}
              disabled={currentPage === 1}
              aria-label="Previous page"
              className="flex h-9 w-9 items-center justify-center rounded-lg disabled:cursor-not-allowed disabled:opacity-40"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--card-border)', color: 'var(--fg2)' }}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            {getPageNumbers().map((page, index) =>
              page === 'ellipsis' ? (
                <span key={`ellipsis-${index}`} className="flex h-9 w-9 items-center justify-center" style={{ color: 'var(--fg4)' }}>
                  …
                </span>
              ) : (
                <button
                  key={page}
                  onClick={() => onPageChange?.(page)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg"
                  style={
                    currentPage === page
                      ? { background: 'var(--accent-gradient)', color: '#0b0d18', fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600 }
                      : { background: 'rgba(255,255,255,0.04)', border: '1px solid var(--card-border)', color: 'var(--fg2)', fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500 }
                  }
                >
                  {page}
                </button>
              ),
            )}

            <button
              onClick={() => onPageChange?.(currentPage + 1)}
              disabled={currentPage === totalPages}
              aria-label="Next page"
              className="flex h-9 w-9 items-center justify-center rounded-lg disabled:cursor-not-allowed disabled:opacity-40"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--card-border)', color: 'var(--fg2)' }}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
