// =============================================================================
// Core Entity Types
// =============================================================================

export interface User {
  id: string
  firstName: string
  lastName: string
  email: string
  preferredLanguage: 'en' | 'es'
  subscriptionTier: 'free' | 'pro'
  createdAt: string
  updatedAt: string
}

// =============================================================================
// Account Types
// =============================================================================

export type AccountType = 'checking' | 'savings' | 'credit_card' | 'loan' | 'wallet'
export type Currency = 'USD' | 'EUR' | 'GBP' | string
export type PaymentFrequency = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annually'

interface BaseAccount {
  id: string
  userId: string
  type: AccountType
  name: string
  balance: number
  createdAt: string
  updatedAt: string
}

export interface CheckingAccount extends BaseAccount {
  type: 'checking'
  beneficiaryName: string
  institutionId?: string
  accountNumber?: string
  currency: Currency
  interestRate?: number
  hasDebitCard?: boolean
}

export interface SavingsAccount extends BaseAccount {
  type: 'savings'
  beneficiaryName: string
  institutionId?: string
  accountNumber?: string
  currency: Currency
  interestRate?: number
}

export interface CreditCardAccount extends BaseAccount {
  type: 'credit_card'
  providerId: string
  institutionId: string
  last4Digits: string
  expirationDate: string
  cutoffDate: number
  paymentDate: number
  interestRate: number
  creditLimit: number
}

export interface LoanAccount extends BaseAccount {
  type: 'loan'
  institutionId?: string
  originalAmount: number
  interestRate: number
  paymentAmount: number
  paymentFrequency: PaymentFrequency
  dueDay?: number
  termMonths: number
  originationDate?: string
  maturityDate: string
}

export interface WalletAccount extends BaseAccount {
  type: 'wallet'
  icon: string
  currency: Currency
}

export type Account =
  | CheckingAccount
  | SavingsAccount
  | CreditCardAccount
  | LoanAccount
  | WalletAccount

// =============================================================================
// Transaction Types
// =============================================================================

export type TransactionType = 'expense' | 'income' | 'transfer'
export type TransactionSource = 'manual' | 'whatsapp' | 'email'

export interface Transaction {
  id: string
  userId: string
  type: TransactionType
  amount: number
  description: string
  date: string
  fromAccountId?: string
  toAccountId?: string
  categoryId?: string
  merchantId?: string
  goalId?: string
  source: TransactionSource
  createdAt: string
  updatedAt: string
}

// =============================================================================
// Category Types
// =============================================================================

export interface Category {
  id: string
  userId?: string // null for system categories
  name: string
  parentId?: string
  color: string
  icon: string
  type: 'income' | 'expense'
  isSystem: boolean
  createdAt: string
  updatedAt: string
}

// =============================================================================
// Merchant Types
// =============================================================================

export interface Merchant {
  id: string
  userId?: string // null for global merchants
  name: string
  defaultCategoryId?: string
  isGlobal: boolean
  createdAt: string
  updatedAt: string
}

// =============================================================================
// Budget Types
// =============================================================================

export type BudgetType = 'monthly' | 'sinking_fund'

export interface Budget {
  id: string
  userId: string
  categoryId: string
  type: BudgetType
  amount: number
  linkedGoalId?: string
  createdAt: string
  updatedAt: string
}

// =============================================================================
// Goal Types
// =============================================================================

export type GoalStatus = 'active' | 'completed' | 'archived'

export interface Goal {
  id: string
  userId: string
  name: string
  categoryId: string
  linkedBudgetId: string
  linkedAccountId: string
  targetAmount: number
  targetDate: string
  currentBalance: number
  status: GoalStatus
  createdAt: string
  updatedAt: string
}

export interface GoalContribution {
  id: string
  goalId: string
  transactionId: string
  amount: number
  date: string
  createdAt: string
}

// =============================================================================
// Reference Data Types
// =============================================================================

export interface Institution {
  id: string
  name: string
  country: string
  logo?: string
}

export interface CreditCardProvider {
  id: string
  name: string
  icon: string
}

// =============================================================================
// Subscription Types
// =============================================================================

export type SubscriptionTier = 'free' | 'pro'

export interface UserSubscription {
  id: string
  userId: string
  tier: SubscriptionTier
  startDate: string
  endDate?: string
  createdAt: string
}
