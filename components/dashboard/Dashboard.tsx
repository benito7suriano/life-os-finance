'use client'

import { useState } from 'react'
import type { DashboardProps, SpendingPeriod, TrendPeriod } from './types'
import { KpiCards } from './KpiCards'
import { SpendingChart } from './SpendingChart'
import { TrendChart } from './TrendChart'
import { QuickActions } from './QuickActions'
import { RecentTransactions } from './RecentTransactions'
import { Bell, Plus, Globe } from 'lucide-react'

// Helper to get time-based greeting
function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

export function Dashboard({
  user,
  summary,
  spendingByCategory,
  monthlyTrend,
  recentTransactions,
  notifications,
  quickActions,
  onNewTransaction,
  onViewAllTransactions,
  onViewTransaction,
  onQuickAction,
  onViewNotifications,
  onSpendingFilterChange,
  onTrendFilterChange,
  onLanguageChange,
}: DashboardProps) {
  const [spendingPeriod, setSpendingPeriod] = useState<SpendingPeriod>(spendingByCategory.period)
  const [trendPeriod, setTrendPeriod] = useState<TrendPeriod>('month')

  const greeting = getGreeting()

  const handleSpendingFilterChange = (period: SpendingPeriod) => {
    setSpendingPeriod(period)
    onSpendingFilterChange?.(period)
  }

  const handleTrendFilterChange = (period: TrendPeriod) => {
    setTrendPeriod(period)
    onTrendFilterChange?.(period)
  }

  return (
    <div className="min-h-full rounded-xl bg-white p-6 shadow-sm dark:bg-slate-800/50">
      <div className="space-y-6">
        {/* Page Header */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
              {greeting}, {user.firstName}!
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Here&apos;s your financial summary
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* Language Switcher */}
            <button
              onClick={onLanguageChange}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:hover:text-slate-300"
              aria-label="Change language"
            >
              <Globe className="h-[18px] w-[18px]" />
            </button>

            {/* Notifications */}
            <button
              onClick={onViewNotifications}
              className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:hover:text-slate-300"
              aria-label={`${notifications.count} notifications`}
            >
              <Bell className="h-[18px] w-[18px]" />
              {notifications.count > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-semibold text-white shadow-sm">
                  {notifications.count > 9 ? '9+' : notifications.count}
                </span>
              )}
            </button>

            {/* New Transaction */}
            <button
              onClick={onNewTransaction}
              className="flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-700 active:bg-emerald-800"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">New Transaction</span>
              <span className="sm:hidden">New</span>
            </button>
          </div>
        </header>

        {/* KPI Cards */}
        <KpiCards summary={summary} />

        {/* Charts Row */}
        <div className="grid gap-6 lg:grid-cols-2">
          <SpendingChart
            data={spendingByCategory}
            selectedPeriod={spendingPeriod}
            onPeriodChange={handleSpendingFilterChange}
          />
          <TrendChart
            data={monthlyTrend}
            selectedPeriod={trendPeriod}
            onPeriodChange={handleTrendFilterChange}
          />
        </div>

        {/* Bottom Row */}
        <div className="grid gap-6 lg:grid-cols-2">
          <QuickActions
            actions={quickActions}
            onAction={onQuickAction}
          />
          <RecentTransactions
            transactions={recentTransactions.slice(0, 5)}
            onViewTransaction={onViewTransaction}
            onViewAll={onViewAllTransactions}
          />
        </div>
      </div>
    </div>
  )
}
