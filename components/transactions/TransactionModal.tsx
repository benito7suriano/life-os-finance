'use client'

import { useState, useEffect, type CSSProperties } from 'react'
import type { TransactionModalProps, TransactionFormData, GoalSummary, AllocationMode } from './types'
import { X } from 'lucide-react'
import { Button, Toggle } from '@/components/ui'

const fieldLabel: CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  fontWeight: 500,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: 'var(--fg3)',
  display: 'block',
  marginBottom: 6,
}

const control: CSSProperties = {
  height: 40,
  width: '100%',
  borderRadius: 10,
  padding: '0 12px',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid var(--card-border)',
  color: 'var(--fg)',
  fontFamily: 'var(--font-sans)',
  fontSize: 14,
  outline: 'none',
  colorScheme: 'dark',
}

const errorText: CSSProperties = { marginTop: 4, fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--bad)' }

function segBtn(active: boolean): CSSProperties {
  return {
    flex: 1,
    borderRadius: 8,
    padding: '8px 12px',
    fontFamily: 'var(--font-sans)',
    fontSize: 13,
    fontWeight: 500,
    textTransform: 'capitalize',
    cursor: 'pointer',
    border: 'none',
    background: active ? 'var(--accent-soft)' : 'transparent',
    color: active ? 'var(--accent-a)' : 'var(--fg3)',
    transition: 'background .15s, color .15s',
  }
}

export function TransactionModal({ isOpen, onClose, onSave, categories, accounts, goalsByAccount, editTransaction }: TransactionModalProps) {
  const isEditMode = !!editTransaction

  const [type, setType] = useState<'expense' | 'income' | 'transfer'>(editTransaction?.type || 'expense')
  const [date, setDate] = useState(editTransaction?.date || new Date().toISOString().split('T')[0])
  const [description, setDescription] = useState(editTransaction?.description || '')
  const [amount, setAmount] = useState(editTransaction ? String(Math.abs(editTransaction.amount)) : '')
  const [categoryId, setCategoryId] = useState(editTransaction?.categoryId || '')
  const [accountId, setAccountId] = useState(editTransaction?.accountId || '')
  const [fromAccountId, setFromAccountId] = useState(editTransaction?.fromAccountId || '')
  const [toAccountId, setToAccountId] = useState(editTransaction?.toAccountId || '')
  const [contributeToGoals, setContributeToGoals] = useState(false)
  const [allocationMode, setAllocationMode] = useState<AllocationMode>('proportional')
  const [manualAllocations, setManualAllocations] = useState<Record<string, number>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})

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

  const toAccount = accounts.find((a) => a.id === toAccountId)
  const goalsForToAccount: GoalSummary[] =
    toAccount?.type === 'savings' ? goalsByAccount.find((g) => g.accountId === toAccountId)?.goals || [] : []
  const hasGoals = goalsForToAccount.length > 0

  const filteredCategories = categories.filter((c) => {
    if (type === 'expense') return c.type === 'expense'
    if (type === 'income') return c.type === 'income'
    return false
  })

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}
    if (!description.trim()) newErrors.description = 'Description is required'
    const amountNum = parseFloat(amount)
    if (!amount || isNaN(amountNum) || amountNum <= 0) newErrors.amount = 'Amount must be greater than 0'
    if (type !== 'transfer' && !categoryId) newErrors.categoryId = 'Category is required'
    if (type !== 'transfer' && !accountId) newErrors.accountId = 'Account is required'
    if (type === 'transfer') {
      if (!fromAccountId) newErrors.fromAccountId = 'From account is required'
      if (!toAccountId) newErrors.toAccountId = 'To account is required'
      if (fromAccountId && toAccountId && fromAccountId === toAccountId) newErrors.toAccountId = 'Must be different from source account'
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

  const computeProportionalAllocations = () => {
    const amountNum = parseFloat(amount) || 0
    if (amountNum <= 0 || goalsForToAccount.length === 0) return {}
    const totalWeight = goalsForToAccount.reduce((sum, g) => sum + g.monthlyContribution, 0)
    if (totalWeight === 0) return {}
    const allocations: Record<string, number> = {}
    let remaining = amountNum
    const sorted = [...goalsForToAccount].sort((a, b) => b.monthlyContribution - a.monthlyContribution)
    sorted.forEach((goal, i) => {
      if (i !== 0) {
        const share = Math.round((goal.monthlyContribution / totalWeight) * amountNum * 100) / 100
        allocations[goal.id] = share
        remaining -= share
      }
    })
    allocations[sorted[0].id] = Math.round(remaining * 100) / 100
    return allocations
  }

  const proportionalAllocations = computeProportionalAllocations()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4">
      {/* Backdrop */}
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)' }} onClick={onClose} />

      {/* Modal */}
      <div
        className="relative my-8 w-full max-w-lg p-6"
        style={{ background: 'var(--bg2)', border: '1px solid var(--card-border)', borderRadius: 18, boxShadow: '0 40px 100px -30px rgba(0,0,0,0.7)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, color: 'var(--fg)' }}>
            {isEditMode ? 'Edit Transaction' : 'New Transaction'}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-lg"
            style={{ color: 'var(--fg3)', background: 'rgba(255,255,255,0.04)' }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Type tabs */}
        <div className="mt-4 flex gap-1 rounded-xl p-1" style={{ background: 'rgba(255,255,255,0.04)' }}>
          {(['expense', 'income', 'transfer'] as const).map((tab) => (
            <button key={tab} onClick={() => setType(tab)} style={segBtn(type === tab)}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Fields */}
        <div className="mt-6 space-y-4">
          {/* Date */}
          <div>
            <label htmlFor="txn-date" style={fieldLabel}>
              Date
            </label>
            <input id="txn-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} style={control} />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="txn-description" style={fieldLabel}>
              Description
            </label>
            <input
              id="txn-description"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter description"
              style={control}
            />
            {errors.description && <p style={errorText}>{errors.description}</p>}
          </div>

          {/* Amount */}
          <div>
            <label htmlFor="txn-amount" style={fieldLabel}>
              Amount
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--fg3)', fontFamily: 'var(--font-mono)', fontSize: 14 }}>
                $
              </span>
              <input
                id="txn-amount"
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                style={{ ...control, paddingLeft: 26, fontFamily: 'var(--font-mono)' }}
              />
            </div>
            {errors.amount && <p style={errorText}>{errors.amount}</p>}
          </div>

          {/* Category / Account (non-transfer) */}
          {type !== 'transfer' && (
            <div>
              <label htmlFor="txn-category" style={fieldLabel}>
                Category
              </label>
              <select id="txn-category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} style={control}>
                <option value="">Select category</option>
                {filteredCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
              {errors.categoryId && <p style={errorText}>{errors.categoryId}</p>}
            </div>
          )}

          {type !== 'transfer' && (
            <div>
              <label htmlFor="txn-account" style={fieldLabel}>
                Account
              </label>
              <select id="txn-account" value={accountId} onChange={(e) => setAccountId(e.target.value)} style={control}>
                <option value="">Select account</option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name}
                  </option>
                ))}
              </select>
              {errors.accountId && <p style={errorText}>{errors.accountId}</p>}
            </div>
          )}

          {/* Transfer */}
          {type === 'transfer' && (
            <>
              <div>
                <label htmlFor="txn-from-account" style={fieldLabel}>
                  From Account
                </label>
                <select id="txn-from-account" value={fromAccountId} onChange={(e) => setFromAccountId(e.target.value)} style={control}>
                  <option value="">Select account</option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name}
                    </option>
                  ))}
                </select>
                {errors.fromAccountId && <p style={errorText}>{errors.fromAccountId}</p>}
              </div>

              <div>
                <label htmlFor="txn-to-account" style={fieldLabel}>
                  To Account
                </label>
                <select id="txn-to-account" value={toAccountId} onChange={(e) => setToAccountId(e.target.value)} style={control}>
                  <option value="">Select account</option>
                  {accounts
                    .filter((acc) => acc.id !== fromAccountId)
                    .map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name}
                      </option>
                    ))}
                </select>
                {errors.toAccountId && <p style={errorText}>{errors.toAccountId}</p>}
              </div>

              {/* Goal allocation */}
              {hasGoals && (
                <div className="rounded-xl p-4" style={{ border: '1px solid var(--card-border)' }}>
                  <Toggle checked={contributeToGoals} onChange={setContributeToGoals} label="Contribute to goals" />

                  {contributeToGoals && (
                    <div className="mt-4 space-y-3">
                      {/* Mode toggle */}
                      <div className="flex gap-1 rounded-lg p-1" style={{ background: 'rgba(255,255,255,0.04)' }}>
                        <button onClick={() => setAllocationMode('proportional')} style={{ ...segBtn(allocationMode === 'proportional'), padding: '6px 12px', fontSize: 12 }}>
                          Proportional
                        </button>
                        <button onClick={() => setAllocationMode('manual')} style={{ ...segBtn(allocationMode === 'manual'), padding: '6px 12px', fontSize: 12 }}>
                          Manual
                        </button>
                      </div>

                      {/* Goal list */}
                      <div className="space-y-2">
                        {goalsForToAccount.map((goal) => (
                          <div key={goal.id} className="flex items-center justify-between rounded-lg px-3 py-2" style={{ background: 'rgba(255,255,255,0.03)' }}>
                            <div>
                              <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500, color: 'var(--fg)' }}>{goal.name}</p>
                              <p style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--fg3)' }}>
                                ${goal.currentBalance.toLocaleString()} / ${goal.targetAmount.toLocaleString()}
                              </p>
                            </div>
                            {allocationMode === 'proportional' ? (
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 500, color: 'var(--accent-a)' }}>
                                ${(proportionalAllocations[goal.id] || 0).toFixed(2)}
                              </span>
                            ) : (
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={manualAllocations[goal.id] || ''}
                                onChange={(e) => setManualAllocations({ ...manualAllocations, [goal.id]: parseFloat(e.target.value) || 0 })}
                                placeholder="0.00"
                                style={{ ...control, height: 32, width: 96, padding: '0 8px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 13 }}
                              />
                            )}
                          </div>
                        ))}
                      </div>

                      {allocationMode === 'manual' && (
                        <div className="text-right" style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg3)' }}>
                          Unallocated: $
                          {Math.max(0, (parseFloat(amount) || 0) - Object.values(manualAllocations).reduce((sum, v) => sum + (v || 0), 0)).toFixed(2)}
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
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave}>
            {isEditMode ? 'Save Changes' : 'Create Transaction'}
          </Button>
        </div>
      </div>
    </div>
  )
}
