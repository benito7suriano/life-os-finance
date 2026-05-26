'use client'

import { useState, useMemo, type CSSProperties } from 'react'
import type { CreateBudgetModalProps } from './types'
import { X } from 'lucide-react'
import { Button } from '@/components/ui'

const label: CSSProperties = { display: 'block', marginBottom: 6, fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--fg3)' }
const control: CSSProperties = { width: '100%', height: 42, borderRadius: 10, padding: '0 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--card-border)', color: 'var(--fg)', fontFamily: 'var(--font-sans)', fontSize: 14, outline: 'none', colorScheme: 'dark' }

export function CreateBudgetModal({ categories, savingsAccounts, categoryAverages = {}, isOpen, onClose, onCreateBudget, onCreateSinkingFund }: CreateBudgetModalProps) {
  const [budgetType, setBudgetType] = useState<'monthly' | 'sinking_fund'>('monthly')
  const [selectedCategoryId, setSelectedCategoryId] = useState('')
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string | null>(null)
  const [amount, setAmount] = useState('')
  const [amountTouched, setAmountTouched] = useState(false)
  const [targetAmount, setTargetAmount] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [goalName, setGoalName] = useState('')
  const [linkedAccountId, setLinkedAccountId] = useState('')

  const selectedCategory = categories.find((c) => c.id === selectedCategoryId)

  const avgFor = (categoryId: string, subcategoryId: string | null) => {
    const id = subcategoryId ?? categoryId
    const avg = id ? categoryAverages[id] : undefined
    return avg && avg > 0 ? avg : null
  }
  const suggestedAmount = avgFor(selectedCategoryId, selectedSubcategoryId)

  const applySuggestion = (categoryId: string, subcategoryId: string | null) => {
    if (amountTouched) return
    const avg = avgFor(categoryId, subcategoryId)
    setAmount(avg != null ? String(avg) : '')
  }

  const calculatedMonthly = useMemo(() => {
    const target = parseFloat(targetAmount)
    if (isNaN(target) || target <= 0 || !targetDate) return null
    const now = new Date()
    const end = new Date(targetDate)
    const monthsLeft = Math.max(1, (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth()))
    return Math.round((target / monthsLeft) * 100) / 100
  }, [targetAmount, targetDate])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (budgetType === 'monthly') {
      const budgetAmount = parseFloat(amount)
      if (isNaN(budgetAmount) || budgetAmount <= 0) return
      const name = selectedSubcategoryId
        ? selectedCategory?.subcategories.find((s) => s.id === selectedSubcategoryId)?.name ?? ''
        : selectedCategory?.name ?? ''
      onCreateBudget?.({ categoryId: selectedCategoryId, subcategoryId: selectedSubcategoryId, name, type: 'monthly', budgeted: budgetAmount, isCategory: !selectedSubcategoryId })
    } else {
      const target = parseFloat(targetAmount)
      if (isNaN(target) || target <= 0 || !targetDate || !linkedAccountId) return
      onCreateSinkingFund?.({ categoryId: selectedCategoryId, subcategoryId: selectedSubcategoryId, name: goalName || selectedCategory?.name || '', targetAmount: target, targetDate, linkedAccountId })
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

  const segBtn = (active: boolean): CSSProperties => ({
    flex: 1,
    borderRadius: 8,
    padding: '10px 12px',
    border: 'none',
    cursor: 'pointer',
    background: active ? 'var(--accent-soft)' : 'transparent',
    color: active ? 'var(--accent-a)' : 'var(--fg3)',
    fontFamily: 'var(--font-sans)',
    fontSize: 13,
    fontWeight: 500,
  })

  return (
    <>
      <div className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)' }} onClick={handleClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="w-full max-w-lg overflow-hidden"
          style={{ background: 'var(--bg2)', border: '1px solid var(--card-border)', borderRadius: 18, boxShadow: '0 40px 100px -30px rgba(0,0,0,0.7)' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6" style={{ borderBottom: '1px solid var(--card-border)' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, color: 'var(--fg)' }}>Create New Budget</h2>
            <button onClick={handleClose} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ color: 'var(--fg3)', background: 'rgba(255,255,255,0.04)' }}>
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6 p-6">
            {/* Budget Type toggle */}
            <div>
              <label style={label}>Budget Type</label>
              <div className="flex gap-1 rounded-xl p-1" style={{ background: 'rgba(255,255,255,0.04)' }}>
                <button type="button" onClick={() => setBudgetType('monthly')} style={segBtn(budgetType === 'monthly')}>
                  <span className="block">Monthly Budget</span>
                  <span className="block" style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>Resets each month</span>
                </button>
                <button type="button" onClick={() => setBudgetType('sinking_fund')} style={segBtn(budgetType === 'sinking_fund')}>
                  <span className="block">Sinking Fund</span>
                  <span className="block" style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>Accumulates over time</span>
                </button>
              </div>
            </div>

            {/* Category */}
            <div>
              <label style={label}>Category</label>
              <select
                value={selectedCategoryId}
                onChange={(e) => {
                  setSelectedCategoryId(e.target.value)
                  setSelectedSubcategoryId(null)
                  applySuggestion(e.target.value, null)
                }}
                style={control}
                required
              >
                <option value="">Select a category...</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Subcategory */}
            {selectedCategory && selectedCategory.subcategories.length > 0 && (
              <div>
                <label style={label}>
                  Subcategory <span style={{ color: 'var(--fg4)' }}>(optional)</span>
                </label>
                <select
                  value={selectedSubcategoryId ?? ''}
                  onChange={(e) => {
                    const sub = e.target.value || null
                    setSelectedSubcategoryId(sub)
                    applySuggestion(selectedCategoryId, sub)
                  }}
                  style={control}
                >
                  <option value="">Budget entire category</option>
                  {selectedCategory.subcategories.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Monthly amount */}
            {budgetType === 'monthly' && (
              <div>
                <label style={label}>Monthly Budget Amount</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--fg3)', fontFamily: 'var(--font-mono)', fontSize: 14 }}>$</span>
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
                    style={{ ...control, paddingLeft: 26, fontFamily: 'var(--font-mono)' }}
                    required
                  />
                </div>
                {suggestedAmount != null && (
                  <p style={{ marginTop: 8, fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--fg3)' }}>
                    Avg last 12 mo:{' '}
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg2)' }}>${suggestedAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  </p>
                )}
              </div>
            )}

            {/* Sinking fund fields */}
            {budgetType === 'sinking_fund' && (
              <>
                <div>
                  <label style={label}>Goal Name</label>
                  <input type="text" value={goalName} onChange={(e) => setGoalName(e.target.value)} placeholder="e.g., Summer Vacation" style={control} required />
                </div>

                <div>
                  <label style={label}>Savings Account</label>
                  <select value={linkedAccountId} onChange={(e) => setLinkedAccountId(e.target.value)} style={control} required>
                    <option value="">Select a savings account...</option>
                    {savingsAccounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} (${acc.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label style={label}>Target Amount</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--fg3)', fontFamily: 'var(--font-mono)', fontSize: 14 }}>$</span>
                      <input type="number" value={targetAmount} onChange={(e) => setTargetAmount(e.target.value)} placeholder="0.00" step="0.01" min="0" style={{ ...control, paddingLeft: 26, fontFamily: 'var(--font-mono)' }} required />
                    </div>
                  </div>
                  <div>
                    <label style={label}>Target Date</label>
                    <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} min={new Date().toISOString().split('T')[0]} style={control} required />
                  </div>
                </div>

                {calculatedMonthly !== null && (
                  <div className="rounded-xl p-4" style={{ background: 'var(--accent-soft)', border: '1px solid rgba(125,211,252,0.25)' }}>
                    <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--accent-a)' }}>
                      Estimated monthly contribution: <span style={{ fontWeight: 600 }}>${calculatedMonthly.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    </p>
                  </div>
                )}
              </>
            )}

            {/* Submit */}
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="secondary" fullWidth onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" fullWidth>
                Create {budgetType === 'monthly' ? 'Budget' : 'Sinking Fund'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}
