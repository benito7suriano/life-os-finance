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
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [isAuthed, setIsAuthed] = useState(false)

  const fetchBudgets = useCallback(async () => {
    try {
      const data = await listBudgets()
      setBudgets((data.budgets || []) as Budget[])
      setGoals((data.goals || []) as Goal[])
      setGoalContributions((data.goalContributions || []) as GoalContribution[])
      setCategories((data.categories || []) as Category[])
      setSavingsAccounts((data.savingsAccounts || []) as SavingsAccountOption[])
      setSummary((data.summary as BudgetSummary) ?? EMPTY_SUMMARY)
      setMonthlyHistory((data.monthlyHistory || []) as MonthlyHistoryEntry[])
      setTransactions((data.transactions || []) as Transaction[])
    } catch (e) {
      console.error('[budgets] fetch failed', e)
    }
  }, [])

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

  useEffect(() => {
    if (isAuthed) fetchBudgets()
  }, [isAuthed, fetchBudgets])

  const handleCreateBudget = useCallback(
    async (budget: Omit<Budget, 'id' | 'spent' | 'linkedGoalId'>) => {
      try {
        await createBudget({
          type: 'monthly',
          categoryId: budget.categoryId,
          subcategoryId: budget.subcategoryId,
          amount: budget.budgeted,
        })
        await fetchBudgets()
      } catch (e) {
        console.error('[budgets] create failed', e)
      }
    },
    [fetchBudgets]
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
        await fetchBudgets()
      } catch (e) {
        console.error('[budgets] create sinking fund failed', e)
      }
    },
    [fetchBudgets]
  )

  const handleEditBudget = useCallback(
    async (id: string, updates: Partial<Budget>) => {
      try {
        await updateBudget(id, { amount: updates.budgeted })
        await fetchBudgets()
      } catch (e) {
        console.error('[budgets] edit failed', e)
      }
    },
    [fetchBudgets]
  )

  const handleDeleteBudget = useCallback(
    async (id: string) => {
      try {
        await deleteBudget(id)
        await fetchBudgets()
      } catch (e) {
        console.error('[budgets] delete failed', e)
      }
    },
    [fetchBudgets]
  )

  const handleEditGoal = useCallback(
    async (id: string, updates: Partial<Goal>) => {
      try {
        await updateGoal(id, {
          targetAmount: updates.targetAmount,
          targetDate: updates.targetDate,
        })
        await fetchBudgets()
      } catch (e) {
        console.error('[budgets] edit goal failed', e)
      }
    },
    [fetchBudgets]
  )

  const handleArchiveGoal = useCallback(
    async (id: string) => {
      try {
        await updateGoal(id, { status: 'archived' })
        await fetchBudgets()
      } catch (e) {
        console.error('[budgets] archive goal failed', e)
      }
    },
    [fetchBudgets]
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
      transactions={transactions}
      onCreateBudget={handleCreateBudget}
      onCreateSinkingFund={handleCreateSinkingFund}
      onEditBudget={handleEditBudget}
      onDeleteBudget={handleDeleteBudget}
      onEditGoal={handleEditGoal}
      onArchiveGoal={handleArchiveGoal}
    />
  )
}
