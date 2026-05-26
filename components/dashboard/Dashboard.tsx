'use client'

import type { DashboardProps } from './types'
import { NetWorthHero } from './NetWorthHero'
import { InsightCard } from './InsightCard'
import { KpiCards } from './KpiCards'
import { StatisticChart } from './StatisticChart'
import { RecentTransactions } from './RecentTransactions'
import { BudgetGlance } from './BudgetGlance'
import { AccountsMini } from './AccountsMini'

export function Dashboard({
  summary,
  accounts,
  monthlyTrend,
  recentTransactions,
  onNewTransaction,
  onViewAllTransactions,
  onViewTransaction,
  onQuickAction,
}: DashboardProps) {
  void onNewTransaction
  const goTransactions = onViewAllTransactions
  const goAccounts = () => onQuickAction?.('/accounts')
  const goBudgets = () => onQuickAction?.('/budgets')

  return (
    <div className="grid gap-4 p-4 pb-10 md:p-6 lg:px-8 lg:py-6">
      {/* row 1 — net worth hero + AI insight */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.7fr_1fr]">
        <NetWorthHero summary={summary} accounts={accounts} trend={monthlyTrend} />
        <InsightCard summary={summary} onSeeTransactions={goTransactions} />
      </div>

      {/* row 2 — KPI tiles */}
      <KpiCards summary={summary} trend={monthlyTrend} />

      {/* row 3 — statistic chart + recent */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.55fr_1fr]">
        <StatisticChart trend={monthlyTrend} />
        <RecentTransactions transactions={recentTransactions} onViewTransaction={onViewTransaction} onViewAll={onViewAllTransactions} />
      </div>

      {/* row 4 — budget + accounts */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <BudgetGlance summary={summary} onGo={goBudgets} />
        <AccountsMini accounts={accounts} onGo={goAccounts} />
      </div>
    </div>
  )
}
