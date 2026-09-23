'use client'

import { useState, useEffect, useCallback } from 'react'
import { BudgetsDashboard } from '@/components/budgets'
import { createClient } from '@/lib/supabase/client'
import {
  listBudgets,
  createBudget,
  updateBudget,
  deleteBudget,
  updateGoal,
} from '@/lib/api/client'
import type {
  Budget,
  Goal,
  GoalContribution,
  Category,
  SavingsAccountOption,
  BudgetSummary,
  MonthlyHistoryEntry,
  CategorySpending,
  Transaction,
} from '@/components/budgets/types'

function currentMonthIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const EMPTY_SUMMARY: BudgetSummary = {
  totalBudgeted: 0,
  totalSpent: 0,
  month: currentMonthIso(),
}

export default function BudgetsPage() {
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [goalContributions, setGoalContributions] = useState<GoalContribution[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [savingsAccounts, setSavingsAccounts] = useState<SavingsAccountOption[]>([])
  const [summary, setSummary] = useState<BudgetSummary>(EMPTY_SUMMARY)
  const [monthlyHistory, setMonthlyHistory] = useState<MonthlyHistoryEntry[]>([])
  const [categoryAverages, setCategoryAverages] = useState<Record<string, number>>({})
  const [categorySpending, setCategorySpending] = useState<CategorySpending[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [isAuthed, setIsAuthed] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState(currentMonthIso)

  // Fetch all budget data from the API for a given month.
  // When authenticated, the API response is authoritative — even an empty
  // budget list is real data (renders the empty state + a real chart).
  const fetchBudgets = useCallback(async (month: string) => {
    try {
      const data = await listBudgets(month)
      setBudgets((data.budgets || []) as Budget[])
      setGoals((data.goals || []) as Goal[])
      setGoalContributions((data.goalContributions || []) as GoalContribution[])
      setCategories((data.categories || []) as Category[])
      setCategoryAverages((data.categoryAverages || {}) as Record<string, number>)
      setCategorySpending((data.categorySpending || []) as CategorySpending[])
      setSavingsAccounts((data.savingsAccounts || []) as SavingsAccountOption[])
      setSummary((data.summary as BudgetSummary) ?? EMPTY_SUMMARY)
      setMonthlyHistory((data.monthlyHistory || []) as MonthlyHistoryEntry[])
      setTransactions((data.transactions || []) as Transaction[])
    } catch (e) {
      console.error('[budgets] fetch failed', e)
    }
  }, [])

  // Check auth on mount.
  useEffect(() => {
    async function init() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setIsAuthed(true)
      }
    }
    init()
  }, [])

  // Fetch when authenticated or the selected month changes.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data loading is the effect's external synchronization
    if (isAuthed) fetchBudgets(selectedMonth)
  }, [isAuthed, selectedMonth, fetchBudgets])

  const handleCreateBudget = useCallback(
    async (budget: Omit<Budget, 'id' | 'spent' | 'linkedGoalId'>) => {
      try {
        await createBudget({
          type: 'monthly',
          categoryId: budget.categoryId,
          subcategoryId: budget.subcategoryId,
          amount: budget.budgeted,
        })
        await fetchBudgets(selectedMonth)
      } catch (e) {
        console.error('[budgets] create failed', e)
      }
    },
    [fetchBudgets, selectedMonth]
  )

  const handleCreateSinkingFund = useCallback(
    async (data: {
      categoryId: string
      subcategoryId: string | null
      name: string
      targetAmount: number
      targetDate: string
      linkedAccountId: string
    }) => {
      try {
        await createBudget({
          type: 'sinking_fund',
          categoryId: data.categoryId,
          subcategoryId: data.subcategoryId,
          name: data.name,
          targetAmount: data.targetAmount,
          targetDate: data.targetDate,
          linkedAccountId: data.linkedAccountId,
        })
        await fetchBudgets(selectedMonth)
      } catch (e) {
        console.error('[budgets] create sinking fund failed', e)
      }
    },
    [fetchBudgets, selectedMonth]
  )

  const handleEditBudget = useCallback(
    async (id: string, updates: Partial<Budget>) => {
      try {
        await updateBudget(id, { amount: updates.budgeted })
        await fetchBudgets(selectedMonth)
      } catch (e) {
        console.error('[budgets] edit failed', e)
      }
    },
    [fetchBudgets, selectedMonth]
  )

  const handleDeleteBudget = useCallback(
    async (id: string) => {
      try {
        await deleteBudget(id)
        await fetchBudgets(selectedMonth)
      } catch (e) {
        console.error('[budgets] delete failed', e)
      }
    },
    [fetchBudgets, selectedMonth]
  )

  const handleEditGoal = useCallback(
    async (id: string, updates: Partial<Goal>) => {
      try {
        await updateGoal(id, {
          targetAmount: updates.targetAmount,
          targetDate: updates.targetDate,
        })
        await fetchBudgets(selectedMonth)
      } catch (e) {
        console.error('[budgets] edit goal failed', e)
      }
    },
    [fetchBudgets, selectedMonth]
  )

  const handleArchiveGoal = useCallback(
    async (id: string) => {
      try {
        await updateGoal(id, { status: 'archived' })
        await fetchBudgets(selectedMonth)
      } catch (e) {
        console.error('[budgets] archive goal failed', e)
      }
    },
    [fetchBudgets, selectedMonth]
  )

  return (
    <BudgetsDashboard
      summary={summary}
      categories={categories}
      budgets={budgets}
      goals={goals}
      goalContributions={goalContributions}
      savingsAccounts={savingsAccounts}
      monthlyHistory={monthlyHistory}
      categoryAverages={categoryAverages}
      categorySpending={categorySpending}
      selectedMonth={selectedMonth}
      transactions={transactions}
      onMonthChange={setSelectedMonth}
      onCreateBudget={handleCreateBudget}
      onCreateSinkingFund={handleCreateSinkingFund}
      onEditBudget={handleEditBudget}
      onDeleteBudget={handleDeleteBudget}
      onEditGoal={handleEditGoal}
      onArchiveGoal={handleArchiveGoal}
    />
  )
}
