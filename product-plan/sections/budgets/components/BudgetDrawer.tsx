import { useState } from 'react'
import type { Budget, Goal, Transaction } from '../types'

interface BudgetDrawerProps {
  budget: Budget | null
  goal: Goal | null
  transactions: Transaction[]
  isOpen: boolean
  onClose: () => void
  onSave?: (id: string, updates: Partial<Budget> | Partial<Goal>) => void
  onDelete?: (id: string) => void
}

export function BudgetDrawer({
  budget,
  goal,
  transactions,
  isOpen,
  onClose,
  onSave,
  onDelete
}: BudgetDrawerProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editAmount, setEditAmount] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const item = budget ?? goal
  if (!item) return null

  const isSinkingFund = !!goal
  const id = item.id
  const name = budget?.name ?? goal?.name ?? ''

  // Filter transactions for this budget/goal
  const filteredTransactions = transactions.filter(t => {
    if (budget) {
      if (budget.subcategoryId) {
        return t.subcategoryId === budget.subcategoryId
      }
      return t.categoryId === budget.categoryId
    }
    if (goal) {
      return t.goalId === goal.id || t.subcategoryId === goal.subcategoryId
    }
    return false
  })

  const handleStartEdit = () => {
    setEditAmount(
      budget ? budget.budgeted.toString() : goal ? goal.targetAmount.toString() : ''
    )
    setIsEditing(true)
  }

  const handleSave = () => {
    const amount = parseFloat(editAmount)
    if (isNaN(amount) || amount <= 0) return

    if (budget) {
      onSave?.(id, { budgeted: amount })
    } else if (goal) {
      onSave?.(id, { targetAmount: amount })
    }
    setIsEditing(false)
  }

  const handleDelete = () => {
    onDelete?.(id)
    setShowDeleteConfirm(false)
    onClose()
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={`
          fixed inset-0 bg-black/20 dark:bg-black/40 backdrop-blur-sm z-40
          transition-opacity duration-300
          ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}
        `}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`
          fixed right-0 top-0 bottom-0 w-full max-w-md bg-white dark:bg-slate-900 z-50
          shadow-2xl border-l border-slate-200 dark:border-slate-700
          transform transition-transform duration-300 ease-out
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {name}
              </h2>
              {isSinkingFund && (
                <span className="px-2 py-0.5 text-xs font-medium uppercase tracking-wider rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                  Sinking Fund
                </span>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* Stats */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              {budget && (
                <>
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800">
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                      Budgeted
                    </p>
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500">$</span>
                        <input
                          type="number"
                          value={editAmount}
                          onChange={(e) => setEditAmount(e.target.value)}
                          className="w-full text-xl font-semibold bg-white dark:bg-slate-700 rounded px-2 py-1 border border-slate-300 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          autoFocus
                        />
                      </div>
                    ) : (
                      <p className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                        ${budget.budgeted.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </p>
                    )}
                  </div>
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800">
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                      Spent
                    </p>
                    <p className={`text-xl font-semibold ${budget.spent > budget.budgeted ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-slate-100'}`}>
                      ${budget.spent.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </>
              )}

              {goal && (
                <>
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800">
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                      Target
                    </p>
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500">$</span>
                        <input
                          type="number"
                          value={editAmount}
                          onChange={(e) => setEditAmount(e.target.value)}
                          className="w-full text-xl font-semibold bg-white dark:bg-slate-700 rounded px-2 py-1 border border-slate-300 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          autoFocus
                        />
                      </div>
                    ) : (
                      <p className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                        ${goal.targetAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </p>
                    )}
                  </div>
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800">
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                      Saved
                    </p>
                    <p className={`text-xl font-semibold ${goal.currentBalance >= goal.targetAmount ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-slate-100'}`}>
                      ${goal.currentBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Goal details */}
            {goal && (
              <div className="mb-8 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-4 h-4 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Sinking Fund Details</p>
                </div>
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  Contributing ${goal.monthlyContribution}/month to <span className="font-medium">{goal.linkedAccountName}</span>
                </p>
              </div>
            )}

            {/* Progress bar */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Progress</p>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  {budget && `${Math.round((budget.spent / budget.budgeted) * 100)}%`}
                  {goal && `${Math.round((goal.currentBalance / goal.targetAmount) * 100)}%`}
                </p>
              </div>
              <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    budget && budget.spent > budget.budgeted
                      ? 'bg-amber-500'
                      : goal && goal.currentBalance >= goal.targetAmount
                        ? 'bg-emerald-500'
                        : 'bg-emerald-500'
                  }`}
                  style={{
                    width: `${Math.min(
                      budget ? (budget.spent / budget.budgeted) * 100 : (goal!.currentBalance / goal!.targetAmount) * 100,
                      100
                    )}%`
                  }}
                />
              </div>
            </div>

            {/* Transactions */}
            <div>
              <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">
                Recent Transactions
              </h3>

              {filteredTransactions.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-8">
                  No transactions yet this month
                </p>
              ) : (
                <div className="space-y-3">
                  {filteredTransactions.map((txn) => (
                    <div
                      key={txn.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-900 dark:text-slate-100 truncate">
                          {txn.description}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {new Date(txn.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          {txn.accountName && ` · ${txn.accountName}`}
                        </p>
                      </div>
                      <p className={`font-medium tabular-nums ${txn.isContribution ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-slate-100'}`}>
                        {txn.isContribution ? '+' : '-'}${txn.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Footer actions */}
          <div className="p-6 border-t border-slate-200 dark:border-slate-700">
            {isEditing ? (
              <div className="flex gap-3">
                <button
                  onClick={() => setIsEditing(false)}
                  className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                >
                  Save Changes
                </button>
              </div>
            ) : showDeleteConfirm ? (
              <div className="space-y-3">
                <p className="text-sm text-slate-600 dark:text-slate-400 text-center">
                  Delete this {isSinkingFund ? 'sinking fund' : 'budget'}?
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-4 py-2.5 text-sm font-medium rounded-lg border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                  Delete
                </button>
                <button
                  onClick={handleStartEdit}
                  className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                >
                  Edit {isSinkingFund ? 'Goal' : 'Budget'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
