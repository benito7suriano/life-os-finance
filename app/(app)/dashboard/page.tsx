'use client'

import { useRouter } from 'next/navigation'
import { Dashboard } from '@/components/dashboard'
import sampleData from '@/components/dashboard/sample-data.json'
import type { DashboardProps } from '@/components/dashboard/types'

const dashboardData: Omit<DashboardProps, 'onNewTransaction' | 'onViewAllTransactions' | 'onViewTransaction' | 'onQuickAction' | 'onViewNotifications' | 'onSpendingFilterChange' | 'onTrendFilterChange' | 'onLanguageChange'> = {
  user: sampleData.user as DashboardProps['user'],
  summary: sampleData.summary as DashboardProps['summary'],
  accounts: sampleData.accounts as DashboardProps['accounts'],
  spendingByCategory: sampleData.spendingByCategory as DashboardProps['spendingByCategory'],
  monthlyTrend: sampleData.monthlyTrend as DashboardProps['monthlyTrend'],
  recentTransactions: sampleData.recentTransactions as DashboardProps['recentTransactions'],
  categories: sampleData.categories as DashboardProps['categories'],
  notifications: sampleData.notifications as DashboardProps['notifications'],
  quickActions: sampleData.quickActions as DashboardProps['quickActions'],
}

export default function DashboardPage() {
  const router = useRouter()

  return (
    <Dashboard
      {...dashboardData}
      onNewTransaction={() => {
        // TODO: Open new transaction modal when transactions section is built
        console.log('[Dashboard] New transaction')
      }}
      onViewAllTransactions={() => router.push('/transactions')}
      onViewTransaction={(id) => {
        // TODO: Navigate to transaction detail when available
        console.log('[Dashboard] View transaction', id)
      }}
      onQuickAction={(href) => router.push(href)}
      onViewNotifications={() => {
        // TODO: Open notifications panel
        console.log('[Dashboard] View notifications')
      }}
      onSpendingFilterChange={(period) => {
        // TODO: Refetch spending data for selected period
        console.log('[Dashboard] Spending filter:', period)
      }}
      onTrendFilterChange={(period) => {
        // TODO: Refetch trend data for selected period
        console.log('[Dashboard] Trend filter:', period)
      }}
      onLanguageChange={() => {
        // TODO: Toggle language preference
        console.log('[Dashboard] Language change')
      }}
    />
  )
}
