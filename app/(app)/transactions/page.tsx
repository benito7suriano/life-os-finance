'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { TransactionList, TransactionModal, DeleteConfirmDialog } from '@/components/transactions'
import { createClient } from '@/lib/supabase/client'
import {
  listTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  listCategories,
  listAccounts,
  listGoals,
} from '@/lib/api/client'
import sampleData from '@/components/transactions/sample-data.json'
import type {
  Transaction,
  TransactionFormData,
  TransactionFilters,
  TransactionSummary,
  SortField,
  SortDirection,
  Category,
  Account,
  AccountGoals,
  GoalSummary,
} from '@/components/transactions/types'

const ITEMS_PER_PAGE = 10

// Fallback sample data
const sampleCategories = sampleData.categories as Category[]
const sampleAccounts = sampleData.accounts as Account[]
const sampleGoalsByAccount = sampleData.goalsByAccount as AccountGoals[]

export default function TransactionsPage() {
  // Reference data loaded from Supabase (with sample data fallback)
  const [categories, setCategories] = useState<Category[]>(sampleCategories)
  const [accounts, setAccounts] = useState<Account[]>(sampleAccounts)
  const [goalsByAccount, setGoalsByAccount] = useState<AccountGoals[]>(sampleGoalsByAccount)
  const [useApi, setUseApi] = useState(false)

  // Transaction data state
  const [transactions, setTransactions] = useState<Transaction[]>(
    sampleData.transactions as Transaction[]
  )
  const [totalCount, setTotalCount] = useState(0)

  // UI state
  const [currentPage, setCurrentPage] = useState(1)
  const [sortField, setSortField] = useState<SortField>('date')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [filters, setFilters] = useState<TransactionFilters>({})
  const [searchQuery, setSearchQuery] = useState('')

  // Modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | undefined>()
  const [deletingTransaction, setDeletingTransaction] = useState<Transaction | undefined>()

  // Fetch reference data from Supabase on mount
  useEffect(() => {
    async function loadReferenceData() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      setUseApi(true)

      try {
        const [{ categories: dbCategories }, { accounts: dbAccounts }, { goals: dbGoals }] =
          await Promise.all([listCategories(), listAccounts(), listGoals()])

        if (dbCategories && dbCategories.length > 0) {
          setCategories(dbCategories as Category[])
        }
        if (dbAccounts && dbAccounts.length > 0) {
          setAccounts(dbAccounts as Account[])
        }

        const activeGoals = ((dbGoals ?? []) as Array<{
          id: string
          name: string
          currentBalance: number
          targetAmount: number
          targetDate: string
          linkedAccountId: string
          status: string
        }>).filter((g) => g.status === 'active')

        if (activeGoals.length > 0) {
          const grouped: Record<string, GoalSummary[]> = {}
          for (const goal of activeGoals) {
            const accountId = goal.linkedAccountId
            if (!grouped[accountId]) grouped[accountId] = []
            const remaining = goal.targetAmount - goal.currentBalance
            const targetDate = new Date(goal.targetDate)
            const now = new Date()
            const monthsLeft = Math.max(
              1,
              (targetDate.getFullYear() - now.getFullYear()) * 12 +
                (targetDate.getMonth() - now.getMonth())
            )
            grouped[accountId].push({
              id: goal.id,
              name: goal.name,
              currentBalance: goal.currentBalance,
              targetAmount: goal.targetAmount,
              targetDate: goal.targetDate,
              monthlyContribution: Math.round((remaining / monthsLeft) * 100) / 100,
            })
          }
          setGoalsByAccount(
            Object.entries(grouped).map(([accountId, goals]) => ({
              accountId,
              goals,
            }))
          )
        }
      } catch {
        // API not available — keep sample data
      }
    }

    loadReferenceData()
  }, [])

  // Fetch transactions from API
  const fetchTransactions = useCallback(async () => {
    if (!useApi) return

    try {
      const data = await listTransactions({
        search: searchQuery || undefined,
        categoryIds: filters.categoryIds,
        accountIds: filters.accountIds,
        sources: filters.sources,
        dateFrom: filters.dateRange?.start,
        dateTo: filters.dateRange?.end,
        sortBy: sortField,
        sortDir: sortDirection,
        page: currentPage,
        limit: ITEMS_PER_PAGE,
      })
      if (data.transactions.length > 0) {
        setTransactions(data.transactions as Transaction[])
        setTotalCount(data.totalCount)
      } else {
        // Keep sample data as demo placeholder — restore matching reference data
        setUseApi(false)
        setCategories(sampleCategories)
        setAccounts(sampleAccounts)
        setGoalsByAccount(sampleGoalsByAccount)
      }
    } catch {
      // API not available, keep using sample data
    }
  }, [useApi, searchQuery, filters, sortField, sortDirection, currentPage])

  // Fetch when dependencies change (only when API is available)
  useEffect(() => {
    if (useApi) {
      fetchTransactions()
    }
  }, [useApi, fetchTransactions])

  // Client-side filtering/sorting/pagination for sample data mode
  const filteredTransactions = useMemo(() => {
    if (useApi) return transactions

    let result = [...transactions]

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter((t) => t.description.toLowerCase().includes(query))
    }

    if (filters.categoryIds && filters.categoryIds.length > 0) {
      result = result.filter((t) => filters.categoryIds!.includes(t.categoryId))
    }

    if (filters.accountIds && filters.accountIds.length > 0) {
      result = result.filter(
        (t) =>
          filters.accountIds!.includes(t.accountId) ||
          (t.fromAccountId && filters.accountIds!.includes(t.fromAccountId)) ||
          (t.toAccountId && filters.accountIds!.includes(t.toAccountId))
      )
    }

    if (filters.sources && filters.sources.length > 0) {
      result = result.filter((t) => filters.sources!.includes(t.source))
    }

    if (filters.dateRange) {
      result = result.filter(
        (t) => t.date >= filters.dateRange!.start && t.date <= filters.dateRange!.end
      )
    }

    return result
  }, [useApi, transactions, searchQuery, filters])

  const sortedTransactions = useMemo(() => {
    if (useApi) return filteredTransactions

    const sorted = [...filteredTransactions]
    sorted.sort((a, b) => {
      let comparison = 0
      switch (sortField) {
        case 'date':
          comparison = a.date.localeCompare(b.date)
          break
        case 'description':
          comparison = a.description.localeCompare(b.description)
          break
        case 'category': {
          const catA = categories.find((c) => c.id === a.categoryId)?.name || ''
          const catB = categories.find((c) => c.id === b.categoryId)?.name || ''
          comparison = catA.localeCompare(catB)
          break
        }
        case 'account': {
          const accA = accounts.find((acc) => acc.id === a.accountId)?.name || ''
          const accB = accounts.find((acc) => acc.id === b.accountId)?.name || ''
          comparison = accA.localeCompare(accB)
          break
        }
        case 'amount':
          comparison = a.amount - b.amount
          break
      }
      return sortDirection === 'asc' ? comparison : -comparison
    })
    return sorted
  }, [useApi, filteredTransactions, sortField, sortDirection, categories, accounts])

  const totalPages = useApi
    ? Math.max(1, Math.ceil(totalCount / ITEMS_PER_PAGE))
    : Math.max(1, Math.ceil(sortedTransactions.length / ITEMS_PER_PAGE))

  const paginatedTransactions = useMemo(() => {
    if (useApi) return sortedTransactions
    const start = (currentPage - 1) * ITEMS_PER_PAGE
    return sortedTransactions.slice(start, start + ITEMS_PER_PAGE)
  }, [useApi, sortedTransactions, currentPage])

  const summary: TransactionSummary = useMemo(() => {
    // In API mode, summary comes from the server in the response.
    // For client mode, compute from filtered data.
    return filteredTransactions.reduce(
      (acc, t) => {
        acc.count++
        if (t.amount > 0) acc.totalIncome += t.amount
        else acc.totalExpenses += Math.abs(t.amount)
        return acc
      },
      { count: 0, totalIncome: 0, totalExpenses: 0 }
    )
  }, [filteredTransactions])

  // Handlers
  const handleSort = useCallback((field: SortField, direction: SortDirection) => {
    setSortField(field)
    setSortDirection(direction)
    setCurrentPage(1)
  }, [])

  const handleFilterChange = useCallback((newFilters: TransactionFilters) => {
    setFilters(newFilters)
    setCurrentPage(1)
  }, [])

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query)
    setCurrentPage(1)
  }, [])

  const handleCreate = useCallback(() => {
    setEditingTransaction(undefined)
    setIsCreateModalOpen(true)
  }, [])

  const handleEdit = useCallback(
    (id: string) => {
      const transaction = transactions.find((t) => t.id === id)
      if (transaction) {
        setEditingTransaction(transaction)
        setIsCreateModalOpen(true)
      }
    },
    [transactions]
  )

  const handleDelete = useCallback(
    (id: string) => {
      const transaction = transactions.find((t) => t.id === id)
      if (transaction) {
        setDeletingTransaction(transaction)
      }
    },
    [transactions]
  )

  const handleSave = useCallback(
    async (data: TransactionFormData) => {
      if (useApi) {
        try {
          const apiData = {
            type: data.type,
            date: data.date,
            description: data.description,
            amount: data.amount,
            categoryId: data.categoryId,
            accountId: data.accountId,
            fromAccountId: data.fromAccountId,
            toAccountId: data.toAccountId,
            goalAllocations: data.contributeToGoals
              ? data.allocationMode === 'manual' && data.manualAllocations
                ? Object.entries(data.manualAllocations)
                    .filter(([, amount]) => amount > 0)
                    .map(([goalId, amount]) => ({ goalId, amount }))
                : [] // Proportional allocations computed server-side
              : undefined,
          }

          if (editingTransaction) {
            await updateTransaction(editingTransaction.id, apiData)
          } else {
            await createTransaction(apiData)
          }

          // Refetch
          await fetchTransactions()
        } catch {
          // Ignore
        }
      } else {
        // Sample data mode
        if (editingTransaction) {
          setTransactions((prev) =>
            prev.map((t) =>
              t.id === editingTransaction.id
                ? {
                    ...t,
                    type: data.type,
                    date: data.date,
                    description: data.description,
                    amount:
                      data.type === 'expense' ? -Math.abs(data.amount) : Math.abs(data.amount),
                    categoryId: data.categoryId || t.categoryId,
                    accountId: data.accountId || t.accountId,
                    fromAccountId: data.fromAccountId,
                    toAccountId: data.toAccountId,
                  }
                : t
            )
          )
        } else {
          const newTransaction: Transaction = {
            id: `txn-${Date.now()}`,
            type: data.type,
            date: data.date,
            description: data.description,
            amount:
              data.type === 'expense' ? -Math.abs(data.amount) : Math.abs(data.amount),
            categoryId: data.categoryId || '',
            accountId: data.accountId || data.fromAccountId || '',
            fromAccountId: data.fromAccountId,
            toAccountId: data.toAccountId,
            source: 'manual',
          }
          setTransactions((prev) => [newTransaction, ...prev])
        }
      }

      setIsCreateModalOpen(false)
      setEditingTransaction(undefined)
    },
    [useApi, editingTransaction, fetchTransactions]
  )

  const handleConfirmDelete = useCallback(async () => {
    if (!deletingTransaction) return

    if (useApi) {
      try {
        await deleteTransaction(deletingTransaction.id)
        await fetchTransactions()
      } catch {
        // Ignore
      }
    } else {
      setTransactions((prev) => prev.filter((t) => t.id !== deletingTransaction.id))
    }

    setDeletingTransaction(undefined)
  }, [useApi, deletingTransaction, fetchTransactions])

  const handleClearFilters = useCallback(() => {
    setFilters({})
    setSearchQuery('')
    setCurrentPage(1)
  }, [])

  return (
    <>
      <TransactionList
        transactions={paginatedTransactions}
        categories={categories}
        accounts={accounts}
        goalsByAccount={goalsByAccount}
        summary={summary}
        currentPage={currentPage}
        totalPages={totalPages}
        sortField={sortField}
        sortDirection={sortDirection}
        filters={filters}
        searchQuery={searchQuery}
        hasAnyTransactions={transactions.length > 0}
        onCreate={handleCreate}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onPageChange={setCurrentPage}
        onSort={handleSort}
        onFilterChange={handleFilterChange}
        onSearch={handleSearch}
        onClearFilters={handleClearFilters}
      />

      <TransactionModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false)
          setEditingTransaction(undefined)
        }}
        onSave={handleSave}
        categories={categories}
        accounts={accounts}
        goalsByAccount={goalsByAccount}
        editTransaction={editingTransaction}
      />

      <DeleteConfirmDialog
        isOpen={!!deletingTransaction}
        onClose={() => setDeletingTransaction(undefined)}
        onConfirm={handleConfirmDelete}
        transactionDescription={deletingTransaction?.description || ''}
      />
    </>
  )
}
