// =============================================================================
// Data Types
// =============================================================================

export interface Subcategory {
  id: string
  name: string
}

export interface Category {
  id: string
  name: string
  subcategories: Subcategory[]
}

export interface Budget {
  id: string
  categoryId: string
  subcategoryId: string | null
  name: string
  type: 'monthly' | 'sinking_fund'
  budgeted: number
  spent: number
  /** False when viewing a past month in which this budget did not yet exist */
  budgetKnown?: boolean
  isCategory: boolean
  /** For sinking funds: reference to the linked Goal */
  linkedGoalId?: string
}

export interface Goal {
  id: string
  categoryId: string
  subcategoryId: string | null
  name: string
  /** The Budget this goal is linked to (sinking fund budget) */
  linkedBudgetId: string
  /** The savings account holding contributions for this goal */
  linkedAccountId: string
  linkedAccountName: string
  /** Total amount to save */
  targetAmount: number
  /** Date by which the goal should be reached (ISO date string) */
  targetDate: string
  /** Current saved amount (sum of GoalContributions) */
  currentBalance: number
  /** Calculated: (targetAmount - currentBalance) / monthsRemaining */
  monthlyContribution: number
  /** Goal lifecycle status */
  status: 'active' | 'completed' | 'archived'
}

export interface GoalContribution {
  id: string
  goalId: string
  /** The transfer transaction that funded this contribution */
  transactionId: string
  /** Portion of the transfer allocated to this goal */
  amount: number
  /** Date of the contribution */
  date: string
}

export interface MonthlyHistoryEntry {
  month: string
  budgeted: number
  spent: number
}

export interface CategorySpendingSub {
  id: string
  name: string
  spent: number
}

export interface CategorySpending {
  id: string
  name: string
  spent: number
  subcategories: CategorySpendingSub[]
}

export interface Transaction {
  id: string
  date: string
  description: string
  merchantName: string | null
  amount: number
  categoryId: string
  subcategoryId: string | null
  accountName: string
  isContribution?: boolean
  goalId?: string
}

export interface BudgetSummary {
  totalBudgeted: number
  totalSpent: number
  month: string
}

// =============================================================================
// Filter & Sort Types
// =============================================================================

export type SortField = 'name' | 'budgeted' | 'spent' | 'percentUsed'
export type SortDirection = 'asc' | 'desc'
export type BudgetTypeFilter = 'all' | 'monthly' | 'sinking_fund'

export interface FilterState {
  type: BudgetTypeFilter
  sortField: SortField
  sortDirection: SortDirection
}

// =============================================================================
// Time Range Types
// =============================================================================

export type TimeRange = '6months' | '12months' | 'all'

// =============================================================================
// Component Props
// =============================================================================

/** Available savings accounts for goal creation */
export interface SavingsAccountOption {
  id: string
  name: string
  balance: number
}

export interface BudgetsProps {
  /** Summary totals for the current month */
  summary: BudgetSummary

  /** The 16 fixed categories with their subcategories */
  categories: Category[]

  /** All budget records (both monthly and sinking fund types) */
  budgets: Budget[]

  /** Goal records (linked to sinking fund budgets) */
  goals: Goal[]

  /** Contribution history for goals */
  goalContributions: GoalContribution[]

  /** Available savings accounts for creating sinking funds */
  savingsAccounts: SavingsAccountOption[]

  /** Historical spending data for the line graph */
  monthlyHistory: MonthlyHistoryEntry[]

  /** Trailing-12-month average monthly spend, keyed by category/subcategory id */
  categoryAverages?: Record<string, number>

  /** Per-category spending for the selected month (every category, not just budgeted) */
  categorySpending?: CategorySpending[]

  /** Currently selected month in YYYY-MM form */
  selectedMonth?: string

  /** Transactions for the detail drawer */
  transactions: Transaction[]

  /** Called when user wants to view a budget's details */
  onViewBudget?: (id: string) => void

  /** Called when user wants to edit a budget */
  onEditBudget?: (id: string, updates: Partial<Budget>) => void

  /** Called when user wants to delete a budget */
  onDeleteBudget?: (id: string) => void

  /** Called when user wants to create a monthly budget */
  onCreateBudget?: (budget: Omit<Budget, 'id' | 'spent' | 'linkedGoalId'>) => void

  /** Called when user wants to create a sinking fund (creates both Budget and Goal) */
  onCreateSinkingFund?: (data: {
    categoryId: string
    subcategoryId: string | null
    name: string
    targetAmount: number
    targetDate: string
    linkedAccountId: string
  }) => void

  /** Called when user wants to view a goal's details */
  onViewGoal?: (id: string) => void

  /** Called when user wants to edit a goal */
  onEditGoal?: (id: string, updates: Partial<Goal>) => void

  /** Called when user wants to archive a goal */
  onArchiveGoal?: (id: string) => void

  /** Called when user navigates to a different month (YYYY-MM) */
  onMonthChange?: (month: string) => void

  /** Called when user changes the time range for the graph */
  onTimeRangeChange?: (range: TimeRange) => void

  /** Called when user changes filter or sort settings */
  onFilterChange?: (filter: FilterState) => void
}

// =============================================================================
// Drawer Props
// =============================================================================

export interface BudgetDrawerProps {
  /** The budget being viewed */
  budget: Budget | null

  /** The linked goal (if this is a sinking fund budget) */
  goal: Goal | null

  /** Contribution history (if this is a sinking fund) */
  contributions: GoalContribution[]

  /** Transactions related to this budget/goal */
  transactions: Transaction[]

  /** Whether the drawer is open */
  isOpen: boolean

  /** Called when the drawer should close */
  onClose: () => void

  /** Called when user saves edits to the budget */
  onSaveBudget?: (id: string, updates: Partial<Budget>) => void

  /** Called when user saves edits to the goal */
  onSaveGoal?: (id: string, updates: Partial<Goal>) => void

  /** Called when user deletes the budget (and linked goal if sinking fund) */
  onDelete?: (id: string) => void

  /** Called when user archives the goal (sinking fund only) */
  onArchiveGoal?: (id: string) => void
}

// =============================================================================
// Modal Props
// =============================================================================

export interface CreateBudgetModalProps {
  /** Available categories for selection */
  categories: Category[]

  /** Available savings accounts for sinking fund creation */
  savingsAccounts: SavingsAccountOption[]

  /** Trailing-12-month average monthly spend, keyed by category/subcategory id */
  categoryAverages?: Record<string, number>

  /** Whether the modal is open */
  isOpen: boolean

  /** Called when the modal should close */
  onClose: () => void

  /** Called when user creates a monthly budget */
  onCreateBudget?: (budget: Omit<Budget, 'id' | 'spent' | 'linkedGoalId'>) => void

  /** Called when user creates a sinking fund (creates both Budget and Goal) */
  onCreateSinkingFund?: (data: {
    categoryId: string
    subcategoryId: string | null
    name: string
    targetAmount: number
    targetDate: string
    linkedAccountId: string
  }) => void
}
