import { useState, useMemo } from 'react'
import type {
  BudgetsProps,
  Budget,
  Goal,
  TimeRange,
  FilterState,
  BudgetTypeFilter,
  SortField,
} from './types'
import { SpendingChart } from './SpendingChart'
import { CategorySpending } from './CategorySpending'
import { BudgetCard } from './BudgetCard'
import { BudgetDrawer } from './BudgetDrawer'
import { CreateBudgetModal } from './CreateBudgetModal'

type BudgetOrGoal = { type: 'budget'; item: Budget } | { type: 'goal'; item: Goal }

export function BudgetsDashboard({
  summary,
  categories,
  budgets,
  goals,
  goalContributions,
  savingsAccounts,
  monthlyHistory,
  categoryAverages,
  categorySpending,
  selectedMonth,
  transactions,
  onViewBudget,
  onEditBudget,
  onDeleteBudget,
  onCreateBudget,
  onCreateSinkingFund,
  onViewGoal,
  onEditGoal,
  onArchiveGoal,
  onMonthChange,
  onTimeRangeChange,
  onFilterChange,
}: BudgetsProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('12months')
  const [filter, setFilter] = useState<FilterState>({
    type: 'all',
    sortField: 'percentUsed',
    sortDirection: 'desc',
  })
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [selectedBudget, setSelectedBudget] = useState<Budget | null>(null)
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  // Combine and sort all budgets and goals
  const sortedItems = useMemo(() => {
    let items: BudgetOrGoal[] = []

    if (filter.type !== 'sinking_fund') {
      items.push(...budgets.map(b => ({ type: 'budget' as const, item: b })))
    }

    if (filter.type !== 'monthly') {
      items.push(...goals.map(g => ({ type: 'goal' as const, item: g })))
    }

    const getPercentUsed = (entry: BudgetOrGoal): number => {
      if (entry.type === 'budget') {
        return entry.item.budgeted > 0 ? entry.item.spent / entry.item.budgeted : 0
      }
      return entry.item.targetAmount > 0 ? entry.item.currentBalance / entry.item.targetAmount : 0
    }

    const getAmount = (entry: BudgetOrGoal): number => {
      if (entry.type === 'budget') return entry.item.budgeted
      return entry.item.targetAmount
    }

    const getSpent = (entry: BudgetOrGoal): number => {
      if (entry.type === 'budget') return entry.item.spent
      return entry.item.currentBalance
    }

    const getName = (entry: BudgetOrGoal): string => entry.item.name

    items.sort((a, b) => {
      let comparison = 0
      switch (filter.sortField) {
        case 'name':
          comparison = getName(a).localeCompare(getName(b))
          break
        case 'budgeted':
          comparison = getAmount(a) - getAmount(b)
          break
        case 'spent':
          comparison = getSpent(a) - getSpent(b)
          break
        case 'percentUsed':
          comparison = getPercentUsed(a) - getPercentUsed(b)
          break
      }
      return filter.sortDirection === 'asc' ? comparison : -comparison
    })

    return items
  }, [budgets, goals, filter])

  const handleTimeRangeChange = (range: TimeRange) => {
    setTimeRange(range)
    onTimeRangeChange?.(range)
  }

  const handleFilterChange = (updates: Partial<FilterState>) => {
    const newFilter = { ...filter, ...updates }
    setFilter(newFilter)
    onFilterChange?.(newFilter)
  }

  const handleCardClick = (budget?: Budget, goal?: Goal) => {
    if (budget) {
      setSelectedBudget(budget)
      setSelectedGoal(
        budget.linkedGoalId
          ? goals.find(g => g.id === budget.linkedGoalId) ?? null
          : null
      )
      onViewBudget?.(budget.id)
    } else if (goal) {
      setSelectedGoal(goal)
      setSelectedBudget(
        budgets.find(b => b.id === goal.linkedBudgetId) ?? null
      )
      onViewGoal?.(goal.id)
    }
    setIsDrawerOpen(true)
  }

  const handleDrawerClose = () => {
    setIsDrawerOpen(false)
    setSelectedBudget(null)
    setSelectedGoal(null)
  }

  // Get contributions filtered for the selected goal
  const selectedContributions = useMemo(() => {
    if (!selectedGoal) return []
    return goalContributions.filter(c => c.goalId === selectedGoal.id)
  }, [selectedGoal, goalContributions])

  const percentUsed = summary.totalBudgeted > 0
    ? Math.round((summary.totalSpent / summary.totalBudgeted) * 100)
    : 0

  // Month navigation (YYYY-MM)
  const currentMonthStr = (() => {
    const n = new Date()
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`
  })()
  const activeMonth = selectedMonth ?? currentMonthStr
  const shiftMonth = (ym: string, delta: number) => {
    const [y, m] = ym.split('-').map(Number)
    const d = new Date(y, m - 1 + delta, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }
  const canGoNext = activeMonth < currentMonthStr

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              Budgets
            </h1>
            {onMonthChange ? (
              <div className="flex items-center gap-2 mt-1">
                <button
                  onClick={() => onMonthChange(shiftMonth(activeMonth, -1))}
                  className="p-1 rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  aria-label="Previous month"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <span className="text-sm font-medium text-slate-600 dark:text-slate-300 min-w-[8rem] text-center">
                  {summary.month}
                </span>
                <button
                  onClick={() => canGoNext && onMonthChange(shiftMonth(activeMonth, 1))}
                  disabled={!canGoNext}
                  className="p-1 rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                  aria-label="Next month"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                {summary.month}
              </p>
            )}
          </div>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Budget
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
              Total Budgeted
            </p>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              ${summary.totalBudgeted.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
              Total Spent
            </p>
            <p className={`text-2xl font-bold ${percentUsed > 100 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-slate-100'}`}>
              ${summary.totalSpent.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
              Remaining
            </p>
            {summary.totalBudgeted > 0 ? (
              <>
                <p className={`text-2xl font-bold ${summary.totalBudgeted - summary.totalSpent < 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  ${Math.abs(summary.totalBudgeted - summary.totalSpent).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  {summary.totalBudgeted - summary.totalSpent < 0 && ' over'}
                </p>
                <div className="mt-3 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${percentUsed > 100 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                    style={{ width: `${Math.min(percentUsed, 100)}%` }}
                  />
                </div>
              </>
            ) : (
              <p className="text-2xl font-bold text-slate-400 dark:text-slate-500">—</p>
            )}
          </div>
        </div>

        {/* Spending Chart */}
        <div className="mb-8">
          <SpendingChart
            data={monthlyHistory}
            timeRange={timeRange}
            onTimeRangeChange={handleTimeRangeChange}
          />
        </div>

        {/* Spending by Category (selected month) */}
        <div className="mb-8">
          <CategorySpending data={categorySpending ?? []} month={summary.month} />
        </div>

        {/* Filter Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Type:</label>
            <select
              value={filter.type}
              onChange={(e) => handleFilterChange({ type: e.target.value as BudgetTypeFilter })}
              className="px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">All</option>
              <option value="monthly">Monthly Budgets</option>
              <option value="sinking_fund">Sinking Funds</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Sort by:</label>
            <select
              value={filter.sortField}
              onChange={(e) => handleFilterChange({ sortField: e.target.value as SortField })}
              className="px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="percentUsed">% Used</option>
              <option value="name">Name</option>
              <option value="budgeted">Amount</option>
              <option value="spent">Spent</option>
            </select>
            <button
              onClick={() => handleFilterChange({ sortDirection: filter.sortDirection === 'asc' ? 'desc' : 'asc' })}
              className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              title={filter.sortDirection === 'asc' ? 'Sort descending' : 'Sort ascending'}
            >
              <svg className={`w-4 h-4 text-slate-600 dark:text-slate-400 transition-transform ${filter.sortDirection === 'desc' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Budget Cards Grid */}
        {sortedItems.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
              <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-1">No budgets yet</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              Create your first budget to start tracking spending
            </p>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add your first budget
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedItems.map((entry) => (
              entry.type === 'budget' ? (
                <BudgetCard
                  key={entry.item.id}
                  budget={entry.item}
                  isCategory={entry.item.isCategory}
                  onClick={() => handleCardClick(entry.item)}
                />
              ) : (
                <BudgetCard
                  key={entry.item.id}
                  goal={entry.item}
                  onClick={() => handleCardClick(undefined, entry.item)}
                />
              )
            ))}
          </div>
        )}
      </div>

      {/* Drawer */}
      <BudgetDrawer
        budget={selectedBudget}
        goal={selectedGoal}
        contributions={selectedContributions}
        transactions={transactions}
        isOpen={isDrawerOpen}
        onClose={handleDrawerClose}
        onSaveBudget={(id, updates) => onEditBudget?.(id, updates)}
        onSaveGoal={(id, updates) => onEditGoal?.(id, updates)}
        onDelete={(id) => onDeleteBudget?.(id)}
        onArchiveGoal={(id) => onArchiveGoal?.(id)}
      />

      {/* Create Modal */}
      <CreateBudgetModal
        categories={categories}
        savingsAccounts={savingsAccounts}
        categoryAverages={categoryAverages}
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreateBudget={onCreateBudget}
        onCreateSinkingFund={onCreateSinkingFund}
      />
    </div>
  )
}
