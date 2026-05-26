'use client'

import { useState, useMemo, type CSSProperties } from 'react'
import type { BudgetsProps, Budget, Goal, TimeRange, FilterState, BudgetTypeFilter, SortField } from './types'
import { SpendingChart } from './SpendingChart'
import { BudgetCard } from './BudgetCard'
import { BudgetDrawer } from './BudgetDrawer'
import { CreateBudgetModal } from './CreateBudgetModal'
import { Card, Button, Badge, Empty, formatCurrency } from '@/components/ui'
import { Plus, ChevronLeft, ChevronRight, LayoutGrid, Wallet, Star, PiggyBank } from 'lucide-react'

type BudgetOrGoal = { type: 'budget'; item: Budget } | { type: 'goal'; item: Goal }

const TYPE_TABS: { value: BudgetTypeFilter; label: string; icon: React.ElementType }[] = [
  { value: 'all', label: 'All', icon: LayoutGrid },
  { value: 'monthly', label: 'Monthly', icon: Wallet },
  { value: 'sinking_fund', label: 'Sinking funds', icon: Star },
]

// ─── budget-usage ring ──────────────────────────────────────────────────
function BudgetRing({ percent, size = 160, stroke = 14 }: { percent: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(percent / 100, 1))
  const over = percent > 100
  const ringColor = over ? 'var(--bad)' : percent >= 90 ? 'var(--warn)' : 'var(--accent-a)'
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={ringColor}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${pct * circ} ${circ}`}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--fg3)' }}>used</div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 600, color: 'var(--fg)', marginTop: 6 }}>{percent}%</div>
      </div>
    </div>
  )
}

export function BudgetsDashboard({
  summary,
  categories,
  budgets,
  goals,
  goalContributions,
  savingsAccounts,
  monthlyHistory,
  categoryAverages,
  selectedMonth,
  transactions,
  onViewBudget,
  onEditBudget,
  onDeleteBudget,
  onCreateBudget,
  onCreateSinkingFund,
  onViewGoal,
  onEditGoal,
  onArchiveGoal,
  onMonthChange,
  onTimeRangeChange,
  onFilterChange,
}: BudgetsProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('12months')
  const [filter, setFilter] = useState<FilterState>({ type: 'all', sortField: 'percentUsed', sortDirection: 'desc' })
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [selectedBudget, setSelectedBudget] = useState<Budget | null>(null)
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  const sortedItems = useMemo(() => {
    const items: BudgetOrGoal[] = []
    if (filter.type !== 'sinking_fund') items.push(...budgets.map((b) => ({ type: 'budget' as const, item: b })))
    if (filter.type !== 'monthly') items.push(...goals.map((g) => ({ type: 'goal' as const, item: g })))

    const getPercentUsed = (e: BudgetOrGoal) =>
      e.type === 'budget' ? (e.item.budgeted > 0 ? e.item.spent / e.item.budgeted : 0) : e.item.targetAmount > 0 ? e.item.currentBalance / e.item.targetAmount : 0
    const getAmount = (e: BudgetOrGoal) => (e.type === 'budget' ? e.item.budgeted : e.item.targetAmount)
    const getSpent = (e: BudgetOrGoal) => (e.type === 'budget' ? e.item.spent : e.item.currentBalance)
    const getName = (e: BudgetOrGoal) => e.item.name

    items.sort((a, b) => {
      let comparison = 0
      switch (filter.sortField) {
        case 'name':
          comparison = getName(a).localeCompare(getName(b))
          break
        case 'budgeted':
          comparison = getAmount(a) - getAmount(b)
          break
        case 'spent':
          comparison = getSpent(a) - getSpent(b)
          break
        case 'percentUsed':
          comparison = getPercentUsed(a) - getPercentUsed(b)
          break
      }
      return filter.sortDirection === 'asc' ? comparison : -comparison
    })
    return items
  }, [budgets, goals, filter])

  const handleTimeRangeChange = (range: TimeRange) => {
    setTimeRange(range)
    onTimeRangeChange?.(range)
  }

  const handleFilterChange = (updates: Partial<FilterState>) => {
    const newFilter = { ...filter, ...updates }
    setFilter(newFilter)
    onFilterChange?.(newFilter)
  }

  const handleCardClick = (budget?: Budget, goal?: Goal) => {
    if (budget) {
      setSelectedBudget(budget)
      setSelectedGoal(budget.linkedGoalId ? goals.find((g) => g.id === budget.linkedGoalId) ?? null : null)
      onViewBudget?.(budget.id)
    } else if (goal) {
      setSelectedGoal(goal)
      setSelectedBudget(budgets.find((b) => b.id === goal.linkedBudgetId) ?? null)
      onViewGoal?.(goal.id)
    }
    setIsDrawerOpen(true)
  }

  const handleDrawerClose = () => {
    setIsDrawerOpen(false)
    setSelectedBudget(null)
    setSelectedGoal(null)
  }

  const selectedContributions = useMemo(() => {
    if (!selectedGoal) return []
    return goalContributions.filter((c) => c.goalId === selectedGoal.id)
  }, [selectedGoal, goalContributions])

  const percentUsed = summary.totalBudgeted > 0 ? Math.round((summary.totalSpent / summary.totalBudgeted) * 100) : 0
  const remaining = summary.totalBudgeted - summary.totalSpent
  const over = remaining < 0

  // Month navigation (YYYY-MM)
  const currentMonthStr = (() => {
    const n = new Date()
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`
  })()
  const activeMonth = selectedMonth ?? currentMonthStr
  const shiftMonth = (ym: string, delta: number) => {
    const [y, m] = ym.split('-').map(Number)
    const d = new Date(y, m - 1 + delta, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }
  const canGoNext = activeMonth < currentMonthStr

  const eyebrow: CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--fg3)' }
  const breakdown = [
    { k: 'Total Budgeted', v: formatCurrency(summary.totalBudgeted), color: 'var(--fg)' },
    { k: 'Total Spent', v: formatCurrency(summary.totalSpent), color: over ? 'var(--warn)' : 'var(--fg)' },
    { k: 'Remaining', v: formatCurrency(Math.abs(remaining)) + (over ? ' over' : ''), color: over ? 'var(--bad)' : 'var(--good)' },
  ]

  const selectStyle: CSSProperties = {
    height: 36,
    borderRadius: 10,
    padding: '0 10px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid var(--card-border)',
    color: 'var(--fg)',
    fontFamily: 'var(--font-sans)',
    fontSize: 13,
    outline: 'none',
    colorScheme: 'dark',
  }

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6 lg:px-8 lg:py-6">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--fg)' }}>Budgets</h1>
          {onMonthChange ? (
            <div className="mt-1.5 flex items-center gap-2">
              <button onClick={() => onMonthChange(shiftMonth(activeMonth, -1))} aria-label="Previous month" className="flex h-7 w-7 items-center justify-center rounded-md" style={{ color: 'var(--fg3)' }}>
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="min-w-[8rem] text-center" style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg2)' }}>{summary.month}</span>
              <button
                onClick={() => canGoNext && onMonthChange(shiftMonth(activeMonth, 1))}
                disabled={!canGoNext}
                aria-label="Next month"
                className="flex h-7 w-7 items-center justify-center rounded-md disabled:opacity-30"
                style={{ color: 'var(--fg3)' }}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <p style={{ marginTop: 4, fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--fg3)' }}>{summary.month}</p>
          )}
        </div>
        <Button variant="primary" icon={Plus} onClick={() => setIsCreateModalOpen(true)}>
          Add Budget
        </Button>
      </div>

      {/* Overview hero */}
      <Card accent pad={28} style={{ marginBottom: 24, overflow: 'hidden' }}>
        <div aria-hidden style={{ position: 'absolute', right: -60, top: -60, width: 240, height: 240, borderRadius: '50%', background: 'radial-gradient(circle, var(--accent-soft), transparent 60%)', pointerEvents: 'none' }} />
        <div className="relative grid grid-cols-1 items-center gap-8 md:grid-cols-[160px_1fr]">
          <div className="mx-auto md:mx-0">
            <BudgetRing percent={percentUsed} />
          </div>
          <div>
            <div className="mb-2 flex items-center gap-3">
              <span style={{ ...eyebrow, letterSpacing: '0.18em' }}>Monthly budget · {summary.month}</span>
              <Badge tone={over ? 'bad' : 'good'} dot>
                {over ? 'over budget' : 'on track'}
              </Badge>
            </div>
            <div className="flex flex-wrap items-baseline gap-3">
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 44, fontWeight: 600, letterSpacing: '-0.025em', color: 'var(--fg)' }}>
                {formatCurrency(summary.totalSpent)}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 16, color: 'var(--fg3)' }}>/ {formatCurrency(summary.totalBudgeted)}</span>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-4">
              {breakdown.map((row, i) => (
                <div key={row.k} style={{ paddingLeft: i ? 16 : 0, borderLeft: i ? '1px solid var(--card-border)' : 'none' }}>
                  <div style={eyebrow}>{row.k}</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600, color: row.color, marginTop: 8 }}>{row.v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Spending chart */}
      <div className="mb-6">
        <SpendingChart data={monthlyHistory} timeRange={timeRange} onTimeRangeChange={handleTimeRangeChange} />
      </div>

      {/* Tabs + sort */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="inline-flex gap-0.5 self-start rounded-xl p-1" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--card-border)' }}>
          {TYPE_TABS.map((tab) => {
            const active = filter.type === tab.value
            const Icon = tab.icon
            return (
              <button
                key={tab.value}
                onClick={() => handleFilterChange({ type: tab.value })}
                className="inline-flex items-center gap-1.5 rounded-[9px] px-3.5 py-2"
                style={{
                  background: active ? 'var(--accent-soft)' : 'transparent',
                  color: active ? 'var(--accent-a)' : 'var(--fg2)',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                  fontSize: 12,
                  fontWeight: 500,
                }}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            )
          })}
        </div>
        <span className="hidden flex-1 sm:block" />
        <div className="flex items-center gap-2">
          <label style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--fg3)' }}>Sort by:</label>
          <select value={filter.sortField} onChange={(e) => handleFilterChange({ sortField: e.target.value as SortField })} style={selectStyle}>
            <option value="percentUsed">% Used</option>
            <option value="name">Name</option>
            <option value="budgeted">Amount</option>
            <option value="spent">Spent</option>
          </select>
          <button
            onClick={() => handleFilterChange({ sortDirection: filter.sortDirection === 'asc' ? 'desc' : 'asc' })}
            aria-label={filter.sortDirection === 'asc' ? 'Sort descending' : 'Sort ascending'}
            className="flex h-9 w-9 items-center justify-center rounded-lg"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--card-border)', color: 'var(--fg2)' }}
          >
            <ChevronLeft className="h-4 w-4" style={{ transform: filter.sortDirection === 'desc' ? 'rotate(-90deg)' : 'rotate(90deg)' }} />
          </button>
        </div>
      </div>

      {/* Grid */}
      {sortedItems.length === 0 ? (
        <Card pad={0}>
          <Empty
            icon={PiggyBank}
            title="No budgets yet"
            body="Create your first budget to start tracking spending"
            action={
              <div className="mt-4 flex justify-center">
                <Button variant="ghost" icon={Plus} onClick={() => setIsCreateModalOpen(true)}>
                  Add your first budget
                </Button>
              </div>
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sortedItems.map((entry) =>
            entry.type === 'budget' ? (
              <BudgetCard key={entry.item.id} budget={entry.item} isCategory={entry.item.isCategory} onClick={() => handleCardClick(entry.item)} />
            ) : (
              <BudgetCard key={entry.item.id} goal={entry.item} onClick={() => handleCardClick(undefined, entry.item)} />
            ),
          )}
        </div>
      )}

      {/* Drawer */}
      <BudgetDrawer
        budget={selectedBudget}
        goal={selectedGoal}
        contributions={selectedContributions}
        transactions={transactions}
        isOpen={isDrawerOpen}
        onClose={handleDrawerClose}
        onSaveBudget={(id, updates) => onEditBudget?.(id, updates)}
        onSaveGoal={(id, updates) => onEditGoal?.(id, updates)}
        onDelete={(id) => onDeleteBudget?.(id)}
        onArchiveGoal={(id) => onArchiveGoal?.(id)}
      />

      {/* Create Modal */}
      <CreateBudgetModal
        categories={categories}
        savingsAccounts={savingsAccounts}
        categoryAverages={categoryAverages}
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreateBudget={onCreateBudget}
        onCreateSinkingFund={onCreateSinkingFund}
      />
    </div>
  )
}
