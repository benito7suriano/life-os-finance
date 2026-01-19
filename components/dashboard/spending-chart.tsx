"use client"

import { PieChart, Pie, Cell, Tooltip } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, type ChartConfig } from "@/components/ui/chart"
import { formatCurrency } from "@/lib/utils/format"

interface CategorySpending {
  name: string
  name_es: string
  color: string
  amount: number
}

interface SpendingChartProps {
  data: CategorySpending[]
  total: number
}

export function SpendingChart({ data, total }: SpendingChartProps) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Gastos por Categoría</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-[200px] items-center justify-center">
            <p className="text-sm text-muted-foreground">Sin gastos este mes</p>
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
      <CardHeader>
        <CardTitle className="text-base">Gastos por Categoría</CardTitle>
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
          <p className="text-sm text-muted-foreground">Total gastado este mes</p>
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
