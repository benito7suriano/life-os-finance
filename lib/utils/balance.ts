// Types for balance calculation
export type TransactionWithCategory = {
  account_id: string
  amount: number
  category: { type: string } | null
}

export type AccountForBalance = {
  id: string
  balance: number | null
  type: string
}

export type BalanceResult = {
  balancesByAccount: Record<string, number>
  totalBalance: number
}

/**
 * Calculates the real balance for each account based on transactions.
 * 
 * Formula per account: initial_balance + income - expenses
 * 
 * For total balance:
 * - Regular accounts (checking, savings, cash, investment): add to total
 * - Credit accounts: subtract from total (represents debt)
 * 
 * @param accounts - Array of accounts with id, balance (initial), and type
 * @param transactions - Array of transactions with account_id, amount, and category
 * @returns Object with balances per account and total balance
 */
export function calculateAccountBalances(
  accounts: AccountForBalance[],
  transactions: TransactionWithCategory[]
): BalanceResult {
  const balancesByAccount: Record<string, number> = {}

  // Initialize with initial balance from each account
  accounts.forEach(account => {
    balancesByAccount[account.id] = account.balance || 0
  })

  // Add/subtract transactions based on category type
  transactions.forEach(transaction => {
    const accountId = transaction.account_id
    if (!Object.prototype.hasOwnProperty.call(balancesByAccount, accountId)) {
      balancesByAccount[accountId] = 0
    }

    const amount = Number(transaction.amount)
    const categoryType = transaction.category?.type

    if (categoryType === "income") {
      // Income adds to the balance
      balancesByAccount[accountId] += amount
    } else if (categoryType === "expense") {
      // Expense subtracts from the balance
      balancesByAccount[accountId] -= amount
    }
    // If no category, we don't count it (needs review)
  })

  // Calculate total balance considering account types
  const totalBalance = accounts.reduce((sum, account) => {
    const balance = balancesByAccount[account.id] || 0
    if (account.type === "credit") {
      // Credit card balance represents debt, subtract from total
      return sum - balance
    }
    return sum + balance
  }, 0)

  return {
    balancesByAccount,
    totalBalance,
  }
}
