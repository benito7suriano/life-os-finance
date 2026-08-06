'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Dashboard } from '@/components/dashboard'
import { createClient } from '@/lib/supabase/client'
import { getInsights, getSummary, listAccounts, listTransactions } from '@/lib/api/client'
import type {
  DashboardProps,
  Account as DashAccount,
  Transaction as DashTxn,
  MonthlyTrendItem,
  SpendingByCategory,
  Summary,
} from '@/components/dashboard/types'
import type { Insight } from '@/lib/insights/types'

const EMPTY_SPENDING: SpendingByCategory = { period: 'month', total: 0, categories: [] }

const EMPTY_SUMMARY: Summary = {
  netWorth: { amount: 0, previousAmount: 0, change: 0, changePercent: 0, trend: 'stable' },
  monthlyExpenses: { amount: 0, previousMonth: 0, change: 0, changePercent: 0 },
  monthlyIncome: { amount: 0, previousMonth: 0, change: 0, changePercent: 0 },
  budgetProjection: {
    totalBudget: 0,
    spent: 0,
    remaining: 0,
    percentUsed: 0,
    daysRemaining: 0,
    projectedOverspend: 0,
    status: 'on_track',
  },
}

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<DashboardProps['user']>({
    id: '',
    firstName: '',
    lastName: '',
    email: '',
    preferredLanguage: 'en',
    subscriptionTier: 'free',
  })
  const [summary, setSummary] = useState<Summary>(EMPTY_SUMMARY)
  const [accounts, setAccounts] = useState<DashAccount[]>([])
  const [recentTransactions, setRecentTransactions] = useState<DashTxn[]>([])
  const [monthlyTrend, setMonthlyTrend] = useState<MonthlyTrendItem[]>([])
  const [spendingByCategory, setSpendingByCategory] = useState<SpendingByCategory>(EMPTY_SPENDING)
  const [insights, setInsights] = useState<Insight[]>([])
  const [insightsGeneratedAt, setInsightsGeneratedAt] = useState<string | undefined>(undefined)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) return

      // Fetch profile (first/last name) from public.users
      const { data: profile } = await supabase
        .from('users')
        .select('first_name, last_name, email, preferred_language, subscription_tier')
        .eq('id', authUser.id)
        .single()

      setUser({
        id: authUser.id,
        firstName: profile?.first_name || authUser.email?.split('@')[0] || 'there',
        lastName: profile?.last_name || '',
        email: profile?.email || authUser.email || '',
        preferredLanguage: (profile?.preferred_language as 'en' | 'es') || 'en',
        subscriptionTier: (profile?.subscription_tier as 'free' | 'pro') || 'free',
      })

      // Settle each independently so one failing call doesn't blank the page.
      const [summarySettled, accountsSettled, recentSettled, insightsSettled] = await Promise.allSettled([
        getSummary(),
        listAccounts(),
        listTransactions({ page: 1, limit: 5, sortBy: 'date', sortDir: 'desc' }),
        getInsights(),
      ])

      const summaryRes = summarySettled.status === 'fulfilled' ? summarySettled.value : null
      const accountsRes = accountsSettled.status === 'fulfilled' ? accountsSettled.value : { accounts: [] }
      const recentRes = recentSettled.status === 'fulfilled' ? recentSettled.value : { transactions: [] }
      const insightsRes = insightsSettled.status === 'fulfilled' ? insightsSettled.value : null

      if (summarySettled.status === 'rejected') console.error('[dashboard] summary failed', summarySettled.reason)
      if (accountsSettled.status === 'rejected') console.error('[dashboard] accounts failed', accountsSettled.reason)
      if (recentSettled.status === 'rejected') console.error('[dashboard] recent txns failed', recentSettled.reason)
      if (insightsSettled.status === 'rejected') console.error('[dashboard] insights failed', insightsSettled.reason)

      try {
        if (summaryRes) {
          setSummary({
            netWorth: {
              amount: Number(summaryRes.netWorth) || 0,
              previousAmount: 0,
              change: 0,
              changePercent: 0,
              trend: 'stable',
            },
            monthlyExpenses: {
              amount: Number(summaryRes.monthlyExpenses) || 0,
              previousMonth: 0,
              change: 0,
              changePercent: 0,
            },
            monthlyIncome: {
              amount: Number(summaryRes.monthlyIncome) || 0,
              previousMonth: 0,
              change: 0,
              changePercent: 0,
            },
            budgetProjection: summaryRes.budgetProjection ?? EMPTY_SUMMARY.budgetProjection,
          })
          setMonthlyTrend(summaryRes.monthlyTrend ?? [])
          setSpendingByCategory(summaryRes.spendingByCategory ?? EMPTY_SPENDING)
        }

        if (insightsRes) {
          setInsights(insightsRes.insights ?? [])
          setInsightsGeneratedAt(insightsRes.generatedAt)
        }

        type ApiAccount = {
          id: string
          name: string
          type: string
          balance: number | string
          balanceUsd?: number | string
          currency?: string
          institutionId?: string
          icon?: string
          creditLimit?: number | string
        }
        type ApiTxn = {
          id: string
          type: 'expense' | 'income' | 'transfer'
          amount: number
          description: string
          date: string
          currency?: string
          toAmount?: number
          toCurrency?: string
          category?: { id: string; name: string; color?: string }
          fromAccount?: { id: string; name: string }
          toAccount?: { id: string; name: string }
        }

        // Map accounts → DashAccount[]. `balance` stays native (for display);
        // `balanceUsd` (precomputed by the API) is what the dashboard aggregates
        // so mixed-currency accounts sum correctly.
        const dashAccounts: DashAccount[] = ((accountsRes.accounts as ApiAccount[]) || []).map((a) => {
          const balance = Number(a.balance)
          return {
            id: a.id,
            name: a.name,
            type: a.type as DashAccount['type'],
            institution: a.institutionId,
            balance,
            // Fall back to native balance only if the API omitted the USD field.
            balanceUsd: a.balanceUsd != null ? Number(a.balanceUsd) : balance,
            creditLimit: a.creditLimit != null ? Number(a.creditLimit) : undefined,
            currency: a.currency || 'USD',
            icon: a.icon || 'wallet',
          }
        })
        setAccounts(dashAccounts)

        // Map recent transactions — keep the native amount + currency for
        // display (formatting happens in the component via lib/fx).
        const recent: DashTxn[] = ((recentRes.transactions as ApiTxn[]) || []).map((t) => {
          const acct = t.fromAccount || t.toAccount || { id: '', name: 'Unknown' }
          return {
            id: t.id,
            type: t.type,
            amount: Math.abs(Number(t.amount)),
            currency: t.currency || 'USD',
            toAmount: t.toAmount != null ? Number(t.toAmount) : undefined,
            toCurrency: t.toCurrency,
            description: t.description || '(no description)',
            category: {
              id: t.category?.id || '',
              name: t.category?.name || (t.type === 'transfer' ? 'Transfer' : 'Uncategorized'),
              color: t.category?.color || '#94a3b8',
            },
            account: { id: acct.id, name: acct.name },
            date: t.date,
            time: '',
          }
        })
        setRecentTransactions(recent)
      } catch (e) {
        console.error('[dashboard] load failed', e)
      }
    }
    load()
  }, [])

  return (
    <Dashboard
      user={user}
      summary={summary}
      accounts={accounts}
      spendingByCategory={spendingByCategory}
      monthlyTrend={monthlyTrend}
      recentTransactions={recentTransactions}
      categories={spendingByCategory.categories.map((c) => ({ id: c.id, name: c.name, color: c.color, icon: '' }))}
      insights={insights}
      insightsGeneratedAt={insightsGeneratedAt}
      notifications={{ count: 0, items: [] }}
      quickActions={[]}
      onNewTransaction={() => router.push('/transactions')}
      onViewAllTransactions={() => router.push('/transactions')}
      onViewTransaction={(id) => console.log('[Dashboard] View transaction', id)}
      onQuickAction={(href) => router.push(href)}
      onViewNotifications={() => {}}
      onSpendingFilterChange={() => {}}
      onTrendFilterChange={() => {}}
      onLanguageChange={() => {}}
    />
  )
}
