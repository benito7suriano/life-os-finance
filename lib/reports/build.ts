// Deterministic data assembly for the weekly/monthly reports. Composes the
// agent's read-only tool executors so reports and chat answers agree.

import type { SupabaseClient } from '@supabase/supabase-js'
import { round2 } from '@/lib/finance/history'
import type { BudgetProjection } from '@/lib/finance/projection'
import { fetchNetWorthHistory, type NetWorthPoint } from '@/lib/finance/snapshots'
import {
  getBudgetStatus,
  getInsights,
  getMonthlyCashflow,
  getSpendingByCategory,
  queryTransactions,
  type ToolContext,
} from '@/lib/agent/tools'
import type { ReportKind } from './schedule'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FinanceSupabase = SupabaseClient<any, any, any>

export interface ReportWindow {
  from: string
  to: string
  label: string
}

export interface ReportExpense {
  date: string
  merchant: string | null
  category: string | null
  amountUsd: number
}

export interface ReportInsight {
  headline: string
  body: string
}

export interface WeeklyReportData {
  kind: 'weekly'
  generatedAt: string
  window: ReportWindow
  totals: { incomeUsd: number; expensesUsd: number; netUsd: number }
  topExpenses: ReportExpense[]
  spendingByCategory: { name: string; amountUsd: number; percent: number }[]
  budget: {
    month: string
    overall: BudgetProjection
    atRisk: { category: string; budgeted: number; spent: number; projectedMonthEnd: number; status: string }[]
  }
  netWorth: {
    current: NetWorthPoint | null
    previous: NetWorthPoint | null
    changeUsd: number | null
    historyBeginsAt: string | null
  }
  insights: ReportInsight[]
}

export interface MonthSummary {
  period: string
  label: string
  incomeUsd: number
  expensesUsd: number
  netUsd: number
  savingsRatePct: number | null
}

export interface MonthlyReportData {
  kind: 'monthly'
  generatedAt: string
  window: ReportWindow
  month: MonthSummary
  previousMonth: MonthSummary | null
  monthOverMonth: { expensesChangePct: number | null; incomeChangePct: number | null } | null
  yearOverYear: {
    period: string
    comparedTo: string
    expenses: { current: number; previous: number; changePct: number | null }
    income: { current: number; previous: number; changePct: number | null }
  } | null
  topCategories: {
    name: string
    amountUsd: number
    percent: number
    subcategories: { name: string; amountUsd: number }[]
  }[]
  topExpenses: ReportExpense[]
  budget: {
    month: string
    totalBudgeted: number
    totalSpent: number
    budgets: {
      category: string
      budgeted: number
      spent: number
      remaining: number
      percentUsed: number
      projectedMonthEnd: number
      status: string
    }[]
  }
  netWorth: {
    start: NetWorthPoint | null
    end: NetWorthPoint | null
    changeUsd: number | null
    changePct: number | null
    historyBeginsAt: string | null
  }
  insights: ReportInsight[]
}

export type ReportData = WeeklyReportData | MonthlyReportData

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function shortDate(d: Date): string {
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric' })
}

/** Weekly = the 7 days ending yesterday (a Monday run covers Mon–Sun);
 * monthly = the previous calendar month. */
export function reportWindow(kind: ReportKind, now: Date): ReportWindow {
  if (kind === 'weekly') {
    const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7)
    const to = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
    return {
      from: toDateStr(from),
      to: toDateStr(to),
      label: `${shortDate(from)} – ${shortDate(to)}, ${to.getFullYear()}`,
    }
  }
  const from = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const to = new Date(now.getFullYear(), now.getMonth(), 0)
  return {
    from: toDateStr(from),
    to: toDateStr(to),
    label: from.toLocaleString('en-US', { month: 'long', year: 'numeric' }),
  }
}

export function savingsRatePct(incomeUsd: number, expensesUsd: number): number | null {
  if (incomeUsd <= 0) return null
  return round2(((incomeUsd - expensesUsd) / incomeUsd) * 100)
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return null
  return round2(((current - previous) / Math.abs(previous)) * 100)
}

export async function buildReportData(
  supabase: FinanceSupabase,
  userId: string,
  kind: ReportKind,
  now: Date
): Promise<ReportData> {
  const ctx: ToolContext = { supabase, userId, now }
  return kind === 'weekly' ? buildWeekly(ctx) : buildMonthly(ctx)
}

async function buildWeekly(ctx: ToolContext): Promise<WeeklyReportData> {
  const window = reportWindow('weekly', ctx.now)
  const [expenses, income, categories, budget, points, insights] = await Promise.all([
    queryTransactions(ctx, { type: 'expense', from_date: window.from, to_date: window.to, sort: 'amount', limit: 5 }),
    queryTransactions(ctx, { type: 'income', from_date: window.from, to_date: window.to, limit: 1 }),
    getSpendingByCategory(ctx, { from_date: window.from, to_date: window.to }),
    getBudgetStatus(ctx),
    fetchNetWorthHistory(ctx.supabase, ctx.userId, { fromDate: window.from, toDate: window.to }),
    getInsights(ctx),
  ])

  const current = points.length > 0 ? points[points.length - 1] : null
  const previous = points.length > 1 ? points[0] : null

  return {
    kind: 'weekly',
    generatedAt: ctx.now.toISOString(),
    window,
    totals: {
      incomeUsd: income.totalUsd,
      expensesUsd: expenses.totalUsd,
      netUsd: round2(income.totalUsd - expenses.totalUsd),
    },
    topExpenses: expenses.transactions.map(toReportExpense),
    spendingByCategory: categories.categories.slice(0, 5).map((c) => ({
      name: c.name,
      amountUsd: c.amountUsd,
      percent: c.percent,
    })),
    budget: {
      month: budget.month,
      overall: budget.overall,
      atRisk: budget.budgets
        .filter((b) => b.status !== 'on_track')
        .map((b) => ({
          category: b.category,
          budgeted: b.budgeted,
          spent: b.spent,
          projectedMonthEnd: b.projectedMonthEnd,
          status: b.status,
        })),
    },
    netWorth: {
      current,
      previous,
      changeUsd: current && previous ? round2(current.netWorth - previous.netWorth) : null,
      historyBeginsAt: points[0]?.date ?? null,
    },
    insights: insights.insights.slice(0, 3).map((i) => ({ headline: i.headline, body: i.body })),
  }
}

async function buildMonthly(ctx: ToolContext): Promise<MonthlyReportData> {
  const window = reportWindow('monthly', ctx.now)
  const period = window.from.slice(0, 7)
  const [cashflow, categories, expenses, budget, points, insights] = await Promise.all([
    // 14 months so the same month last year is in the table.
    getMonthlyCashflow(ctx, { months: 14 }),
    getSpendingByCategory(ctx, { from_date: window.from, to_date: window.to }),
    queryTransactions(ctx, { type: 'expense', from_date: window.from, to_date: window.to, sort: 'amount', limit: 5 }),
    getBudgetStatus(ctx, { month: period }),
    fetchNetWorthHistory(ctx.supabase, ctx.userId, { fromDate: window.from, toDate: window.to }),
    getInsights(ctx),
  ])

  const monthRow = cashflow.months.find((m) => m.period === period)
  const month: MonthSummary = {
    period,
    label: monthRow?.label ?? window.label,
    incomeUsd: monthRow?.income ?? 0,
    expensesUsd: monthRow?.expenses ?? 0,
    netUsd: monthRow?.net ?? 0,
    savingsRatePct: savingsRatePct(monthRow?.income ?? 0, monthRow?.expenses ?? 0),
  }
  const idx = cashflow.months.findIndex((m) => m.period === period)
  const prevRow = idx > 0 ? cashflow.months[idx - 1] : null
  const previousMonth: MonthSummary | null =
    prevRow && (prevRow.income !== 0 || prevRow.expenses !== 0)
      ? {
          period: prevRow.period,
          label: prevRow.label,
          incomeUsd: prevRow.income,
          expensesUsd: prevRow.expenses,
          netUsd: prevRow.net,
          savingsRatePct: savingsRatePct(prevRow.income, prevRow.expenses),
        }
      : null

  const start = points[0] ?? null
  const end = points.length > 0 ? points[points.length - 1] : null

  return {
    kind: 'monthly',
    generatedAt: ctx.now.toISOString(),
    window,
    month,
    previousMonth,
    monthOverMonth: previousMonth
      ? {
          expensesChangePct: pctChange(month.expensesUsd, previousMonth.expensesUsd),
          incomeChangePct: pctChange(month.incomeUsd, previousMonth.incomeUsd),
        }
      : null,
    yearOverYear: cashflow.yearOverYear,
    topCategories: categories.categories.slice(0, 6).map((c) => ({
      name: c.name,
      amountUsd: c.amountUsd,
      percent: c.percent,
      subcategories: c.subcategories,
    })),
    topExpenses: expenses.transactions.map(toReportExpense),
    budget: {
      month: budget.month,
      totalBudgeted: budget.totalBudgeted,
      totalSpent: budget.totalSpent,
      budgets: budget.budgets.map((b) => ({
        category: b.category,
        budgeted: b.budgeted,
        spent: b.spent,
        remaining: b.remaining,
        percentUsed: b.percentUsed,
        projectedMonthEnd: b.projectedMonthEnd,
        status: b.status,
      })),
    },
    netWorth: {
      start,
      end,
      changeUsd: start && end ? round2(end.netWorth - start.netWorth) : null,
      changePct: start && end ? pctChange(end.netWorth, start.netWorth) : null,
      historyBeginsAt: start?.date ?? null,
    },
    insights: insights.insights.slice(0, 3).map((i) => ({ headline: i.headline, body: i.body })),
  }
}

function toReportExpense(t: { date: string; merchant: string | null; category: string | null; amountUsd: number }): ReportExpense {
  return { date: t.date, merchant: t.merchant, category: t.category, amountUsd: t.amountUsd }
}
