import { describe, it, expect } from 'vitest'
import { renderPlainReport } from '../render'
import type { MonthlyReportData, WeeklyReportData } from '../build'

const weekly: WeeklyReportData = {
  kind: 'weekly',
  generatedAt: '2026-09-15T11:00:00.000Z',
  window: { from: '2026-09-08', to: '2026-09-14', label: 'Sep 8 – Sep 14, 2026' },
  totals: { incomeUsd: 500, expensesUsd: 165.5, netUsd: 334.5 },
  topExpenses: [
    { date: '2026-09-09', merchant: 'Supermercado <Nacional>', category: 'Food', amountUsd: 120 },
    { date: '2026-09-11', merchant: null, category: 'Fun', amountUsd: 45.5 },
  ],
  spendingByCategory: [
    { name: 'Food', amountUsd: 120, percent: 72.5 },
    { name: 'Fun', amountUsd: 45.5, percent: 27.5 },
  ],
  budget: {
    month: '2026-09',
    overall: { totalBudget: 100, spent: 45.5, remaining: 54.5, percentUsed: 45.5, daysRemaining: 15, projectedOverspend: 0, status: 'on_track' },
    atRisk: [{ category: 'Fun', budgeted: 100, spent: 90, projectedMonthEnd: 180, status: 'warning' }],
  },
  netWorth: {
    current: { date: '2026-09-14', assets: 1000, liabilities: 0, netWorth: 1000 },
    previous: { date: '2026-09-08', assets: 960, liabilities: 0, netWorth: 960 },
    changeUsd: 40,
    historyBeginsAt: '2026-09-08',
  },
  insights: [{ headline: 'Savings rate 67%', body: 'You kept two thirds of income.' }],
}

const monthly: MonthlyReportData = {
  kind: 'monthly',
  generatedAt: '2026-09-01T11:00:00.000Z',
  window: { from: '2026-08-01', to: '2026-08-31', label: 'August 2026' },
  month: { period: '2026-08', label: 'Aug 2026', incomeUsd: 1000, expensesUsd: 250, netUsd: 750, savingsRatePct: 75 },
  previousMonth: { period: '2026-07', label: 'Jul 2026', incomeUsd: 900, expensesUsd: 100, netUsd: 800, savingsRatePct: 88.89 },
  monthOverMonth: { expensesChangePct: 150, incomeChangePct: 11.11 },
  yearOverYear: {
    period: '2026-08',
    comparedTo: '2025-08',
    expenses: { current: 250, previous: 400, changePct: -37.5 },
    income: { current: 1000, previous: 800, changePct: 25 },
  },
  topCategories: [
    { name: 'Fun', amountUsd: 200, percent: 80, subcategories: [] },
    { name: 'Food', amountUsd: 50, percent: 20, subcategories: [{ name: 'Groceries', amountUsd: 50 }] },
  ],
  topExpenses: [{ date: '2026-08-10', merchant: 'Ticketmaster', category: 'Fun', amountUsd: 200 }],
  budget: {
    month: '2026-08',
    totalBudgeted: 100,
    totalSpent: 250,
    budgets: [{ category: 'Fun', budgeted: 100, spent: 200, remaining: -100, percentUsed: 200, projectedMonthEnd: 200, status: 'over_budget' }],
  },
  netWorth: {
    start: { date: '2026-08-01', assets: 900, liabilities: 0, netWorth: 900 },
    end: { date: '2026-08-31', assets: 950, liabilities: 0, netWorth: 950 },
    changeUsd: 50,
    changePct: 5.56,
    historyBeginsAt: '2026-08-01',
  },
  insights: [],
}

describe('renderPlainReport', () => {
  it('renders a weekly report as Telegram HTML with escaped text and a table', () => {
    const out = renderPlainReport(weekly)
    expect(out).toContain('<b>Weekly report</b>')
    expect(out).toContain('Sep 8 – Sep 14, 2026')
    expect(out).toContain('$165.50')
    expect(out).toContain('Supermercado &lt;Nacional&gt;')
    expect(out).toContain('<pre>')
    expect(out).toContain('Fun')
    expect(out).toContain('+$40')
    expect(out).toContain('Savings rate 67%')
    expect(out).not.toContain('**')
  })

  it('renders a monthly report with MoM/YoY lines and the budget outcome', () => {
    const out = renderPlainReport(monthly)
    expect(out).toContain('<b>Monthly report</b>')
    expect(out).toContain('August 2026')
    expect(out).toContain('+150%')
    expect(out).toContain('-37.5%')
    expect(out).toContain('75%')
    expect(out).toContain('over budget')
    expect(out).toContain('$50')
  })

  it('degrades gracefully without net-worth history or comparisons', () => {
    const out = renderPlainReport({
      ...monthly,
      previousMonth: null,
      monthOverMonth: null,
      yearOverYear: null,
      netWorth: { start: null, end: null, changeUsd: null, changePct: null, historyBeginsAt: null },
    })
    expect(out).toContain('August 2026')
    expect(out).not.toContain('undefined')
    expect(out).not.toContain('NaN')
  })
})
