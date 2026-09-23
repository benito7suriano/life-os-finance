'use client'

import { useState, useEffect, type CSSProperties } from 'react'
import type { Account, AccountType, AccountDrawerProps } from './types'
import { X, Trash2, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui'

const accountTypeLabels: Record<AccountType, string> = {
  checking: 'Checking Account',
  savings: 'Savings Account',
  credit_card: 'Credit Card',
  loan: 'Loan',
  wallet: 'Wallet / Cash',
  investment: 'Investment / Asset',
}

const accountTypeOptions: { value: AccountType; label: string }[] = [
  { value: 'checking', label: 'Checking Account' },
  { value: 'savings', label: 'Savings Account' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'loan', label: 'Loan' },
  { value: 'wallet', label: 'Wallet / Cash' },
]

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(amount)
}

// ─── shared field styles ───────────────────────────────────────────────
const label: CSSProperties = {
  display: 'block',
  marginBottom: 6,
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  fontWeight: 500,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: 'var(--fg3)',
}

const control: CSSProperties = {
  width: '100%',
  height: 42,
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

export function AccountDrawer({ account, isOpen, onClose, onSave, onDelete, onRestore, institutions, creditCardProviders }: AccountDrawerProps) {
  const isEditing = !!account
  const isArchived = !!account?.deletedAt
  const [selectedType, setSelectedType] = useState<AccountType>(account?.type || 'checking')

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset controlled drawer state when its record changes
    setSelectedType(account ? account.type : 'checking')
  }, [account, isOpen])

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const data: Record<string, unknown> = { type: selectedType }

    formData.forEach((value, key) => {
      if (value !== '') {
        if (['balance', 'interestRate', 'creditLimit', 'originalAmount', 'paymentAmount', 'cutoffDate', 'paymentDate', 'dueDay', 'termMonths'].includes(key)) {
          data[key] = parseFloat(value as string)
        } else if (key === 'hasDebitCard') {
          data[key] = value === 'true'
        } else {
          data[key] = value
        }
      }
    })

    // Debt accounts show the balance as a magnitude but store it negative;
    // re-apply the sign so saving never flips debt into an asset.
    if (['credit_card', 'loan'].includes(selectedType) && typeof data.balance === 'number' && data.balance > 0) {
      data.balance = -Math.abs(data.balance)
    }

    if (account?.id) data.id = account.id

    onSave?.(data as Partial<Account>)
    onClose()
  }

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
        className={`fixed inset-y-0 right-0 z-50 w-full max-w-lg transform transition-transform duration-300 ease-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
        style={{ background: 'var(--bg2)', borderLeft: '1px solid var(--card-border)', boxShadow: '-30px 0 80px -30px rgba(0,0,0,0.7)' }}
      >
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--card-border)' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, color: 'var(--fg)' }}>
              {isEditing ? `Edit ${accountTypeLabels[account.type]}` : 'New Account'}
            </h2>
            <button onClick={onClose} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ color: 'var(--fg3)', background: 'rgba(255,255,255,0.04)' }}>
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
            <div className="space-y-6 p-6">
              {/* Account Type (new only) */}
              {!isEditing && (
                <div>
                  <label style={label}>Account Type</label>
                  <select value={selectedType} onChange={(e) => setSelectedType(e.target.value as AccountType)} style={control}>
                    {accountTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Name */}
              <div>
                <label style={label}>Account Name</label>
                <input
                  type="text"
                  name="name"
                  defaultValue={account?.name || ''}
                  placeholder={selectedType === 'savings' ? 'e.g., Emergency Fund' : 'e.g., My Checking'}
                  style={control}
                  required
                />
              </div>

              {/* Checking & Savings */}
              {(selectedType === 'checking' || selectedType === 'savings') && (
                <>
                  <div>
                    <label style={label}>Beneficiary Name</label>
                    <input
                      type="text"
                      name="beneficiaryName"
                      defaultValue={account?.type === 'checking' || account?.type === 'savings' ? account.beneficiaryName : ''}
                      style={control}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label style={label}>Balance</label>
                      <input type="number" name="balance" step="0.01" defaultValue={account?.balance || ''} style={control} required />
                    </div>
                    <div>
                      <label style={label}>Currency</label>
                      <select name="currency" defaultValue={account?.type === 'checking' || account?.type === 'savings' ? account.currency : 'USD'} style={control}>
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                        <option value="GBP">GBP</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label style={label}>Institution (optional)</label>
                    <select name="institutionId" defaultValue={account?.type === 'checking' || account?.type === 'savings' ? account.institutionId || '' : ''} style={control}>
                      <option value="">Select institution...</option>
                      {institutions.map((inst) => (
                        <option key={inst.id} value={inst.id}>
                          {inst.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={label}>Account Number (optional)</label>
                    <input type="text" name="accountNumber" defaultValue={account?.type === 'checking' || account?.type === 'savings' ? account.accountNumber || '' : ''} style={control} />
                  </div>

                  <div>
                    <label style={label}>Interest Rate % (optional)</label>
                    <input type="number" name="interestRate" step="0.01" defaultValue={account?.type === 'checking' || account?.type === 'savings' ? account.interestRate || '' : ''} style={control} />
                  </div>

                  {selectedType === 'checking' && (
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        name="hasDebitCard"
                        value="true"
                        defaultChecked={account?.type === 'checking' ? account.hasDebitCard : false}
                        className="h-4 w-4 rounded"
                        style={{ accentColor: 'var(--accent-solid)' }}
                      />
                      <label style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--fg2)' }}>Has debit card</label>
                    </div>
                  )}
                </>
              )}

              {/* Credit Card */}
              {selectedType === 'credit_card' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label style={label}>Card Provider</label>
                      <select name="providerId" defaultValue={account?.type === 'credit_card' ? account.providerId : ''} style={control} required>
                        <option value="">Select...</option>
                        {creditCardProviders.map((provider) => (
                          <option key={provider.id} value={provider.id}>
                            {provider.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={label}>Institution</label>
                      <select name="institutionId" defaultValue={account?.type === 'credit_card' ? account.institutionId : ''} style={control} required>
                        <option value="">Select...</option>
                        {institutions.map((inst) => (
                          <option key={inst.id} value={inst.id}>
                            {inst.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label style={label}>Last 4 Digits</label>
                      <input
                        type="text"
                        name="last4Digits"
                        maxLength={4}
                        pattern="[0-9]{4}"
                        defaultValue={account?.type === 'credit_card' ? account.last4Digits : ''}
                        style={{ ...control, fontFamily: 'var(--font-mono)' }}
                        required
                      />
                    </div>
                    <div>
                      <label style={label}>Expiration Date</label>
                      <input type="month" name="expirationDate" defaultValue={account?.type === 'credit_card' ? account.expirationDate : ''} style={control} required />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label style={label}>Current Balance</label>
                      <input type="number" name="balance" step="0.01" defaultValue={account?.type === 'credit_card' ? Math.abs(account.balance) : ''} style={control} required />
                    </div>
                    <div>
                      <label style={label}>Credit Limit</label>
                      <input type="number" name="creditLimit" step="0.01" defaultValue={account?.type === 'credit_card' ? account.creditLimit : ''} style={control} required />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label style={label}>Cutoff Day</label>
                      <input type="number" name="cutoffDate" min="1" max="31" defaultValue={account?.type === 'credit_card' ? account.cutoffDate : ''} style={control} required />
                    </div>
                    <div>
                      <label style={label}>Payment Day</label>
                      <input type="number" name="paymentDate" min="1" max="31" defaultValue={account?.type === 'credit_card' ? account.paymentDate : ''} style={control} required />
                    </div>
                    <div>
                      <label style={label}>Interest %</label>
                      <input type="number" name="interestRate" step="0.01" defaultValue={account?.type === 'credit_card' ? account.interestRate : ''} style={control} required />
                    </div>
                  </div>
                </>
              )}

              {/* Loan */}
              {selectedType === 'loan' && (
                <>
                  <div>
                    <label style={label}>Institution (optional)</label>
                    <select name="institutionId" defaultValue={account?.type === 'loan' ? account.institutionId || '' : ''} style={control}>
                      <option value="">Select institution...</option>
                      {institutions.map((inst) => (
                        <option key={inst.id} value={inst.id}>
                          {inst.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label style={label}>Original Amount</label>
                      <input type="number" name="originalAmount" step="0.01" defaultValue={account?.type === 'loan' ? account.originalAmount : ''} style={control} required />
                    </div>
                    <div>
                      <label style={label}>Amount Owed</label>
                      <input type="number" name="balance" step="0.01" defaultValue={account?.type === 'loan' ? Math.abs(account.balance) : ''} style={control} required />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label style={label}>Interest Rate %</label>
                      <input type="number" name="interestRate" step="0.01" defaultValue={account?.type === 'loan' ? account.interestRate : ''} style={control} required />
                    </div>
                    <div>
                      <label style={label}>Term (months)</label>
                      <input type="number" name="termMonths" defaultValue={account?.type === 'loan' ? account.termMonths : ''} style={control} required />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label style={label}>Payment Amount</label>
                      <input type="number" name="paymentAmount" step="0.01" defaultValue={account?.type === 'loan' ? account.paymentAmount : ''} style={control} required />
                    </div>
                    <div>
                      <label style={label}>Frequency</label>
                      <select name="paymentFrequency" defaultValue={account?.type === 'loan' ? account.paymentFrequency : 'monthly'} style={control}>
                        <option value="weekly">Weekly</option>
                        <option value="biweekly">Bi-weekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="quarterly">Quarterly</option>
                        <option value="annually">Annually</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label style={label}>Origination Date</label>
                      <input type="date" name="originationDate" defaultValue={account?.type === 'loan' ? account.originationDate || '' : ''} style={control} />
                    </div>
                    <div>
                      <label style={label}>Maturity Date</label>
                      <input type="date" name="maturityDate" defaultValue={account?.type === 'loan' ? account.maturityDate : ''} style={control} required />
                    </div>
                  </div>

                  <div>
                    <label style={label}>Due Day (optional)</label>
                    <input type="number" name="dueDay" min="1" max="31" defaultValue={account?.type === 'loan' ? account.dueDay || '' : ''} style={control} />
                  </div>
                </>
              )}

              {/* Wallet */}
              {selectedType === 'wallet' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label style={label}>Balance</label>
                      <input type="number" name="balance" step="0.01" defaultValue={account?.balance || ''} style={control} required />
                    </div>
                    <div>
                      <label style={label}>Currency</label>
                      <select name="currency" defaultValue={account?.type === 'wallet' ? account.currency : 'USD'} style={control}>
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                        <option value="GBP">GBP</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label style={label}>Icon</label>
                    <select name="icon" defaultValue={account?.type === 'wallet' ? account.icon : 'wallet'} style={control}>
                      <option value="wallet">Wallet</option>
                      <option value="briefcase">Briefcase</option>
                      <option value="piggybank">Piggy Bank</option>
                    </select>
                  </div>
                </>
              )}

              {/* Linked Goals (savings, read-only) */}
              {isEditing && account?.type === 'savings' && account.linkedGoals && account.linkedGoals.length > 0 && (
                <div className="pt-4" style={{ borderTop: '1px solid var(--card-border)' }}>
                  <h3 style={{ ...label, fontSize: 11 }}>Linked Goals</h3>
                  <div className="space-y-3">
                    {account.linkedGoals.map((goal) => {
                      const progress = goal.targetAmount > 0 ? Math.round((goal.currentBalance / goal.targetAmount) * 100) : 0
                      return (
                        <div key={goal.id} className="space-y-1.5">
                          <div className="flex justify-between" style={{ fontFamily: 'var(--font-sans)', fontSize: 13 }}>
                            <span style={{ color: 'var(--fg)', fontWeight: 500 }}>{goal.name}</span>
                            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg3)' }}>
                              {formatCurrency(goal.currentBalance)} / {formatCurrency(goal.targetAmount)}
                            </span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
                            <div className="h-full rounded-full" style={{ width: `${Math.min(progress, 100)}%`, background: 'var(--accent-gradient)' }} />
                          </div>
                        </div>
                      )
                    })}
                    {account.unallocatedBalance !== undefined && (
                      <div className="flex justify-between pt-2" style={{ borderTop: '1px solid var(--card-border)', fontFamily: 'var(--font-sans)', fontSize: 13 }}>
                        <span style={{ color: 'var(--fg3)' }}>Personal savings</span>
                        <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg)', fontWeight: 500 }}>{formatCurrency(account.unallocatedBalance)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 flex items-center justify-between gap-3 px-6 py-4" style={{ borderTop: '1px solid var(--card-border)', background: 'var(--bg2)' }}>
              {isEditing && !isArchived ? (
                <Button type="button" variant="danger" icon={Trash2} onClick={() => onDelete?.(account.id)}>
                  Delete
                </Button>
              ) : isEditing && isArchived ? (
                <Button type="button" variant="accent" icon={RotateCcw} onClick={() => onRestore?.(account.id)}>
                  Restore
                </Button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-3">
                <Button type="button" variant="secondary" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary">
                  {isEditing ? 'Save Changes' : 'Create Account'}
                </Button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}
