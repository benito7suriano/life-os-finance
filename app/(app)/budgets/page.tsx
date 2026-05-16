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
import sampleData from '@/components/budgets/sample-data.json'
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

// Type-safe sample data
const sampleCategories = sampleData.categories as Category[]
const sampleBudgets = sampleData.budgets as Budget[]
const sampleGoals = sampleData.goals as Goal[]
const sampleGoalContributions = sampleData.goalContributions as GoalContribution[]
const sampleSavingsAccounts = sampleData.savingsAccounts as SavingsAccountOption[]
const sampleSummary = sampleData.summary as BudgetSummary
const sampleMonthlyHistory = sampleData.monthlyHistory as MonthlyHistoryEntry[]
const sampleTransactions = sampleData.transactions as Transaction[]

export default function BudgetsPage() {
  const [budgets, setBudgets] = useState<Budget[]>(sampleBudgets)
  const [goals, setGoals] = useState<Goal[]>(sampleGoals)
  const [goalContributions, setGoalContributions] = useState<GoalContribution[]>(sampleGoalContributions)
  const [categories, setCategories] = useState<Category[]>(sampleCategories)
  const [savingsAccounts, setSavingsAccounts] = useState<SavingsAccountOption[]>(sampleSavingsAccounts)
  const [summary, setSummary] = useState<BudgetSummary>(sampleSummary)
  const [monthlyHistory, setMonthlyHistory] = useState<MonthlyHistoryEntry[]>(sampleMonthlyHistory)
  const [transactions, setTransactions] = useState<Transaction[]>(sampleTransactions)
  const [useApi, setUseApi] = useState(false)

  // Fetch all budget data from the API
  const fetchBudgets = useCallback(async () => {
    try {
      const data = await listBudgets()

      if (data.budgets && (data.budgets.length > 0 || data.goals?.length > 0)) {
        setBudgets(data.budgets as Budget[])
        setGoals((data.goals || []) as Goal[])
        setGoalContributions((data.goalContributions || []) as GoalContribution[])
        setCategories((data.categories || sampleCategories) as Category[])
        setSavingsAccounts((data.savingsAccounts || []) as SavingsAccountOption[])
        setSummary(data.summary as BudgetSummary)
        setMonthlyHistory((data.monthlyHistory || []) as MonthlyHistoryEntry[])
        setTransactions((data.transactions || []) as Transaction[])
      } else {
        setUseApi(false)
      }
    } catch {
      setUseApi(false)
    }
  }, [])

  // Check auth and load data on mount
  useEffect(() => {
    async function init() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUseApi(true)
      }
    }
    init()
  }, [])

  // Fetch when API is available
  useEffect(() => {
    if (useApi) {
      fetchBudgets()
    }
  }, [useApi, fetchBudgets])

  // --- Callbacks ---

  const handleCreateBudget = useCallback(
    async (budget: Omit<Budget, 'id' | 'spent' | 'linkedGoalId'>) => {
      if (useApi) {
        try {
          await createBudget({
            type: 'monthly',
            categoryId: budget.categoryId,
            subcategoryId: budget.subcategoryId,
            amount: budget.budgeted,
          })
          await fetchBudgets()
        } catch {
          // Ignore
        }
      } else {
        const newBudget: Budget = {
          ...budget,
          id: `budget-${Date.now()}`,
          spent: 0,
        }
        setBudgets(prev => [...prev, newBudget])
        setSummary(prev => ({
          ...prev,
          totalBudgeted: prev.totalBudgeted + newBudget.budgeted,
        }))
      }
    },
    [useApi, fetchBudgets]
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
      if (useApi) {
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
        } catch {
          // Ignore
        }
      } else {
        const budgetId = `budget-sf-${Date.now()}`
        const goalId = `goal-${Date.now()}`
        const now = new Date()
        const end = new Date(data.targetDate)
        const monthsLeft = Math.max(
          1,
          (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth())
        )
        const monthlyContribution = Math.round((data.targetAmount / monthsLeft) * 100) / 100

        const newBudget: Budget = {
          id: budgetId,
          categoryId: data.categoryId,
          subcategoryId: data.subcategoryId,
          name: data.name,
          type: 'sinking_fund',
          budgeted: monthlyContribution,
          spent: 0,
          isCategory: false,
          linkedGoalId: goalId,
        }

        const account = savingsAccounts.find(a => a.id === data.linkedAccountId)
        const newGoal: Goal = {
          id: goalId,
          categoryId: data.categoryId,
          subcategoryId: data.subcategoryId,
          name: data.name,
          linkedBudgetId: budgetId,
          linkedAccountId: data.linkedAccountId,
          linkedAccountName: account?.name || '',
          targetAmount: data.targetAmount,
          targetDate: data.targetDate,
          currentBalance: 0,
          monthlyContribution,
          status: 'active',
        }

        setBudgets(prev => [...prev, newBudget])
        setGoals(prev => [...prev, newGoal])
      }
    },
    [useApi, fetchBudgets, savingsAccounts]
  )

  const handleEditBudget = useCallback(
    async (id: string, updates: Partial<Budget>) => {
      if (useApi) {
        try {
          await updateBudget(id, { amount: updates.budgeted })
          await fetchBudgets()
        } catch {
          // Ignore
        }
      } else {
        setBudgets(prev =>
          prev.map(b => (b.id === id ? { ...b, ...updates } : b))
        )
      }
    },
    [useApi, fetchBudgets]
  )

  const handleDeleteBudget = useCallback(
    async (id: string) => {
      if (useApi) {
        try {
          await deleteBudget(id)
          await fetchBudgets()
        } catch {
          // Ignore
        }
      } else {
        const budget = budgets.find(b => b.id === id)
        setBudgets(prev => prev.filter(b => b.id !== id))
        if (budget?.linkedGoalId) {
          setGoals(prev => prev.filter(g => g.id !== budget.linkedGoalId))
        }
        if (budget) {
          setSummary(prev => ({
            ...prev,
            totalBudgeted: prev.totalBudgeted - budget.budgeted,
            totalSpent: prev.totalSpent - budget.spent,
          }))
        }
      }
    },
    [useApi, fetchBudgets, budgets]
  )

  const handleEditGoal = useCallback(
    async (id: string, updates: Partial<Goal>) => {
      if (useApi) {
        try {
          await updateGoal(id, {
            targetAmount: updates.targetAmount,
            targetDate: updates.targetDate,
          })
          await fetchBudgets()
        } catch {
          // Ignore
        }
      } else {
        setGoals(prev =>
          prev.map(g => (g.id === id ? { ...g, ...updates } : g))
        )
      }
    },
    [useApi, fetchBudgets]
  )

  const handleArchiveGoal = useCallback(
    async (id: string) => {
      if (useApi) {
        try {
          await updateGoal(id, { status: 'archived' })
          await fetchBudgets()
        } catch {
          // Ignore
        }
      } else {
        setGoals(prev =>
          prev.map(g => (g.id === id ? { ...g, status: 'archived' as const } : g))
        )
      }
    },
    [useApi, fetchBudgets]
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
