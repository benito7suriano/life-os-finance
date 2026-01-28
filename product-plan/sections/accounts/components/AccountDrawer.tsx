'use client'

import { useState, useEffect } from 'react'
import type {
  Account,
  AccountType,
  Institution,
  CreditCardProvider,
} from '../types'
import { X, Trash2 } from 'lucide-react'

interface AccountDrawerProps {
  account?: Account
  isOpen: boolean
  onClose: () => void
  onSave?: (account: Partial<Account>) => void
  onDelete?: (id: string) => void
  institutions: Institution[]
  creditCardProviders: CreditCardProvider[]
}

const accountTypeLabels: Record<AccountType, string> = {
  checking: 'Checking Account',
  savings: 'Savings Account',
  credit_card: 'Credit Card',
  loan: 'Loan',
  wallet: 'Wallet / Cash',
}

const accountTypeOptions: { value: AccountType; label: string }[] = [
  { value: 'checking', label: 'Checking Account' },
  { value: 'savings', label: 'Savings Account' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'loan', label: 'Loan' },
  { value: 'wallet', label: 'Wallet / Cash' },
]

export function AccountDrawer({
  account,
  isOpen,
  onClose,
  onSave,
  onDelete,
  institutions,
  creditCardProviders,
}: AccountDrawerProps) {
  const isEditing = !!account
  const [selectedType, setSelectedType] = useState<AccountType>(account?.type || 'checking')

  useEffect(() => {
    if (account) {
      setSelectedType(account.type)
    } else {
      setSelectedType('checking')
    }
  }, [account, isOpen])

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const data: Record<string, unknown> = {
      type: selectedType,
    }

    // Extract form fields based on type
    formData.forEach((value, key) => {
      if (value !== '') {
        // Handle numeric fields
        if (['balance', 'interestRate', 'creditLimit', 'originalAmount', 'paymentAmount', 'cutoffDate', 'paymentDate', 'dueDay', 'termMonths'].includes(key)) {
          data[key] = parseFloat(value as string)
        } else if (key === 'hasDebitCard') {
          data[key] = value === 'true'
        } else {
          data[key] = value
        }
      }
    })

    if (account?.id) {
      data.id = account.id
    }

    onSave?.(data as Partial<Account>)
    onClose()
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-white dark:bg-slate-900
                    shadow-2xl transform transition-transform duration-300 ease-out
                    ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              {isEditing ? `Edit ${accountTypeLabels[account.type]}` : 'New Account'}
            </h2>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100
                         dark:hover:text-slate-300 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
            <div className="p-6 space-y-6">
              {/* Account Type (only for new accounts) */}
              {!isEditing && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Account Type
                  </label>
                  <select
                    value={selectedType}
                    onChange={(e) => setSelectedType(e.target.value as AccountType)}
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600
                               bg-white dark:bg-slate-800 text-slate-900 dark:text-white
                               focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500
                               transition-colors"
                  >
                    {accountTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Common Fields: Name */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Account Name
                </label>
                <input
                  type="text"
                  name="name"
                  defaultValue={account?.name || ''}
                  placeholder={selectedType === 'savings' ? 'e.g., Emergency Fund' : 'e.g., My Checking'}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600
                             bg-white dark:bg-slate-800 text-slate-900 dark:text-white
                             placeholder:text-slate-400 dark:placeholder:text-slate-500
                             focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500
                             transition-colors"
                  required
                />
              </div>

              {/* Checking & Savings specific fields */}
              {(selectedType === 'checking' || selectedType === 'savings') && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Beneficiary Name
                    </label>
                    <input
                      type="text"
                      name="beneficiaryName"
                      defaultValue={
                        (account?.type === 'checking' || account?.type === 'savings')
                          ? account.beneficiaryName
                          : ''
                      }
                      className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600
                                 bg-white dark:bg-slate-800 text-slate-900 dark:text-white
                                 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500
                                 transition-colors"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Balance
                      </label>
                      <input
                        type="number"
                        name="balance"
                        step="0.01"
                        defaultValue={account?.balance || ''}
                        className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600
                                   bg-white dark:bg-slate-800 text-slate-900 dark:text-white
                                   focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500
                                   transition-colors"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Currency
                      </label>
                      <select
                        name="currency"
                        defaultValue={
                          (account?.type === 'checking' || account?.type === 'savings')
                            ? account.currency
                            : 'USD'
                        }
                        className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600
                                   bg-white dark:bg-slate-800 text-slate-900 dark:text-white
                                   focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500
                                   transition-colors"
                      >
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                        <option value="GBP">GBP</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Institution (optional)
                    </label>
                    <select
                      name="institutionId"
                      defaultValue={
                        (account?.type === 'checking' || account?.type === 'savings')
                          ? account.institutionId || ''
                          : ''
                      }
                      className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600
                                 bg-white dark:bg-slate-800 text-slate-900 dark:text-white
                                 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500
                                 transition-colors"
                    >
                      <option value="">Select institution...</option>
                      {institutions.map((inst) => (
                        <option key={inst.id} value={inst.id}>
                          {inst.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Account Number (optional)
                    </label>
                    <input
                      type="text"
                      name="accountNumber"
                      defaultValue={
                        (account?.type === 'checking' || account?.type === 'savings')
                          ? account.accountNumber || ''
                          : ''
                      }
                      className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600
                                 bg-white dark:bg-slate-800 text-slate-900 dark:text-white
                                 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500
                                 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Interest Rate % (optional)
                    </label>
                    <input
                      type="number"
                      name="interestRate"
                      step="0.01"
                      defaultValue={
                        (account?.type === 'checking' || account?.type === 'savings')
                          ? account.interestRate || ''
                          : ''
                      }
                      className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600
                                 bg-white dark:bg-slate-800 text-slate-900 dark:text-white
                                 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500
                                 transition-colors"
                    />
                  </div>

                  {selectedType === 'checking' && (
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        name="hasDebitCard"
                        value="true"
                        defaultChecked={
                          account?.type === 'checking' ? account.hasDebitCard : false
                        }
                        className="w-4 h-4 rounded border-slate-300 text-emerald-600
                                   focus:ring-emerald-500 dark:border-slate-600 dark:bg-slate-800"
                      />
                      <label className="text-sm text-slate-700 dark:text-slate-300">
                        Has debit card
                      </label>
                    </div>
                  )}
                </>
              )}

              {/* Credit Card specific fields */}
              {selectedType === 'credit_card' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Card Provider
                      </label>
                      <select
                        name="providerId"
                        defaultValue={
                          account?.type === 'credit_card' ? account.providerId : ''
                        }
                        className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600
                                   bg-white dark:bg-slate-800 text-slate-900 dark:text-white
                                   focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500
                                   transition-colors"
                        required
                      >
                        <option value="">Select...</option>
                        {creditCardProviders.map((provider) => (
                          <option key={provider.id} value={provider.id}>
                            {provider.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Institution
                      </label>
                      <select
                        name="institutionId"
                        defaultValue={
                          account?.type === 'credit_card' ? account.institutionId : ''
                        }
                        className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600
                                   bg-white dark:bg-slate-800 text-slate-900 dark:text-white
                                   focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500
                                   transition-colors"
                        required
                      >
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
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Last 4 Digits
                      </label>
                      <input
                        type="text"
                        name="last4Digits"
                        maxLength={4}
                        pattern="[0-9]{4}"
                        defaultValue={
                          account?.type === 'credit_card' ? account.last4Digits : ''
                        }
                        className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600
                                   bg-white dark:bg-slate-800 text-slate-900 dark:text-white
                                   focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500
                                   transition-colors font-mono"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Expiration Date
                      </label>
                      <input
                        type="month"
                        name="expirationDate"
                        defaultValue={
                          account?.type === 'credit_card' ? account.expirationDate : ''
                        }
                        className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600
                                   bg-white dark:bg-slate-800 text-slate-900 dark:text-white
                                   focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500
                                   transition-colors"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Current Balance
                      </label>
                      <input
                        type="number"
                        name="balance"
                        step="0.01"
                        defaultValue={
                          account?.type === 'credit_card' ? Math.abs(account.balance) : ''
                        }
                        className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600
                                   bg-white dark:bg-slate-800 text-slate-900 dark:text-white
                                   focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500
                                   transition-colors"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Credit Limit
                      </label>
                      <input
                        type="number"
                        name="creditLimit"
                        step="0.01"
                        defaultValue={
                          account?.type === 'credit_card' ? account.creditLimit : ''
                        }
                        className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600
                                   bg-white dark:bg-slate-800 text-slate-900 dark:text-white
                                   focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500
                                   transition-colors"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Cutoff Day
                      </label>
                      <input
                        type="number"
                        name="cutoffDate"
                        min="1"
                        max="31"
                        defaultValue={
                          account?.type === 'credit_card' ? account.cutoffDate : ''
                        }
                        className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600
                                   bg-white dark:bg-slate-800 text-slate-900 dark:text-white
                                   focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500
                                   transition-colors"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Payment Day
                      </label>
                      <input
                        type="number"
                        name="paymentDate"
                        min="1"
                        max="31"
                        defaultValue={
                          account?.type === 'credit_card' ? account.paymentDate : ''
                        }
                        className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600
                                   bg-white dark:bg-slate-800 text-slate-900 dark:text-white
                                   focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500
                                   transition-colors"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Interest %
                      </label>
                      <input
                        type="number"
                        name="interestRate"
                        step="0.01"
                        defaultValue={
                          account?.type === 'credit_card' ? account.interestRate : ''
                        }
                        className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600
                                   bg-white dark:bg-slate-800 text-slate-900 dark:text-white
                                   focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500
                                   transition-colors"
                        required
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Loan specific fields */}
              {selectedType === 'loan' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Institution (optional)
                    </label>
                    <select
                      name="institutionId"
                      defaultValue={
                        account?.type === 'loan' ? account.institutionId || '' : ''
                      }
                      className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600
                                 bg-white dark:bg-slate-800 text-slate-900 dark:text-white
                                 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500
                                 transition-colors"
                    >
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
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Original Amount
                      </label>
                      <input
                        type="number"
                        name="originalAmount"
                        step="0.01"
                        defaultValue={
                          account?.type === 'loan' ? account.originalAmount : ''
                        }
                        className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600
                                   bg-white dark:bg-slate-800 text-slate-900 dark:text-white
                                   focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500
                                   transition-colors"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Amount Owed
                      </label>
                      <input
                        type="number"
                        name="balance"
                        step="0.01"
                        defaultValue={
                          account?.type === 'loan' ? Math.abs(account.balance) : ''
                        }
                        className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600
                                   bg-white dark:bg-slate-800 text-slate-900 dark:text-white
                                   focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500
                                   transition-colors"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Interest Rate %
                      </label>
                      <input
                        type="number"
                        name="interestRate"
                        step="0.01"
                        defaultValue={
                          account?.type === 'loan' ? account.interestRate : ''
                        }
                        className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600
                                   bg-white dark:bg-slate-800 text-slate-900 dark:text-white
                                   focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500
                                   transition-colors"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Term (months)
                      </label>
                      <input
                        type="number"
                        name="termMonths"
                        defaultValue={
                          account?.type === 'loan' ? account.termMonths : ''
                        }
                        className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600
                                   bg-white dark:bg-slate-800 text-slate-900 dark:text-white
                                   focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500
                                   transition-colors"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Payment Amount
                      </label>
                      <input
                        type="number"
                        name="paymentAmount"
                        step="0.01"
                        defaultValue={
                          account?.type === 'loan' ? account.paymentAmount : ''
                        }
                        className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600
                                   bg-white dark:bg-slate-800 text-slate-900 dark:text-white
                                   focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500
                                   transition-colors"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Frequency
                      </label>
                      <select
                        name="paymentFrequency"
                        defaultValue={
                          account?.type === 'loan' ? account.paymentFrequency : 'monthly'
                        }
                        className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600
                                   bg-white dark:bg-slate-800 text-slate-900 dark:text-white
                                   focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500
                                   transition-colors"
                      >
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
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Origination Date
                      </label>
                      <input
                        type="date"
                        name="originationDate"
                        defaultValue={
                          account?.type === 'loan' ? account.originationDate || '' : ''
                        }
                        className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600
                                   bg-white dark:bg-slate-800 text-slate-900 dark:text-white
                                   focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500
                                   transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Maturity Date
                      </label>
                      <input
                        type="date"
                        name="maturityDate"
                        defaultValue={
                          account?.type === 'loan' ? account.maturityDate : ''
                        }
                        className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600
                                   bg-white dark:bg-slate-800 text-slate-900 dark:text-white
                                   focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500
                                   transition-colors"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Due Day (optional)
                    </label>
                    <input
                      type="number"
                      name="dueDay"
                      min="1"
                      max="31"
                      defaultValue={
                        account?.type === 'loan' ? account.dueDay || '' : ''
                      }
                      className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600
                                 bg-white dark:bg-slate-800 text-slate-900 dark:text-white
                                 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500
                                 transition-colors"
                    />
                  </div>
                </>
              )}

              {/* Wallet specific fields */}
              {selectedType === 'wallet' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Balance
                      </label>
                      <input
                        type="number"
                        name="balance"
                        step="0.01"
                        defaultValue={account?.balance || ''}
                        className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600
                                   bg-white dark:bg-slate-800 text-slate-900 dark:text-white
                                   focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500
                                   transition-colors"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Currency
                      </label>
                      <select
                        name="currency"
                        defaultValue={
                          account?.type === 'wallet' ? account.currency : 'USD'
                        }
                        className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600
                                   bg-white dark:bg-slate-800 text-slate-900 dark:text-white
                                   focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500
                                   transition-colors"
                      >
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                        <option value="GBP">GBP</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Icon
                    </label>
                    <select
                      name="icon"
                      defaultValue={
                        account?.type === 'wallet' ? account.icon : 'wallet'
                      }
                      className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600
                                 bg-white dark:bg-slate-800 text-slate-900 dark:text-white
                                 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500
                                 transition-colors"
                    >
                      <option value="wallet">Wallet</option>
                      <option value="briefcase">Briefcase</option>
                      <option value="piggybank">Piggy Bank</option>
                    </select>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 flex items-center justify-between gap-3 px-6 py-4
                            border-t border-slate-200 dark:border-slate-800
                            bg-slate-50 dark:bg-slate-900">
              {isEditing ? (
                <button
                  type="button"
                  onClick={() => onDelete?.(account.id)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg
                             text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20
                             transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-lg text-slate-600 dark:text-slate-400
                             hover:bg-slate-100 dark:hover:bg-slate-800
                             transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-lg bg-emerald-600 text-white font-medium
                             hover:bg-emerald-700 focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2
                             dark:focus:ring-offset-slate-900 transition-colors"
                >
                  {isEditing ? 'Save Changes' : 'Create Account'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}
