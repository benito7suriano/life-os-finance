'use client'

import type { Summary } from './types'
import { TrendingUp, TrendingDown, Minus, Wallet, ArrowDownLeft, ArrowUpRight, PieChart } from 'lucide-react'

interface KpiCardsProps {
  summary: Summary
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount)
}

function formatPercent(percent: number): string {
  return `${percent >= 0 ? '+' : ''}${percent.toFixed(1)}%`
}

export function KpiCards({ summary }: KpiCardsProps) {
  const { netWorth, monthlyExpenses, monthlyIncome, budgetProjection } = summary

  const trendIcon = {
    up: <TrendingUp className="h-3.5 w-3.5" />,
    down: <TrendingDown className="h-3.5 w-3.5" />,
    stable: <Minus className="h-3.5 w-3.5" />,
  }

  const trendColor = {
    up: 'text-emerald-600 dark:text-emerald-400',
    down: 'text-red-600 dark:text-red-400',
    stable: 'text-slate-500 dark:text-slate-400',
  }

  const budgetStatusStyles = {
    on_track: {
      card: 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/50',
      text: 'text-emerald-700 dark:text-emerald-400',
      subtext: 'text-emerald-600 dark:text-emerald-500',
    },
    warning: {
      card: 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/50',
      text: 'text-amber-700 dark:text-amber-400',
      subtext: 'text-amber-600 dark:text-amber-500',
    },
    over_budget: {
      card: 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/50',
      text: 'text-red-700 dark:text-red-400',
      subtext: 'text-red-600 dark:text-red-500',
    },
  }

  const budgetStatus = budgetStatusStyles[budgetProjection.status]

  const getStatusMessage = () => {
    if (budgetProjection.status === 'on_track') return 'On track this month'
    if (budgetProjection.status === 'warning') return 'On track to overspend'
    return 'Over budget!'
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* Net Worth */}
      <div className="group rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
            Net Worth
          </span>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            <Wallet className="h-4 w-4" />
          </div>
        </div>
        <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white font-[JetBrains_Mono,monospace]">
          {formatCurrency(netWorth.amount)}
        </p>
        <div className={`mt-1.5 flex items-center gap-1 text-xs font-medium ${trendColor[netWorth.trend]}`}>
          {trendIcon[netWorth.trend]}
          <span>
            {formatCurrency(Math.abs(netWorth.change))} ({formatPercent(netWorth.changePercent)})
          </span>
        </div>
      </div>

      {/* Monthly Expenses */}
      <div className="group rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
            Expenses
          </span>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400">
            <ArrowDownLeft className="h-4 w-4" />
          </div>
        </div>
        <p className="mt-3 text-2xl font-semibold tracking-tight text-red-600 dark:text-red-400 font-[JetBrains_Mono,monospace]">
          -{formatCurrency(monthlyExpenses.amount)}
        </p>
        <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
          This month
        </p>
      </div>

      {/* Monthly Income */}
      <div className="group rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
            Income
          </span>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
            <ArrowUpRight className="h-4 w-4" />
          </div>
        </div>
        <p className="mt-3 text-2xl font-semibold tracking-tight text-emerald-600 dark:text-emerald-400 font-[JetBrains_Mono,monospace]">
          +{formatCurrency(monthlyIncome.amount)}
        </p>
        <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
          This month
        </p>
      </div>

      {/* Budget Projection */}
      <div className={`group rounded-xl border p-4 shadow-sm transition-shadow hover:shadow-md ${budgetStatus.card}`}>
        <div className="flex items-center justify-between">
          <span className={`text-sm font-medium ${budgetStatus.text}`}>
            Budget Projection
          </span>
          <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-white/60 dark:bg-black/20 ${budgetStatus.text}`}>
            <PieChart className="h-4 w-4" />
          </div>
        </div>
        <p className={`mt-3 text-2xl font-semibold tracking-tight font-[JetBrains_Mono,monospace] ${budgetStatus.text}`}>
          {budgetProjection.percentUsed.toFixed(0)}%
        </p>
        <p className={`mt-1.5 text-xs font-medium ${budgetStatus.subtext}`}>
          {getStatusMessage()}
        </p>
      </div>
    </div>
  )
}
