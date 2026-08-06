'use client'

import { useState, useEffect, useCallback } from 'react'
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

export default function TransactionsPage() {
  // Reference data
  const [categories, setCategories] = useState<Category[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [goalsByAccount, setGoalsByAccount] = useState<AccountGoals[]>([])
  const [isAuthed, setIsAuthed] = useState(false)

  // Transaction data
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [serverSummary, setServerSummary] = useState<TransactionSummary>({
    count: 0,
    totalIncomeUsd: 0,
    totalExpensesUsd: 0,
  })

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

  // Load reference data on mount
  useEffect(() => {
    async function loadReferenceData() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      setIsAuthed(true)

      // Run each independently so one failing call doesn't break the others.
      const [catsRes, acctsRes, goalsRes] = await Promise.allSettled([
        listCategories(),
        listAccounts(),
        listGoals(),
      ])

      if (catsRes.status === 'fulfilled') {
        setCategories((catsRes.value.categories || []) as Category[])
      } else {
        console.error('[transactions] listCategories failed', catsRes.reason)
      }

      if (acctsRes.status === 'fulfilled') {
        setAccounts((acctsRes.value.accounts || []) as Account[])
      } else {
        console.error('[transactions] listAccounts failed', acctsRes.reason)
      }

      if (goalsRes.status === 'rejected') {
        console.error('[transactions] listGoals failed', goalsRes.reason)
      }

      try {
        const dbGoals = goalsRes.status === 'fulfilled' ? goalsRes.value.goals : []
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
            Object.entries(grouped).map(([accountId, goals]) => ({ accountId, goals }))
          )
        }
      } catch (e) {
        console.error('[transactions] reference data fetch failed', e)
      }
    }

    loadReferenceData()
  }, [])

  // Fetch transactions
  const fetchTransactions = useCallback(async () => {
    if (!isAuthed) return

    try {
      const data = await listTransactions({
        search: searchQuery || undefined,
        categoryIds: filters.categoryIds,
        accountIds: filters.accountIds,
        sources: filters.sources,
        types: filters.types,
        dateFrom: filters.dateRange?.start,
        dateTo: filters.dateRange?.end,
        sortBy: sortField,
        sortDir: sortDirection,
        page: currentPage,
        limit: ITEMS_PER_PAGE,
      })
      setTransactions((data.transactions || []) as Transaction[])
      setTotalCount(data.totalCount || 0)
      if (data.summary) {
        setServerSummary(data.summary as TransactionSummary)
      }
    } catch (e) {
      console.error('[transactions] fetch failed', e)
    }
  }, [isAuthed, searchQuery, filters, sortField, sortDirection, currentPage])

  useEffect(() => {
    if (isAuthed) fetchTransactions()
  }, [isAuthed, fetchTransactions])

  const totalPages = Math.max(1, Math.ceil(totalCount / ITEMS_PER_PAGE))
  const summary = serverSummary

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
      if (transaction) setDeletingTransaction(transaction)
    },
    [transactions]
  )

  const handleSave = useCallback(
    async (data: TransactionFormData) => {
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
          toAmount: data.toAmount,
          toCurrency: data.toCurrency,
          goalAllocations: data.contributeToGoals
            ? data.allocationMode === 'manual' && data.manualAllocations
              ? Object.entries(data.manualAllocations)
                  .filter(([, amount]) => amount > 0)
                  .map(([goalId, amount]) => ({ goalId, amount }))
              : []
            : undefined,
        }

        if (editingTransaction) {
          await updateTransaction(editingTransaction.id, apiData)
        } else {
          await createTransaction(apiData)
        }

        await fetchTransactions()
      } catch (e) {
        console.error('[transactions] save failed', e)
      }

      setIsCreateModalOpen(false)
      setEditingTransaction(undefined)
    },
    [editingTransaction, fetchTransactions]
  )

  const handleConfirmDelete = useCallback(async () => {
    if (!deletingTransaction) return
    try {
      await deleteTransaction(deletingTransaction.id)
      await fetchTransactions()
    } catch (e) {
      console.error('[transactions] delete failed', e)
    }
    setDeletingTransaction(undefined)
  }, [deletingTransaction, fetchTransactions])

  const handleClearFilters = useCallback(() => {
    setFilters({})
    setSearchQuery('')
    setCurrentPage(1)
  }, [])

  return (
    <>
      <TransactionList
        transactions={transactions}
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
        hasAnyTransactions={totalCount > 0}
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
