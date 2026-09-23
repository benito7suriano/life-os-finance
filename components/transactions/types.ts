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
  type: 'checking' | 'savings' | 'credit_card' | 'loan' | 'wallet' | 'investment'
  icon: string
  /** Native currency of this account (e.g. 'USD', 'DOP'). */
  currency?: string
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
  /** Signed amount in the transaction's native currency — for display only. */
  amount: number
  /** Native currency of this transaction (e.g. 'USD', 'DOP'). */
  currency: string
  /** USD-converted signed amount, computed at the API boundary. Aggregate THIS, never `amount`. */
  amountUsd: number
  /** For cross-currency transfers: amount credited to the destination, in `toCurrency`. */
  toAmount?: number
  /** For cross-currency transfers: currency of the destination leg. */
  toCurrency?: string
  type: 'income' | 'expense' | 'transfer'
  source: 'manual' | 'import' | 'telegram'
  /** For transfers with goal contributions: the allocation breakdown */
  goalAllocations?: GoalAllocation[]
  relatedAssetId?: string
  assetActivityKind?: import('@/lib/assets/types').AssetActivityKind
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
  sources?: ('manual' | 'import' | 'telegram')[]
  types?: ('expense' | 'income' | 'transfer')[]
  dateRange?: {
    start: string
    end: string
  }
}

export interface TransactionSummary {
  count: number
  /** Total income for the filtered view, converted to USD. */
  totalIncomeUsd: number
  /** Total expenses for the filtered view, converted to USD. */
  totalExpensesUsd: number
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
  /** Current search query (for empty state messaging) */
  searchQuery?: string
  /** Whether there are any transactions at all (unfiltered) */
  hasAnyTransactions?: boolean
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
  /** Called when user clicks "Clear filters" in empty state */
  onClearFilters?: () => void
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

export interface TransactionFormData {
  type: 'expense' | 'income' | 'transfer'
  date: string
  description: string
  amount: number
  categoryId?: string
  accountId?: string
  fromAccountId?: string
  toAccountId?: string
  /** Cross-currency transfer: amount credited to the destination, in `toCurrency`. */
  toAmount?: number
  /** Cross-currency transfer: currency of the destination account. */
  toCurrency?: string
  contributeToGoals?: boolean
  allocationMode?: AllocationMode
  manualAllocations?: Record<string, number>
}

export interface TransactionModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: TransactionFormData) => void
  categories: Category[]
  accounts: Account[]
  goalsByAccount: AccountGoals[]
  /** If provided, the modal is in edit mode with pre-populated data */
  editTransaction?: Transaction
}

export interface DeleteConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  transactionDescription: string
}
