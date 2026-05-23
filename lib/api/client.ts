// Typed fetch wrappers for the internal /api/finance/* routes.
// Frontend code should call these — never fetch directly, never import Supabase client.

const BASE = '/api/finance'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  })
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`
    try {
      const body = await res.json()
      if (body?.error) message = body.error
    } catch {
      // body wasn't JSON — keep status text
    }
    throw new Error(message)
  }
  return res.json() as Promise<T>
}

// ── Transactions ────────────────────────────────────────────────────────────

export interface TransactionFilters {
  search?: string
  categoryIds?: string[]
  accountIds?: string[]
  sources?: string[]
  dateFrom?: string
  dateTo?: string
  sortBy?: string
  sortDir?: 'asc' | 'desc'
  page?: number
  limit?: number
}

function toQuery(filters: Record<string, unknown> | undefined): string {
  if (!filters) return ''
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === '') continue
    if (Array.isArray(value)) {
      if (value.length > 0) params.set(key, value.join(','))
    } else {
      params.set(key, String(value))
    }
  }
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

export function listTransactions(filters?: TransactionFilters) {
  return request<{
    transactions: unknown[]
    summary: { count: number; totalIncome: number; totalExpenses: number }
    totalCount: number
    page: number
    limit: number
    totalPages: number
  }>(`/transactions${toQuery(filters as Record<string, unknown> | undefined)}`)
}

export function createTransaction(input: Record<string, unknown>) {
  return request<{ transaction: unknown }>(`/transactions`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updateTransaction(id: string, input: Record<string, unknown>) {
  return request<{ transaction: unknown }>(`/transactions/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export function deleteTransaction(id: string) {
  return request<{ success: true }>(`/transactions/${id}`, { method: 'DELETE' })
}

// ── Accounts ────────────────────────────────────────────────────────────────

export function listAccounts(params?: { archived?: boolean }) {
  return request<{ accounts: unknown[] }>(`/accounts${toQuery(params as Record<string, unknown> | undefined)}`)
}

export function createAccount(input: Record<string, unknown>) {
  return request<{ account: unknown }>(`/accounts`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updateAccount(id: string, input: Record<string, unknown>) {
  return request<{ account: unknown }>(`/accounts/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export function deleteAccount(id: string) {
  return request<{ success: true }>(`/accounts/${id}`, { method: 'DELETE' })
}

export function restoreAccount(id: string) {
  return request<{ account: unknown }>(`/accounts/${id}/restore`, { method: 'PATCH' })
}

// ── Budgets ─────────────────────────────────────────────────────────────────

export function listBudgets(month?: string) {
  const query = month ? `?month=${encodeURIComponent(month)}` : ''
  return request<{
    budgets: unknown[]
    goals: unknown[]
    goalContributions: unknown[]
    summary: { totalBudgeted: number; totalSpent: number; month: string }
    monthlyHistory: unknown[]
    categories: unknown[]
    categoryAverages: Record<string, number>
    categorySpending: unknown[]
    savingsAccounts: unknown[]
    transactions: unknown[]
  }>(`/budgets${query}`)
}

export function createBudget(input: Record<string, unknown>) {
  return request<{ budget?: unknown; goal?: unknown }>(`/budgets`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updateBudget(id: string, input: Record<string, unknown>) {
  return request<{ budget?: unknown; goal?: unknown }>(`/budgets/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export function deleteBudget(id: string) {
  return request<{ success: true }>(`/budgets/${id}`, { method: 'DELETE' })
}

// ── Goals ───────────────────────────────────────────────────────────────────

export function listGoals() {
  return request<{ goals: unknown[] }>(`/goals`)
}

export function createGoal(input: Record<string, unknown>) {
  return request<{ goal: unknown }>(`/goals`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function getGoal(id: string) {
  return request<{ goal: unknown }>(`/goals/${id}`)
}

export function updateGoal(id: string, input: Record<string, unknown>) {
  return request<{ goal: unknown }>(`/goals/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export function deleteGoal(id: string) {
  return request<{ success: true }>(`/goals/${id}`, { method: 'DELETE' })
}

// ── Categories ──────────────────────────────────────────────────────────────

export function listCategories(params?: { type?: 'expense' | 'income' }) {
  return request<{ categories: unknown[] }>(`/categories${toQuery(params as Record<string, unknown> | undefined)}`)
}

export function createCategory(input: Record<string, unknown>) {
  return request<{ category: unknown }>(`/categories`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updateCategory(id: string, input: Record<string, unknown>) {
  return request<{ category: unknown }>(`/categories/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export function deleteCategory(id: string) {
  return request<{ success: true }>(`/categories/${id}`, { method: 'DELETE' })
}

// ── Merchants ───────────────────────────────────────────────────────────────

export function listMerchants() {
  return request<{ merchants: unknown[] }>(`/merchants`)
}

export function createMerchant(input: Record<string, unknown>) {
  return request<{ merchant: unknown }>(`/merchants`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

// ── Reference data ──────────────────────────────────────────────────────────

export function listInstitutions() {
  return request<{ institutions: unknown[] }>(`/institutions`)
}

export function listCreditCardProviders() {
  return request<{ providers: unknown[] }>(`/credit-card-providers`)
}

// ── Summary ─────────────────────────────────────────────────────────────────

export function getSummary() {
  return request<{
    netWorth: number
    assets: number
    liabilities: number
    monthlyIncome: number
    monthlyExpenses: number
    monthlyNet: number
    budgetVsActual: Array<{
      budgetId: string
      categoryId: string
      type: string
      budgeted: number
      spent: number
      remaining: number
    }>
  }>(`/summary`)
}
