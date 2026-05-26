'use client'

import { useState, type CSSProperties } from 'react'
import type { BudgetDrawerProps } from './types'
import { X, Info } from 'lucide-react'
import { Button, Progress } from '@/components/ui'

const statLabel: CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--fg3)', marginBottom: 4 }
const sectionLabel: CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--fg3)' }
const statBox: CSSProperties = { padding: 16, borderRadius: 12, background: 'rgba(255,255,255,0.03)' }
const rowBox: CSSProperties = { padding: 12, borderRadius: 10, background: 'rgba(255,255,255,0.03)' }

export function BudgetDrawer({ budget, goal, contributions, transactions, isOpen, onClose, onSaveBudget, onSaveGoal, onDelete, onArchiveGoal }: BudgetDrawerProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editAmount, setEditAmount] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const item = budget ?? goal
  if (!item) return null

  const isSinkingFund = !!goal
  const id = budget?.id ?? goal?.id ?? ''
  const name = budget?.name ?? goal?.name ?? ''

  const filteredTransactions = transactions.filter((t) => {
    if (budget) return budget.subcategoryId ? t.subcategoryId === budget.subcategoryId : t.categoryId === budget.categoryId
    if (goal) return t.goalId === goal.id || t.subcategoryId === goal.subcategoryId
    return false
  })

  const handleStartEdit = () => {
    setEditAmount(budget ? budget.budgeted.toString() : goal ? goal.targetAmount.toString() : '')
    setIsEditing(true)
  }

  const handleSave = () => {
    const amount = parseFloat(editAmount)
    if (isNaN(amount) || amount <= 0) return
    if (budget) onSaveBudget?.(id, { budgeted: amount })
    else if (goal) onSaveGoal?.(goal.id, { targetAmount: amount })
    setIsEditing(false)
  }

  const handleDelete = () => {
    onDelete?.(id)
    setShowDeleteConfirm(false)
    onClose()
  }

  const handleArchive = () => {
    if (goal) {
      onArchiveGoal?.(goal.id)
      onClose()
    }
  }

  const progress = budget ? (budget.budgeted > 0 ? (budget.spent / budget.budgeted) * 100 : 0) : goal ? (goal.targetAmount > 0 ? (goal.currentBalance / goal.targetAmount) * 100 : 0) : 0
  const over = !!budget && budget.spent > budget.budgeted
  const complete = !!goal && goal.currentBalance >= goal.targetAmount
  const editControl: CSSProperties = { width: '100%', borderRadius: 8, padding: '4px 8px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--card-border)', color: 'var(--fg)', fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600, outline: 'none', colorScheme: 'dark' }

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)' }}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`fixed bottom-0 right-0 top-0 z-50 w-full max-w-md transform transition-transform duration-300 ease-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
        style={{ background: 'var(--bg2)', borderLeft: '1px solid var(--card-border)', boxShadow: '-30px 0 80px -30px rgba(0,0,0,0.7)' }}
      >
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6" style={{ borderBottom: '1px solid var(--card-border)' }}>
            <div className="flex items-center gap-3">
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, color: 'var(--fg)' }}>{name}</h2>
              {isSinkingFund && (
                <span className="rounded px-2 py-0.5" style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', background: 'var(--accent-soft)', color: 'var(--accent-a)' }}>
                  Sinking Fund
                </span>
              )}
            </div>
            <button onClick={onClose} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ color: 'var(--fg3)', background: 'rgba(255,255,255,0.04)' }}>
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* Stats */}
            <div className="mb-8 grid grid-cols-2 gap-4">
              {budget && (
                <>
                  <div style={statBox}>
                    <p style={statLabel}>Budgeted</p>
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <span style={{ color: 'var(--fg3)' }}>$</span>
                        <input type="number" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} style={editControl} autoFocus />
                      </div>
                    ) : (
                      <p style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600, color: 'var(--fg)' }}>${budget.budgeted.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                    )}
                  </div>
                  <div style={statBox}>
                    <p style={statLabel}>Spent</p>
                    <p style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600, color: over ? 'var(--warn)' : 'var(--fg)' }}>${budget.spent.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                  </div>
                </>
              )}

              {goal && (
                <>
                  <div style={statBox}>
                    <p style={statLabel}>Target</p>
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <span style={{ color: 'var(--fg3)' }}>$</span>
                        <input type="number" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} style={editControl} autoFocus />
                      </div>
                    ) : (
                      <p style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600, color: 'var(--fg)' }}>${goal.targetAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                    )}
                  </div>
                  <div style={statBox}>
                    <p style={statLabel}>Saved</p>
                    <p style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600, color: complete ? 'var(--good)' : 'var(--fg)' }}>${goal.currentBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                  </div>
                </>
              )}
            </div>

            {/* Goal details */}
            {goal && (
              <div className="mb-8 rounded-xl p-4" style={{ background: 'var(--accent-soft)', border: '1px solid rgba(125,211,252,0.25)' }}>
                <div className="mb-2 flex items-center gap-2">
                  <Info className="h-4 w-4" style={{ color: 'var(--accent-a)' }} />
                  <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500, color: 'var(--accent-a)' }}>Sinking Fund Details</p>
                </div>
                <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--fg2)' }}>
                  Contributing ${goal.monthlyContribution}/month to <span style={{ fontWeight: 500, color: 'var(--fg)' }}>{goal.linkedAccountName}</span>
                </p>
                {goal.targetDate && (
                  <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--fg2)', marginTop: 4 }}>
                    Target date: {new Date(goal.targetDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </p>
                )}
              </div>
            )}

            {/* Progress */}
            <div className="mb-8">
              <div className="mb-2 flex items-center justify-between">
                <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500, color: 'var(--fg2)' }}>Progress</p>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 500, color: 'var(--fg)' }}>{Math.round(progress)}%</p>
              </div>
              <Progress value={Math.min(progress, 100)} height={12} color={over ? 'var(--bad)' : complete ? 'var(--good)' : 'var(--accent-gradient)'} />
            </div>

            {/* Contribution history */}
            {goal && contributions.length > 0 && (
              <div className="mb-8">
                <h3 className="mb-4" style={sectionLabel}>Contribution History</h3>
                <div className="space-y-3">
                  {contributions.map((contrib) => (
                    <div key={contrib.id} className="flex items-center justify-between" style={rowBox}>
                      <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--fg2)' }}>
                        {new Date(contrib.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                      <p style={{ fontFamily: 'var(--font-mono)', fontWeight: 500, color: 'var(--good)' }}>+${contrib.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Transactions */}
            <div>
              <h3 className="mb-4" style={sectionLabel}>Recent Transactions</h3>
              {filteredTransactions.length === 0 ? (
                <p className="py-8 text-center" style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--fg3)' }}>No transactions yet this month</p>
              ) : (
                <div className="space-y-3">
                  {filteredTransactions.map((txn) => (
                    <div key={txn.id} className="flex items-center justify-between" style={rowBox}>
                      <div className="min-w-0 flex-1">
                        <p className="truncate" style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500, color: 'var(--fg)' }}>{txn.description}</p>
                        <p style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--fg3)' }}>
                          {new Date(txn.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          {txn.accountName && ` · ${txn.accountName}`}
                        </p>
                      </div>
                      <p style={{ fontFamily: 'var(--font-mono)', fontWeight: 500, color: txn.isContribution ? 'var(--good)' : 'var(--fg)' }}>
                        {txn.isContribution ? '+' : '-'}${txn.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="p-6" style={{ borderTop: '1px solid var(--card-border)' }}>
            {isEditing ? (
              <div className="flex gap-3">
                <Button variant="secondary" fullWidth onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
                <Button variant="primary" fullWidth onClick={handleSave}>
                  Save Changes
                </Button>
              </div>
            ) : showDeleteConfirm ? (
              <div className="space-y-3">
                <p className="text-center" style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--fg2)' }}>
                  Delete this {isSinkingFund ? 'sinking fund' : 'budget'}?
                </p>
                <div className="flex gap-3">
                  <Button variant="secondary" fullWidth onClick={() => setShowDeleteConfirm(false)}>
                    Cancel
                  </Button>
                  <Button variant="danger" fullWidth onClick={handleDelete}>
                    Delete
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-3">
                <Button variant="danger" onClick={() => setShowDeleteConfirm(true)}>
                  Delete
                </Button>
                {isSinkingFund && goal?.status === 'active' && (
                  <Button variant="secondary" onClick={handleArchive}>
                    Archive Goal
                  </Button>
                )}
                <Button variant="primary" fullWidth onClick={handleStartEdit}>
                  Edit {isSinkingFund ? 'Goal' : 'Budget'}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
