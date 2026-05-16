// =============================================================================
// Data Types
// =============================================================================

export interface Category {
  id: string
  name: string
  color: string
  type: 'income' | 'expense'
}

export interface Account {
  id: string
  name: string
  type: 'checking' | 'savings' | 'credit_card' | 'wallet'
  icon: string
}

/** Goal summary for transfer modal (linked to a savings account) */
export interface GoalSummary {
  id: string
  name: string
  /** Current saved amount */
  currentBalance: number
  /** Total target amount */
  targetAmount: number
  /** Target date (ISO string) */
  targetDate: string
  /** Calculated required monthly contribution */
  monthlyContribution: number
}

export interface Transaction {
  id: string
  date: string
  description: string
  categoryId: string
  accountId: string
  /** For transfers: the source account */
  fromAccountId?: string
  /** For transfers: the destination account */
  toAccountId?: string
  amount: number
  type: 'income' | 'expense' | 'transfer'
  source: 'manual' | 'whatsapp' | 'email'
  /** For transfers with goal contributions: the allocation breakdown */
  goalAllocations?: GoalAllocation[]
}

/** Allocation of a transfer amount to a specific goal */
export interface GoalAllocation {
  goalId: string
  goalName: string
  amount: number
}

export type SortField = 'date' | 'description' | 'category' | 'account' | 'amount'
export type SortDirection = 'asc' | 'desc'

export interface TransactionFilters {
  search?: string
  categoryIds?: string[]
  accountIds?: string[]
  sources?: ('manual' | 'whatsapp' | 'email')[]
  dateRange?: {
    start: string
    end: string
  }
}

export interface TransactionSummary {
  count: number
  totalIncome: number
  totalExpenses: number
}

// =============================================================================
// Component Props
// =============================================================================

/** Goals linked to a savings account, for the transfer modal */
export interface AccountGoals {
  accountId: string
  goals: GoalSummary[]
}

export interface TransactionsProps {
  /** The list of transactions to display */
  transactions: Transaction[]
  /** Available categories for filtering and display */
  categories: Category[]
  /** Available accounts for filtering and display */
  accounts: Account[]
  /** Goals grouped by savings account (for transfer modal) */
  goalsByAccount: AccountGoals[]
  /** Summary stats for the current filtered view */
  summary: TransactionSummary
  /** Current page number (1-indexed) */
  currentPage: number
  /** Total number of pages */
  totalPages: number
  /** Current sort configuration */
  sortField?: SortField
  /** Current sort direction */
  sortDirection?: SortDirection
  /** Current active filters */
  filters?: TransactionFilters
  /** Called when user clicks the "+ New Transaction" button */
  onCreate?: () => void
  /** Called when user wants to edit a transaction */
  onEdit?: (id: string) => void
  /** Called when user wants to delete a transaction */
  onDelete?: (id: string) => void
  /** Called when user changes the page */
  onPageChange?: (page: number) => void
  /** Called when user clicks a column header to sort */
  onSort?: (field: SortField, direction: SortDirection) => void
  /** Called when user changes filter values */
  onFilterChange?: (filters: TransactionFilters) => void
  /** Called when user types in the search bar */
  onSearch?: (query: string) => void
}

// =============================================================================
// Transfer Modal Types
// =============================================================================

export type AllocationMode = 'proportional' | 'manual'

export interface TransferFormData {
  date: string
  description: string
  amount: number
  fromAccountId: string
  toAccountId: string
  /** Whether to allocate this transfer to goals */
  contributeToGoals: boolean
  /** How to allocate: proportionally by weight or manual amounts */
  allocationMode?: AllocationMode
  /** Manual allocation amounts by goal ID */
  manualAllocations?: Record<string, number>
}

export interface TransferModalProps {
  /** Whether the modal is open */
  isOpen: boolean
  /** Called when the modal should close */
  onClose: () => void
  /** Available accounts for source/destination */
  accounts: Account[]
  /** Goals grouped by savings account */
  goalsByAccount: AccountGoals[]
  /** Called when user saves the transfer */
  onSave?: (data: TransferFormData) => void
}
