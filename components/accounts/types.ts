// =============================================================================
// Reference Data Types
// =============================================================================

export interface Institution {
  id: string
  name: string
}

export interface CreditCardProvider {
  id: string
  name: string
  icon: string
}

// =============================================================================
// Account Types
// =============================================================================

export type AccountType = 'checking' | 'savings' | 'credit_card' | 'loan' | 'wallet' | 'investment'

export type AssetClass =
  | 'investment_fund'
  | 'business'
  | 'pension'
  | 'retirement'
  | 'real_estate'
  | 'vehicle'

export type Currency = 'USD' | 'EUR' | 'GBP' | string

export type PaymentFrequency = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annually'

/** Common fields shared by all account types */
interface BaseAccount {
  id: string
  type: AccountType
  name: string
  /** Balance in the account's native currency — for display only. */
  balance: number
  /** Native currency of this account (e.g. 'USD', 'DOP'). */
  currency: Currency
  /** USD-converted balance, computed at the API boundary. Aggregate THIS, never `balance`. */
  balanceUsd: number
  /** Change in balance over the current month, native currency (positive = increase). */
  balanceChange: number
  /** USD-converted month change. Aggregate THIS, never `balanceChange`. */
  balanceChangeUsd: number
  /** ISO timestamp when soft-deleted, undefined if active */
  deletedAt?: string
}

/** Checking account - for daily transactions */
export interface CheckingAccount extends BaseAccount {
  type: 'checking'
  beneficiaryName: string
  institutionId?: string
  institutionName?: string
  accountNumber?: string
  currency: Currency
  interestRate?: number | null
  hasDebitCard?: boolean
}

/** Goal summary for savings account breakdown */
export interface LinkedGoalSummary {
  id: string
  name: string
  /** Current saved amount for this goal */
  currentBalance: number
  /** Total target amount */
  targetAmount: number
  /** Target date (ISO string) */
  targetDate: string
  /** Goal status */
  status: 'active' | 'completed' | 'archived'
}

/** Savings account - for accumulating funds, can serve as envelope for goals */
export interface SavingsAccount extends BaseAccount {
  type: 'savings'
  beneficiaryName: string
  institutionId?: string
  institutionName?: string
  accountNumber?: string | null
  currency: Currency
  interestRate?: number
  /** Goals linked to this savings account */
  linkedGoals?: LinkedGoalSummary[]
  /** Funds not allocated to any goal (balance - sum of goal balances) */
  unallocatedBalance?: number
}

/** Credit card account - tracks spending against a credit limit */
export interface CreditCardAccount extends BaseAccount {
  type: 'credit_card'
  icon: string
  providerId: string
  providerName: string
  institutionId: string
  institutionName: string
  last4Digits: string
  expirationDate: string
  /** Day of month when statement closes */
  cutoffDate: number
  /** Day of month when payment is due */
  paymentDate: number
  interestRate: number
  creditLimit: number
  currency: Currency
}

/** Loan account - tracks debt with payment schedule */
export interface LoanAccount extends BaseAccount {
  type: 'loan'
  institutionId?: string
  institutionName?: string
  originalAmount: number
  interestRate: number
  paymentAmount: number
  paymentFrequency: PaymentFrequency
  dueDay?: number
  /** Total term in months */
  termMonths: number
  originationDate?: string
  maturityDate: string
  currency: Currency
}

/** Wallet/cash account - physical cash on hand */
export interface WalletAccount extends BaseAccount {
  type: 'wallet'
  icon: string
  currency: Currency
}

export interface InvestmentAccount extends BaseAccount {
  type: 'investment'
  assetClass: AssetClass
  currency: Currency
  institutionId?: string | null
  institutionName?: string | null
}

/** Union type for all account types */
export type Account =
  | CheckingAccount
  | SavingsAccount
  | CreditCardAccount
  | LoanAccount
  | WalletAccount
  | InvestmentAccount

// =============================================================================
// Summary Types
// =============================================================================

export interface AccountTypeSummary {
  type: AccountType
  label: string
  count: number
  totalBalance: number
}

export interface AccountsSummary {
  totalBalance: number
  byType: AccountTypeSummary[]
}

// =============================================================================
// Component Props
// =============================================================================

export interface AccountsProps {
  /** All accounts to display, grouped by type in the UI */
  accounts: Account[]
  /** Reference data for institutions */
  institutions: Institution[]
  /** Reference data for credit card providers */
  creditCardProviders: CreditCardProvider[]
  /** Called when user clicks an account card to view details */
  onViewAccount?: (id: string) => void
  /** Called when user wants to edit an account */
  onEditAccount?: (id: string) => void
  /** Called when user wants to delete an account */
  onDeleteAccount?: (id: string) => void
  /** Called when user clicks the "+ New Account" button */
  onCreateAccount?: () => void
  /** Called when user clicks a goal in a savings account detail view */
  onViewGoal?: (goalId: string) => void
  /** Called when user saves an account (create or edit) */
  onSave?: (data: Partial<Account>) => void
  /** Whether to show archived (soft-deleted) accounts */
  showArchived?: boolean
  /** Toggle handler for the "Show Archived" switch */
  onToggleArchived?: () => void
  /** Called when user restores a soft-deleted account */
  onRestoreAccount?: (id: string) => void
}

export interface AccountDrawerProps {
  /** The account to display/edit, or undefined for create mode */
  account?: Account
  /** Whether the drawer is open */
  isOpen: boolean
  /** Called when drawer should close */
  onClose: () => void
  /** Called when user saves changes (create or edit) */
  onSave?: (account: Partial<Account>) => void
  /** Called when user deletes the account */
  onDelete?: (id: string) => void
  /** Called when user restores a soft-deleted account */
  onRestore?: (id: string) => void
  /** Reference data for institution dropdown */
  institutions: Institution[]
  /** Reference data for credit card provider dropdown */
  creditCardProviders: CreditCardProvider[]
  /** Called when user clicks a goal in the savings account breakdown */
  onViewGoal?: (goalId: string) => void
}

export interface AccountCardProps {
  /** The account to display */
  account: Account
  /** For savings accounts: number of active goals linked to this account */
  linkedGoalsCount?: number
  /** Called when user clicks the card */
  onClick?: () => void
}

// =============================================================================
// Undo Toast
// =============================================================================

export interface UndoToastProps {
  /** Message to display in the toast */
  message: string
  /** Called when user clicks "Undo" */
  onUndo: () => void
  /** Called when toast auto-dismisses or is manually closed */
  onDismiss: () => void
  /** Auto-dismiss duration in milliseconds (default: 10000) */
  durationMs?: number
}
