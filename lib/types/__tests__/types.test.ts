import { describe, it, expect } from 'vitest'
import type {
  User,
  Account,
  CheckingAccount,
  SavingsAccount,
  CreditCardAccount,
  LoanAccount,
  WalletAccount,
  Transaction,
  Category,
  Merchant,
  Budget,
  Goal,
  GoalContribution,
  Institution,
  CreditCardProvider,
  UserSubscription,
  AccountType,
  TransactionType,
  BudgetType,
  GoalStatus,
} from '@/lib/types'

describe('Data Model Types', () => {
  it('should define User interface with required fields', () => {
    const user: User = {
      id: '1',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      preferredLanguage: 'en',
      subscriptionTier: 'free',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    }
    expect(user.id).toBe('1')
    expect(user.preferredLanguage).toBe('en')
  })

  it('should define Account as a discriminated union of five types', () => {
    const checking: CheckingAccount = {
      id: '1',
      userId: 'u1',
      type: 'checking',
      name: 'Main Checking',
      balance: 1000,
      beneficiaryName: 'John Doe',
      currency: 'USD',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    }
    const savings: SavingsAccount = {
      id: '2',
      userId: 'u1',
      type: 'savings',
      name: 'Savings',
      balance: 5000,
      beneficiaryName: 'John Doe',
      currency: 'USD',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    }
    const creditCard: CreditCardAccount = {
      id: '3',
      userId: 'u1',
      type: 'credit_card',
      name: 'Visa Gold',
      balance: -500,
      providerId: 'cc-001',
      institutionId: 'inst-001',
      last4Digits: '1234',
      expirationDate: '12/25',
      cutoffDate: 15,
      paymentDate: 25,
      interestRate: 18.5,
      creditLimit: 5000,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    }
    const loan: LoanAccount = {
      id: '4',
      userId: 'u1',
      type: 'loan',
      name: 'Car Loan',
      balance: -15000,
      originalAmount: 20000,
      interestRate: 8.5,
      paymentAmount: 450,
      paymentFrequency: 'monthly',
      termMonths: 48,
      maturityDate: '2027-06-01',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    }
    const wallet: WalletAccount = {
      id: '5',
      userId: 'u1',
      type: 'wallet',
      name: 'Cash',
      balance: 200,
      icon: 'wallet',
      currency: 'USD',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    }

    const accounts: Account[] = [checking, savings, creditCard, loan, wallet]
    expect(accounts).toHaveLength(5)

    const types: AccountType[] = ['checking', 'savings', 'credit_card', 'loan', 'wallet']
    expect(types).toHaveLength(5)
  })

  it('should define Transaction with all transaction types', () => {
    const expense: Transaction = {
      id: '1',
      userId: 'u1',
      type: 'expense',
      amount: 50,
      description: 'Grocery shopping',
      date: '2024-01-15',
      fromAccountId: 'acc-1',
      categoryId: 'cat-food',
      merchantId: 'm-1',
      source: 'manual',
      createdAt: '2024-01-15T00:00:00Z',
      updatedAt: '2024-01-15T00:00:00Z',
    }
    const income: Transaction = {
      id: '2',
      userId: 'u1',
      type: 'income',
      amount: 2500,
      description: 'Salary',
      date: '2024-01-01',
      toAccountId: 'acc-1',
      categoryId: 'cat-salary',
      source: 'manual',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    }
    const transfer: Transaction = {
      id: '3',
      userId: 'u1',
      type: 'transfer',
      amount: 500,
      description: 'To savings',
      date: '2024-01-05',
      fromAccountId: 'acc-1',
      toAccountId: 'acc-2',
      source: 'manual',
      createdAt: '2024-01-05T00:00:00Z',
      updatedAt: '2024-01-05T00:00:00Z',
    }

    const types: TransactionType[] = ['expense', 'income', 'transfer']
    expect(types).toHaveLength(3)
    expect(expense.type).toBe('expense')
    expect(income.type).toBe('income')
    expect(transfer.type).toBe('transfer')
  })

  it('should define Category with hierarchy support', () => {
    const parent: Category = {
      id: 'cat-food',
      name: 'Food & Dining',
      color: '#f97316',
      icon: 'utensils',
      type: 'expense',
      isSystem: true,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    }
    const child: Category = {
      id: 'cat-restaurants',
      userId: 'u1',
      name: 'Restaurants',
      parentId: 'cat-food',
      color: '#f97316',
      icon: 'utensils',
      type: 'expense',
      isSystem: false,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    }
    expect(parent.parentId).toBeUndefined()
    expect(child.parentId).toBe('cat-food')
  })

  it('should define Budget with type constraint', () => {
    const monthly: Budget = {
      id: '1',
      userId: 'u1',
      categoryId: 'c1',
      type: 'monthly',
      amount: 500,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    }
    const sinkingFund: Budget = {
      id: '2',
      userId: 'u1',
      categoryId: 'c2',
      type: 'sinking_fund',
      amount: 200,
      linkedGoalId: 'g1',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    }
    const types: BudgetType[] = ['monthly', 'sinking_fund']
    expect(types).toHaveLength(2)
    expect(monthly.linkedGoalId).toBeUndefined()
    expect(sinkingFund.linkedGoalId).toBe('g1')
  })

  it('should define Goal with status and linked entities', () => {
    const goal: Goal = {
      id: 'g1',
      userId: 'u1',
      name: 'Emergency Fund',
      categoryId: 'c1',
      linkedBudgetId: 'b1',
      linkedAccountId: 'acc-savings',
      targetAmount: 5000,
      targetDate: '2025-12-31',
      currentBalance: 1200,
      status: 'active',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    }
    const statuses: GoalStatus[] = ['active', 'completed', 'archived']
    expect(statuses).toHaveLength(3)
    expect(goal.linkedBudgetId).toBe('b1')
    expect(goal.linkedAccountId).toBe('acc-savings')
  })

  it('should define GoalContribution linking goals to transactions', () => {
    const contribution: GoalContribution = {
      id: 'gc1',
      goalId: 'g1',
      transactionId: 't1',
      amount: 300,
      date: '2024-01-15',
      createdAt: '2024-01-15T00:00:00Z',
    }
    expect(contribution.goalId).toBe('g1')
    expect(contribution.transactionId).toBe('t1')
  })

  it('should define reference data types', () => {
    const institution: Institution = {
      id: 'inst-001',
      name: 'Banco Agricola',
      country: 'SV',
    }
    const provider: CreditCardProvider = {
      id: 'cc-001',
      name: 'Visa',
      icon: 'visa',
    }
    const merchant: Merchant = {
      id: 'm1',
      name: 'Super Selectos',
      defaultCategoryId: 'cat-food',
      isGlobal: true,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    }
    expect(institution.country).toBe('SV')
    expect(provider.name).toBe('Visa')
    expect(merchant.isGlobal).toBe(true)
  })

  it('should define UserSubscription', () => {
    const sub: UserSubscription = {
      id: 's1',
      userId: 'u1',
      tier: 'pro',
      startDate: '2024-01-01',
      createdAt: '2024-01-01T00:00:00Z',
    }
    expect(sub.tier).toBe('pro')
    expect(sub.endDate).toBeUndefined()
  })
})
