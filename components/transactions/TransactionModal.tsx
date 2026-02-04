'use client'

import { useState, useEffect } from 'react'
import type {
  TransactionModalProps,
  TransactionFormData,
  GoalSummary,
  AllocationMode,
} from './types'
import { X } from 'lucide-react'

export function TransactionModal({
  isOpen,
  onClose,
  onSave,
  categories,
  accounts,
  goalsByAccount,
  editTransaction,
}: TransactionModalProps) {
  const isEditMode = !!editTransaction

  const [type, setType] = useState<'expense' | 'income' | 'transfer'>(
    editTransaction?.type || 'expense'
  )
  const [date, setDate] = useState(
    editTransaction?.date || new Date().toISOString().split('T')[0]
  )
  const [description, setDescription] = useState(editTransaction?.description || '')
  const [amount, setAmount] = useState(
    editTransaction ? String(Math.abs(editTransaction.amount)) : ''
  )
  const [categoryId, setCategoryId] = useState(editTransaction?.categoryId || '')
  const [accountId, setAccountId] = useState(editTransaction?.accountId || '')
  const [fromAccountId, setFromAccountId] = useState(editTransaction?.fromAccountId || '')
  const [toAccountId, setToAccountId] = useState(editTransaction?.toAccountId || '')
  const [contributeToGoals, setContributeToGoals] = useState(false)
  const [allocationMode, setAllocationMode] = useState<AllocationMode>('proportional')
  const [manualAllocations, setManualAllocations] = useState<Record<string, number>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Reset form when modal opens/closes or editTransaction changes
  useEffect(() => {
    if (isOpen) {
      setType(editTransaction?.type || 'expense')
      setDate(editTransaction?.date || new Date().toISOString().split('T')[0])
      setDescription(editTransaction?.description || '')
      setAmount(editTransaction ? String(Math.abs(editTransaction.amount)) : '')
      setCategoryId(editTransaction?.categoryId || '')
      setAccountId(editTransaction?.accountId || '')
      setFromAccountId(editTransaction?.fromAccountId || '')
      setToAccountId(editTransaction?.toAccountId || '')
      setContributeToGoals(false)
      setAllocationMode('proportional')
      setManualAllocations({})
      setErrors({})
    }
  }, [isOpen, editTransaction])

  if (!isOpen) return null

  // Get goals for the selected to-account (only if it's a savings account)
  const toAccount = accounts.find((a) => a.id === toAccountId)
  const goalsForToAccount: GoalSummary[] =
    toAccount?.type === 'savings'
      ? goalsByAccount.find((g) => g.accountId === toAccountId)?.goals || []
      : []
  const hasGoals = goalsForToAccount.length > 0

  // Filter categories by type
  const filteredCategories = categories.filter((c) => {
    if (type === 'expense') return c.type === 'expense'
    if (type === 'income') return c.type === 'income'
    return false
  })

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!description.trim()) {
      newErrors.description = 'Description is required'
    }

    const amountNum = parseFloat(amount)
    if (!amount || isNaN(amountNum) || amountNum <= 0) {
      newErrors.amount = 'Amount must be greater than 0'
    }

    if (type !== 'transfer' && !categoryId) {
      newErrors.categoryId = 'Category is required'
    }

    if (type !== 'transfer' && !accountId) {
      newErrors.accountId = 'Account is required'
    }

    if (type === 'transfer') {
      if (!fromAccountId) newErrors.fromAccountId = 'From account is required'
      if (!toAccountId) newErrors.toAccountId = 'To account is required'
      if (fromAccountId && toAccountId && fromAccountId === toAccountId) {
        newErrors.toAccountId = 'Must be different from source account'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = () => {
    if (!validate()) return

    const formData: TransactionFormData = {
      type,
      date,
      description: description.trim(),
      amount: parseFloat(amount),
      ...(type !== 'transfer' && { categoryId, accountId }),
      ...(type === 'transfer' && {
        fromAccountId,
        toAccountId,
        contributeToGoals,
        ...(contributeToGoals && {
          allocationMode,
          ...(allocationMode === 'manual' && { manualAllocations }),
        }),
      }),
    }

    onSave(formData)
  }

  // Compute proportional allocations for display
  const computeProportionalAllocations = () => {
    const amountNum = parseFloat(amount) || 0
    if (amountNum <= 0 || goalsForToAccount.length === 0) return {}

    const totalWeight = goalsForToAccount.reduce(
      (sum, g) => sum + g.monthlyContribution,
      0
    )
    if (totalWeight === 0) return {}

    const allocations: Record<string, number> = {}
    let remaining = amountNum

    // Sort by monthly contribution descending for remainder allocation
    const sorted = [...goalsForToAccount].sort(
      (a, b) => b.monthlyContribution - a.monthlyContribution
    )

    sorted.forEach((goal, i) => {
      if (i === 0) {
        // Largest goal gets the remainder to handle rounding
        // (calculated last below)
      } else {
        const share = Math.round((goal.monthlyContribution / totalWeight) * amountNum * 100) / 100
        allocations[goal.id] = share
        remaining -= share
      }
    })
    // Apply remainder to largest goal
    allocations[sorted[0].id] = Math.round(remaining * 100) / 100

    return allocations
  }

  const proportionalAllocations = computeProportionalAllocations()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative my-8 w-full max-w-lg rounded-xl bg-white p-6 shadow-xl dark:bg-slate-800">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            {isEditMode ? 'Edit Transaction' : 'New Transaction'}
          </h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Type Tabs */}
        <div className="mt-4 flex rounded-lg bg-slate-100 p-1 dark:bg-slate-700">
          {(['expense', 'income', 'transfer'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-medium capitalize transition-colors ${
                type === t
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-600 dark:text-white'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
              }`}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* Form Fields */}
        <div className="mt-6 space-y-4">
          {/* Date */}
          <div>
            <label htmlFor="txn-date" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Date
            </label>
            <input
              id="txn-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="txn-description" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Description
            </label>
            <input
              id="txn-description"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter description"
              className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder-slate-400 outline-none transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder-slate-500"
            />
            {errors.description && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.description}</p>
            )}
          </div>

          {/* Amount */}
          <div>
            <label htmlFor="txn-amount" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Amount
            </label>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
              <input
                id="txn-amount"
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-7 pr-3 text-sm text-slate-900 placeholder-slate-400 outline-none transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder-slate-500"
              />
            </div>
            {errors.amount && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.amount}</p>
            )}
          </div>

          {/* Category (Expense / Income only) */}
          {type !== 'transfer' && (
            <div>
              <label htmlFor="txn-category" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Category
              </label>
              <select
                id="txn-category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="">Select category</option>
                {filteredCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
              {errors.categoryId && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.categoryId}</p>
              )}
            </div>
          )}

          {/* Account (Expense / Income only) */}
          {type !== 'transfer' && (
            <div>
              <label htmlFor="txn-account" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Account
              </label>
              <select
                id="txn-account"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="">Select account</option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name}
                  </option>
                ))}
              </select>
              {errors.accountId && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.accountId}</p>
              )}
            </div>
          )}

          {/* Transfer: From/To Accounts */}
          {type === 'transfer' && (
            <>
              <div>
                <label htmlFor="txn-from-account" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  From Account
                </label>
                <select
                  id="txn-from-account"
                  value={fromAccountId}
                  onChange={(e) => setFromAccountId(e.target.value)}
                  className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="">Select account</option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name}
                    </option>
                  ))}
                </select>
                {errors.fromAccountId && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.fromAccountId}</p>
                )}
              </div>

              <div>
                <label htmlFor="txn-to-account" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  To Account
                </label>
                <select
                  id="txn-to-account"
                  value={toAccountId}
                  onChange={(e) => setToAccountId(e.target.value)}
                  className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="">Select account</option>
                  {accounts
                    .filter((acc) => acc.id !== fromAccountId)
                    .map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name}
                      </option>
                    ))}
                </select>
                {errors.toAccountId && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.toAccountId}</p>
                )}
              </div>

              {/* Goal Allocation Section */}
              {hasGoals && (
                <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                  {/* Toggle */}
                  <label className="flex cursor-pointer items-center justify-between">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Contribute to goals
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={contributeToGoals}
                      onClick={() => setContributeToGoals(!contributeToGoals)}
                      className={`relative h-6 w-11 rounded-full transition-colors ${
                        contributeToGoals
                          ? 'bg-emerald-600'
                          : 'bg-slate-200 dark:bg-slate-600'
                      }`}
                    >
                      <span
                        className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform shadow-sm ${
                          contributeToGoals ? 'translate-x-5' : ''
                        }`}
                      />
                    </button>
                  </label>

                  {contributeToGoals && (
                    <div className="mt-4 space-y-3">
                      {/* Mode Toggle */}
                      <div className="flex rounded-lg bg-slate-100 p-1 dark:bg-slate-700">
                        <button
                          onClick={() => setAllocationMode('proportional')}
                          className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                            allocationMode === 'proportional'
                              ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-600 dark:text-white'
                              : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                          }`}
                        >
                          Proportional
                        </button>
                        <button
                          onClick={() => setAllocationMode('manual')}
                          className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                            allocationMode === 'manual'
                              ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-600 dark:text-white'
                              : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                          }`}
                        >
                          Manual
                        </button>
                      </div>

                      {/* Goal List */}
                      <div className="space-y-2">
                        {goalsForToAccount.map((goal) => (
                          <div
                            key={goal.id}
                            className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-700/50"
                          >
                            <div>
                              <p className="text-sm font-medium text-slate-900 dark:text-white">
                                {goal.name}
                              </p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                ${goal.currentBalance.toLocaleString()} / ${goal.targetAmount.toLocaleString()}
                              </p>
                            </div>
                            {allocationMode === 'proportional' ? (
                              <span className="font-[JetBrains_Mono,monospace] text-sm font-medium text-emerald-600 dark:text-emerald-400">
                                ${(proportionalAllocations[goal.id] || 0).toFixed(2)}
                              </span>
                            ) : (
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={manualAllocations[goal.id] || ''}
                                onChange={(e) =>
                                  setManualAllocations({
                                    ...manualAllocations,
                                    [goal.id]: parseFloat(e.target.value) || 0,
                                  })
                                }
                                placeholder="0.00"
                                className="w-24 rounded-md border border-slate-200 px-2 py-1 text-right font-[JetBrains_Mono,monospace] text-sm outline-none focus:border-emerald-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                              />
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Unallocated remainder for manual mode */}
                      {allocationMode === 'manual' && (
                        <div className="text-right text-xs text-slate-500 dark:text-slate-400">
                          Unallocated: $
                          {Math.max(
                            0,
                            (parseFloat(amount) || 0) -
                              Object.values(manualAllocations).reduce(
                                (sum, v) => sum + (v || 0),
                                0
                              )
                          ).toFixed(2)}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Actions */}
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
          >
            {isEditMode ? 'Save Changes' : 'Create Transaction'}
          </button>
        </div>
      </div>
    </div>
  )
}
