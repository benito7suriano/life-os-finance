"use client"

import { useState, useMemo } from "react"
import { PieChart, Pie, Cell, Tooltip } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, type ChartConfig } from "@/components/ui/chart"
import { formatCurrency, parseDateString } from "@/lib/utils/format"
import { cn } from "@/lib/utils"

type TimeFilter = "1d" | "1w" | "1m" | "1y" | "all"

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
  { label: "1D", value: "1d" },
  { label: "1W", value: "1w" },
  { label: "1M", value: "1m" },
  { label: "1Y", value: "1y" },
  { label: "All", value: "all" },
]

const filterLabels: Record<TimeFilter, string> = {
  "1d": "hoy",
  "1w": "esta semana",
  "1m": "este mes",
  "1y": "este año",
  "all": "en total",
}

function getDateThreshold(filter: TimeFilter): Date | null {
  const now = new Date()
  now.setHours(23, 59, 59, 999)

  switch (filter) {
    case "1d":
      const today = new Date(now)
      today.setHours(0, 0, 0, 0)
      return today
    case "1w":
      const weekAgo = new Date(now)
      weekAgo.setDate(weekAgo.getDate() - 7)
      weekAgo.setHours(0, 0, 0, 0)
      return weekAgo
    case "1m":
      const monthAgo = new Date(now)
      monthAgo.setMonth(monthAgo.getMonth() - 1)
      monthAgo.setHours(0, 0, 0, 0)
      return monthAgo
    case "1y":
      const yearAgo = new Date(now)
      yearAgo.setFullYear(yearAgo.getFullYear() - 1)
      yearAgo.setHours(0, 0, 0, 0)
      return yearAgo
    case "all":
      return null
  }
}

export function SpendingChart({ transactions }: SpendingChartProps) {
  const [activeFilter, setActiveFilter] = useState<TimeFilter>("1m")

  const { data, total } = useMemo(() => {
    const threshold = getDateThreshold(activeFilter)

    // Filter transactions by date and type (expenses only)
    const filtered = transactions.filter((t) => {
      if (t.category?.type !== "expense") return false
      if (!threshold) return true
      const txDate = parseDateString(t.transaction_date)
      return txDate >= threshold
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
        <ChartContainer config={chartConfig} className="mx-auto aspect-square h-[200px]">
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
        <div className="mt-4 text-center">
          <p className="text-2xl font-bold">{formatCurrency(total)}</p>
          <p className="text-sm text-muted-foreground">Total gastado {filterLabels[activeFilter]}</p>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {data.slice(0, 4).map((item) => (
            <div key={item.name} className="flex items-center gap-2">
              <div className="size-3 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="text-xs text-muted-foreground truncate">{item.name_es}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
