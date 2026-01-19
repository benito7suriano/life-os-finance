"use client"

import { useState, useMemo } from "react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, type ChartConfig } from "@/components/ui/chart"
import { formatCurrency } from "@/lib/utils/format"
import { cn } from "@/lib/utils"

type TimeFilter = "d" | "s" | "m" | "a"

interface Transaction {
  amount: number
  transaction_date: string
  category: {
    type: string
  } | null
}

interface TrendChartProps {
  transactions: Transaction[]
}

const timeFilters: { label: string; value: TimeFilter }[] = [
  { label: "D", value: "d" },
  { label: "S", value: "s" },
  { label: "M", value: "m" },
  { label: "A", value: "a" },
]

const chartConfig = {
  income: {
    label: "Ingresos",
    color: "#22c55e",
  },
  expenses: {
    label: "Gastos",
    color: "#ef4444",
  },
} satisfies ChartConfig

const dayNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]
const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]

function getStartOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Adjust when day is Sunday
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function groupByDay(transactions: Transaction[]): { label: string; income: number; expenses: number; sortKey: number }[] {
  const now = new Date()
  const result: { label: string; income: number; expenses: number; sortKey: number }[] = []

  // Generate last 7 days
  for (let i = 6; i >= 0; i--) {
    const date = new Date(now)
    date.setDate(date.getDate() - i)
    date.setHours(0, 0, 0, 0)
    const dateStr = date.toISOString().split("T")[0]
    const dayName = dayNames[date.getDay()]
    const dayNum = date.getDate()

    const dayTransactions = transactions.filter((t) => t.transaction_date === dateStr)

    const income = dayTransactions
      .filter((t) => t.category?.type === "income")
      .reduce((sum, t) => sum + Number(t.amount), 0)

    const expenses = dayTransactions
      .filter((t) => t.category?.type === "expense")
      .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0)

    result.push({
      label: `${dayName} ${dayNum}`,
      income,
      expenses,
      sortKey: date.getTime(),
    })
  }

  return result
}

function groupByWeek(transactions: Transaction[]): { label: string; income: number; expenses: number; sortKey: number }[] {
  const now = new Date()
  const result: { label: string; income: number; expenses: number; sortKey: number }[] = []

  // Generate last 4 weeks
  for (let i = 3; i >= 0; i--) {
    const weekStart = getStartOfWeek(new Date(now))
    weekStart.setDate(weekStart.getDate() - i * 7)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 6)
    weekEnd.setHours(23, 59, 59, 999)

    const weekTransactions = transactions.filter((t) => {
      const txDate = new Date(t.transaction_date)
      return txDate >= weekStart && txDate <= weekEnd
    })

    const income = weekTransactions
      .filter((t) => t.category?.type === "income")
      .reduce((sum, t) => sum + Number(t.amount), 0)

    const expenses = weekTransactions
      .filter((t) => t.category?.type === "expense")
      .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0)

    const startDay = dayNames[weekStart.getDay()]
    const startNum = weekStart.getDate()
    const endDay = dayNames[weekEnd.getDay()]
    const endNum = weekEnd.getDate()
    
    result.push({
      label: `${startDay} ${startNum} - ${endDay} ${endNum}`,
      income,
      expenses,
      sortKey: weekStart.getTime(),
    })
  }

  return result
}

function groupByMonth(transactions: Transaction[]): { label: string; income: number; expenses: number; sortKey: number }[] {
  const now = new Date()
  const result: { label: string; income: number; expenses: number; sortKey: number }[] = []

  // Generate last 12 months
  for (let i = 11; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`

    const monthTransactions = transactions.filter((t) => t.transaction_date.startsWith(monthKey))

    const income = monthTransactions
      .filter((t) => t.category?.type === "income")
      .reduce((sum, t) => sum + Number(t.amount), 0)

    const expenses = monthTransactions
      .filter((t) => t.category?.type === "expense")
      .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0)

    result.push({
      label: monthNames[date.getMonth()],
      income,
      expenses,
      sortKey: date.getTime(),
    })
  }

  return result
}

function groupByYear(transactions: Transaction[]): { label: string; income: number; expenses: number; sortKey: number }[] {
  // Get all unique years from transactions
  const years = new Set<number>()
  transactions.forEach((t) => {
    const year = new Date(t.transaction_date).getFullYear()
    years.add(year)
  })

  // If no transactions, show current year
  if (years.size === 0) {
    years.add(new Date().getFullYear())
  }

  const sortedYears = Array.from(years).sort((a, b) => a - b)

  return sortedYears.map((year) => {
    const yearTransactions = transactions.filter((t) => t.transaction_date.startsWith(String(year)))

    const income = yearTransactions
      .filter((t) => t.category?.type === "income")
      .reduce((sum, t) => sum + Number(t.amount), 0)

    const expenses = yearTransactions
      .filter((t) => t.category?.type === "expense")
      .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0)

    return {
      label: String(year),
      income,
      expenses,
      sortKey: year,
    }
  })
}

export function TrendChart({ transactions }: TrendChartProps) {
  const [activeFilter, setActiveFilter] = useState<TimeFilter>("m")

  const data = useMemo(() => {
    switch (activeFilter) {
      case "d":
        return groupByDay(transactions)
      case "s":
        return groupByWeek(transactions)
      case "m":
        return groupByMonth(transactions)
      case "a":
        return groupByYear(transactions)
    }
  }, [transactions, activeFilter])

  const chartData = data.map(({ label, income, expenses }) => ({
    label,
    income,
    expenses,
  }))

  if (chartData.every((d) => d.income === 0 && d.expenses === 0)) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base">Tendencia</CardTitle>
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
            <p className="text-sm text-muted-foreground">Sin datos suficientes</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base">Tendencia</CardTitle>
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
        <ChartContainer config={chartConfig} className="h-[200px] w-full">
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
            <YAxis tickLine={false} axisLine={false} fontSize={12} tickFormatter={(value) => `$${value}`} />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null
                return (
                  <div className="rounded-lg border bg-background px-3 py-2 shadow-md">
                    <p className="font-medium mb-1">{label}</p>
                    {payload.map((entry, index) => (
                      <p key={index} style={{ color: entry.color }} className="text-sm">
                        {entry.name === "income" ? "Ingresos" : "Gastos"}: {formatCurrency(Number(entry.value))}
                      </p>
                    ))}
                  </div>
                )
              }}
            />
            <Bar dataKey="income" fill="#22c55e" radius={[4, 4, 0, 0]} />
            <Bar dataKey="expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartContainer>
        <div className="mt-4 flex justify-center gap-6">
          <div className="flex items-center gap-2">
            <div className="size-3 rounded-full bg-green-500" />
            <span className="text-xs text-muted-foreground">Ingresos</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="size-3 rounded-full bg-red-500" />
            <span className="text-xs text-muted-foreground">Gastos</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Keep old export for backwards compatibility during migration
export { TrendChart as MonthlyTrendChart }
