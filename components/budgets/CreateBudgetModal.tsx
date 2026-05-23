import { useState, useMemo } from 'react'
import type { CreateBudgetModalProps } from './types'

export function CreateBudgetModal({
  categories,
  savingsAccounts,
  categoryAverages = {},
  isOpen,
  onClose,
  onCreateBudget,
  onCreateSinkingFund,
}: CreateBudgetModalProps) {
  const [budgetType, setBudgetType] = useState<'monthly' | 'sinking_fund'>('monthly')
  const [selectedCategoryId, setSelectedCategoryId] = useState('')
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string | null>(null)
  const [amount, setAmount] = useState('')
  const [amountTouched, setAmountTouched] = useState(false)
  const [targetAmount, setTargetAmount] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [goalName, setGoalName] = useState('')
  const [linkedAccountId, setLinkedAccountId] = useState('')

  const selectedCategory = categories.find(c => c.id === selectedCategoryId)

  // Trailing-12-month average for a given category/subcategory selection
  const avgFor = (categoryId: string, subcategoryId: string | null) => {
    const id = subcategoryId ?? categoryId
    const avg = id ? categoryAverages[id] : undefined
    return avg && avg > 0 ? avg : null
  }
  const suggestedAmount = avgFor(selectedCategoryId, selectedSubcategoryId)

  // Prefill the amount with the suggested average unless the user has edited it
  const applySuggestion = (categoryId: string, subcategoryId: string | null) => {
    if (amountTouched) return
    const avg = avgFor(categoryId, subcategoryId)
    setAmount(avg != null ? String(avg) : '')
  }

  // Auto-calculate monthly contribution from target amount and target date
  const calculatedMonthly = useMemo(() => {
    const target = parseFloat(targetAmount)
    if (isNaN(target) || target <= 0 || !targetDate) return null

    const now = new Date()
    const end = new Date(targetDate)
    const monthsLeft = Math.max(
      1,
      (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth())
    )
    return Math.round((target / monthsLeft) * 100) / 100
  }, [targetAmount, targetDate])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (budgetType === 'monthly') {
      const budgetAmount = parseFloat(amount)
      if (isNaN(budgetAmount) || budgetAmount <= 0) return

      const name = selectedSubcategoryId
        ? selectedCategory?.subcategories.find(s => s.id === selectedSubcategoryId)?.name ?? ''
        : selectedCategory?.name ?? ''

      onCreateBudget?.({
        categoryId: selectedCategoryId,
        subcategoryId: selectedSubcategoryId,
        name,
        type: 'monthly',
        budgeted: budgetAmount,
        isCategory: !selectedSubcategoryId,
      })
    } else {
      const target = parseFloat(targetAmount)
      if (isNaN(target) || target <= 0 || !targetDate || !linkedAccountId) return

      onCreateSinkingFund?.({
        categoryId: selectedCategoryId,
        subcategoryId: selectedSubcategoryId,
        name: goalName || selectedCategory?.name || '',
        targetAmount: target,
        targetDate,
        linkedAccountId,
      })
    }

    resetForm()
    onClose()
  }

  const resetForm = () => {
    setSelectedCategoryId('')
    setSelectedSubcategoryId(null)
    setAmount('')
    setAmountTouched(false)
    setTargetAmount('')
    setTargetDate('')
    setGoalName('')
    setLinkedAccountId('')
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 dark:bg-black/40 backdrop-blur-sm z-40"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div
          className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Create New Budget
            </h2>
            <button
              onClick={handleClose}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Budget Type Toggle */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Budget Type
              </label>
              <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                <button
                  type="button"
                  onClick={() => setBudgetType('monthly')}
                  className={`
                    flex-1 px-4 py-2.5 text-sm font-medium rounded-md transition-all
                    ${budgetType === 'monthly'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400'
                    }
                  `}
                >
                  <span className="block">Monthly Budget</span>
                  <span className="block text-xs opacity-70 mt-0.5">Resets each month</span>
                </button>
                <button
                  type="button"
                  onClick={() => setBudgetType('sinking_fund')}
                  className={`
                    flex-1 px-4 py-2.5 text-sm font-medium rounded-md transition-all
                    ${budgetType === 'sinking_fund'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400'
                    }
                  `}
                >
                  <span className="block">Sinking Fund</span>
                  <span className="block text-xs opacity-70 mt-0.5">Accumulates over time</span>
                </button>
              </div>
            </div>

            {/* Category Select */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Category
              </label>
              <select
                value={selectedCategoryId}
                onChange={(e) => {
                  setSelectedCategoryId(e.target.value)
                  setSelectedSubcategoryId(null)
                  applySuggestion(e.target.value, null)
                }}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              >
                <option value="">Select a category...</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>

            {/* Subcategory Select (optional) */}
            {selectedCategory && selectedCategory.subcategories.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Subcategory <span className="text-slate-400">(optional)</span>
                </label>
                <select
                  value={selectedSubcategoryId ?? ''}
                  onChange={(e) => {
                    const sub = e.target.value || null
                    setSelectedSubcategoryId(sub)
                    applySuggestion(selectedCategoryId, sub)
                  }}
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Budget entire category</option>
                  {selectedCategory.subcategories.map(sub => (
                    <option key={sub.id} value={sub.id}>{sub.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Monthly Budget Fields */}
            {budgetType === 'monthly' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Monthly Budget Amount
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => {
                      setAmountTouched(true)
                      setAmount(e.target.value)
                    }}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    className="w-full pl-8 pr-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>
                {suggestedAmount != null && (
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    Avg last 12 mo:{' '}
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      ${suggestedAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </p>
                )}
              </div>
            )}

            {/* Sinking Fund Fields */}
            {budgetType === 'sinking_fund' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Goal Name
                  </label>
                  <input
                    type="text"
                    value={goalName}
                    onChange={(e) => setGoalName(e.target.value)}
                    placeholder="e.g., Summer Vacation"
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Savings Account
                  </label>
                  <select
                    value={linkedAccountId}
                    onChange={(e) => setLinkedAccountId(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  >
                    <option value="">Select a savings account...</option>
                    {savingsAccounts.map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} (${acc.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Target Amount
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                      <input
                        type="number"
                        value={targetAmount}
                        onChange={(e) => setTargetAmount(e.target.value)}
                        placeholder="0.00"
                        step="0.01"
                        min="0"
                        className="w-full pl-8 pr-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Target Date
                    </label>
                    <input
                      type="date"
                      value={targetDate}
                      onChange={(e) => setTargetDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      required
                    />
                  </div>
                </div>

                {/* Auto-calculated monthly contribution */}
                {calculatedMonthly !== null && (
                  <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                    <p className="text-sm text-emerald-700 dark:text-emerald-400">
                      Estimated monthly contribution: <span className="font-semibold">${calculatedMonthly.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    </p>
                  </div>
                )}
              </>
            )}

            {/* Submit */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
              >
                Create {budgetType === 'monthly' ? 'Budget' : 'Sinking Fund'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}
