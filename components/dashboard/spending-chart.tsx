"use client"

import { useState, useMemo } from "react"
import { PieChart, Pie, Cell, Tooltip } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, type ChartConfig } from "@/components/ui/chart"
import { formatCurrency, parseDateString } from "@/lib/utils/format"
import { cn } from "@/lib/utils"

type TimeFilter = "d" | "s" | "m" | "a" | "t"

interface Transaction {
  amount: number
  transaction_date: string
  category: {
    id: string
    name: string
    name_es: string
    color: string
    type: string
  } | null
}

interface SpendingChartProps {
  transactions: Transaction[]
}

const timeFilters: { label: string; value: TimeFilter }[] = [
  { label: "D", value: "d" },
  { label: "S", value: "s" },
  { label: "M", value: "m" },
  { label: "A", value: "a" },
  { label: "T", value: "t" },
]

const filterLabels: Record<TimeFilter, string> = {
  "d": "hoy",
  "s": "esta semana",
  "m": "este mes",
  "a": "este año",
  "t": "en total",
}

function getStartOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Adjust when day is Sunday
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function getDateRange(filter: TimeFilter): { start: Date; end: Date } | null {
  const now = new Date()

  switch (filter) {
    case "d":
      // Current day: today 00:00 to today 23:59
      const todayStart = new Date(now)
      todayStart.setHours(0, 0, 0, 0)
      const todayEnd = new Date(now)
      todayEnd.setHours(23, 59, 59, 999)
      return { start: todayStart, end: todayEnd }
    case "s":
      // Current week: Monday 00:00 to Sunday 23:59
      const weekStart = getStartOfWeek(now)
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 6)
      weekEnd.setHours(23, 59, 59, 999)
      return { start: weekStart, end: weekEnd }
    case "m":
      // Current month: 1st day 00:00 to last day 23:59
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      monthStart.setHours(0, 0, 0, 0)
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      monthEnd.setHours(23, 59, 59, 999)
      return { start: monthStart, end: monthEnd }
    case "a":
      // Current year: Jan 1 00:00 to Dec 31 23:59
      const yearStart = new Date(now.getFullYear(), 0, 1)
      yearStart.setHours(0, 0, 0, 0)
      const yearEnd = new Date(now.getFullYear(), 11, 31)
      yearEnd.setHours(23, 59, 59, 999)
      return { start: yearStart, end: yearEnd }
    case "t":
      // All transactions
      return null
  }
}

export function SpendingChart({ transactions }: SpendingChartProps) {
  const [activeFilter, setActiveFilter] = useState<TimeFilter>("m")

  const { data, total } = useMemo(() => {
    const range = getDateRange(activeFilter)

    // Filter transactions by date and type (expenses only)
    const filtered = transactions.filter((t) => {
      if (t.category?.type !== "expense") return false
      if (!range) return true
      const txDate = parseDateString(t.transaction_date)
      return txDate >= range.start && txDate <= range.end
    })

    // Group by category
    const byCategory = filtered.reduce(
      (acc, t) => {
        const categoryName = t.category?.name || "Other"
        if (!acc[categoryName]) {
          acc[categoryName] = {
            name: categoryName,
            name_es: t.category?.name_es || "Otros",
            color: t.category?.color || "#94a3b8",
            amount: 0,
          }
        }
        acc[categoryName].amount += Math.abs(Number(t.amount))
        return acc
      },
      {} as Record<string, { name: string; name_es: string; color: string; amount: number }>,
    )

    const sortedData = Object.values(byCategory).sort((a, b) => b.amount - a.amount)
    const totalAmount = sortedData.reduce((sum, item) => sum + item.amount, 0)

    return { data: sortedData, total: totalAmount }
  }, [transactions, activeFilter])

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base">Gastos por Categoría</CardTitle>
          <div className="flex gap-0.5 rounded-lg bg-muted p-0.5">
            {timeFilters.map((filter) => (
              <button
                key={filter.value}
                onClick={() => setActiveFilter(filter.value)}
                className={cn(
                  "px-2 py-1 text-xs font-medium rounded-md transition-colors",
                  activeFilter === filter.value
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex h-[200px] items-center justify-center">
            <p className="text-sm text-muted-foreground">Sin gastos {filterLabels[activeFilter]}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const chartConfig = data.reduce((acc, item) => {
    acc[item.name] = {
      label: item.name_es,
      color: item.color,
    }
    return acc
  }, {} as ChartConfig)

  const chartData = data.map((item) => ({
    name: item.name,
    value: item.amount,
    fill: item.color,
  }))

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base">Gastos por Categoría</CardTitle>
        <div className="flex gap-0.5 rounded-lg bg-muted p-0.5">
          {timeFilters.map((filter) => (
            <button
              key={filter.value}
              onClick={() => setActiveFilter(filter.value)}
              className={cn(
                "px-2 py-1 text-xs font-medium rounded-md transition-colors",
                activeFilter === filter.value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center md:flex-row md:justify-center gap-6">
          {/* Columna izquierda: Donut */}
          <ChartContainer config={chartConfig} className="aspect-square h-[200px] flex-shrink-0">
            <PieChart>
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const data = payload[0].payload
                  return (
                    <div className="rounded-lg border bg-background px-3 py-2 shadow-md">
                      <p className="font-medium">{chartConfig[data.name]?.label || data.name}</p>
                      <p className="text-muted-foreground">{formatCurrency(data.value)}</p>
                    </div>
                  )
                }}
              />
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
            </PieChart>
          </ChartContainer>

          {/* Columna derecha: Total + Categorías */}
          <div className="flex flex-col">
            <div className="text-center md:text-left">
              <p className="text-2xl font-bold">{formatCurrency(total)}</p>
              <p className="text-sm text-muted-foreground">Total gastado {filterLabels[activeFilter]}</p>
            </div>
            <div className="mt-4 flex flex-col items-center md:items-start gap-2">
              {data.slice(0, 4).map((item) => (
                <div key={item.name} className="flex items-center gap-2">
                  <div className="size-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-xs text-muted-foreground truncate">{item.name_es}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
