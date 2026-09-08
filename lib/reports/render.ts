// Deterministic Telegram-HTML rendering of a report — the fallback when
// Claude phrasing fails, and the reference for what a report must contain.

import { escapeHtml, monoTable } from '@/lib/telegram/html'
import type { MonthlyReportData, ReportData, WeeklyReportData } from './build'

export function money(n: number): string {
  const abs = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return n < 0 ? `-$${abs}` : `$${abs}`
}

/** Whole-dollar signed delta: +$40 / -$12. */
export function signedMoney(n: number): string {
  const abs = Math.round(Math.abs(n)).toLocaleString('en-US')
  return `${n < 0 ? '-' : '+'}$${abs}`
}

export function signedPct(n: number | null): string {
  if (n === null) return 'n/a'
  return `${n < 0 ? '-' : '+'}${Math.abs(n)}%`
}

const STATUS_LABEL: Record<string, string> = {
  on_track: 'on track',
  warning: 'at risk',
  over_budget: 'over budget',
}

function statusLabel(status: string): string {
  return STATUS_LABEL[status] ?? status
}

function shortDay(dateStr: string): string {
  return dateStr.slice(5).replace('-', '/')
}

function expensesTable(rows: { date: string; merchant: string | null; category: string | null; amountUsd: number }[]): string {
  return monoTable(
    ['Date', 'Where', 'USD'],
    rows.map((t) => [shortDay(t.date), (t.merchant ?? t.category ?? '—').slice(0, 24), money(t.amountUsd)])
  )
}

function insightsSection(insights: { headline: string; body: string }[]): string[] {
  if (insights.length === 0) return []
  return ['', '<b>Insights</b>', ...insights.map((i) => `• <b>${escapeHtml(i.headline)}</b> — ${escapeHtml(i.body)}`)]
}

export function renderPlainReport(data: ReportData): string {
  return data.kind === 'weekly' ? renderWeekly(data) : renderMonthly(data)
}

function renderWeekly(d: WeeklyReportData): string {
  const lines: string[] = [
    `<b>Weekly report</b> · ${escapeHtml(d.window.label)}`,
    '',
    `Spent <b>${money(d.totals.expensesUsd)}</b> · Earned ${money(d.totals.incomeUsd)} · Net ${signedMoney(d.totals.netUsd)}`,
  ]

  if (d.spendingByCategory.length > 0) {
    lines.push(
      '',
      '<b>Where it went</b>',
      monoTable(
        ['Category', 'USD', '%'],
        d.spendingByCategory.map((c) => [c.name, money(c.amountUsd), `${Math.round(c.percent)}%`])
      )
    )
  }

  if (d.topExpenses.length > 0) {
    lines.push('', '<b>Biggest expenses</b>', expensesTable(d.topExpenses))
  }

  const b = d.budget
  if (b.overall.totalBudget > 0) {
    lines.push(
      '',
      `<b>Budget</b> (${b.month}): ${b.overall.percentUsed}% used, ${b.overall.daysRemaining} days left — ${statusLabel(b.overall.status)}`
    )
    for (const r of b.atRisk) {
      lines.push(
        `⚠ ${escapeHtml(r.category)}: ${money(r.spent)} of ${money(r.budgeted)}, heading for ${money(r.projectedMonthEnd)} (${statusLabel(r.status)})`
      )
    }
  }

  if (d.netWorth.current) {
    const delta =
      d.netWorth.previous && d.netWorth.changeUsd !== null
        ? ` (${signedMoney(d.netWorth.changeUsd)} since ${shortDay(d.netWorth.previous.date)})`
        : ''
    lines.push('', `<b>Net worth</b>: ${money(d.netWorth.current.netWorth)}${delta}`)
  }

  lines.push(...insightsSection(d.insights))
  return lines.join('\n')
}

function renderMonthly(d: MonthlyReportData): string {
  const m = d.month
  const lines: string[] = [
    `<b>Monthly report</b> · ${escapeHtml(d.window.label)}`,
    '',
    `Spent <b>${money(m.expensesUsd)}</b> · Earned ${money(m.incomeUsd)} · Net ${signedMoney(m.netUsd)}`,
  ]
  if (m.savingsRatePct !== null) lines.push(`Savings rate: ${m.savingsRatePct}%`)

  if (d.monthOverMonth && d.previousMonth) {
    lines.push(
      `vs ${escapeHtml(d.previousMonth.label)}: spending ${signedPct(d.monthOverMonth.expensesChangePct)}, income ${signedPct(d.monthOverMonth.incomeChangePct)}`
    )
  }
  if (d.yearOverYear) {
    lines.push(
      `vs ${d.yearOverYear.comparedTo}: spending ${signedPct(d.yearOverYear.expenses.changePct)}, income ${signedPct(d.yearOverYear.income.changePct)}`
    )
  }

  if (d.topCategories.length > 0) {
    lines.push(
      '',
      '<b>Where it went</b>',
      monoTable(
        ['Category', 'USD', '%'],
        d.topCategories.map((c) => [c.name, money(c.amountUsd), `${Math.round(c.percent)}%`])
      )
    )
  }

  if (d.topExpenses.length > 0) {
    lines.push('', '<b>Biggest expenses</b>', expensesTable(d.topExpenses))
  }

  if (d.budget.budgets.length > 0) {
    lines.push('', `<b>Budgets</b> (${d.budget.month}): spent ${money(d.budget.totalSpent)} of ${money(d.budget.totalBudgeted)}`)
    for (const b of d.budget.budgets) {
      lines.push(`• ${escapeHtml(b.category)}: ${money(b.spent)} of ${money(b.budgeted)} — ${statusLabel(b.status)}`)
    }
  }

  if (d.netWorth.start && d.netWorth.end && d.netWorth.changeUsd !== null) {
    const pct = d.netWorth.changePct !== null ? `, ${signedPct(d.netWorth.changePct)}` : ''
    lines.push('', `<b>Net worth</b>: ${money(d.netWorth.end.netWorth)} (${signedMoney(d.netWorth.changeUsd)}${pct} over the month)`)
  } else if (d.netWorth.end) {
    lines.push('', `<b>Net worth</b>: ${money(d.netWorth.end.netWorth)}`)
  }

  lines.push(...insightsSection(d.insights))
  return lines.join('\n')
}
