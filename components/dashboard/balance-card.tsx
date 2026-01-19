import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Wallet, TrendingDown, TrendingUp, AlertCircle, ArrowUp, ArrowDown } from "lucide-react"
import { formatCurrency } from "@/lib/utils/format"
import Link from "next/link"

interface BalanceCardProps {
  totalBalance: number
  monthlySpending: number
  monthlyIncome: number
  reviewCount: number
  dailyChange: number
  dailyChangePercent: number
}

export function BalanceCards({
  totalBalance,
  monthlySpending,
  monthlyIncome,
  reviewCount,
  dailyChange,
  dailyChangePercent,
}: BalanceCardProps) {
  const isPositive = dailyChange >= 0
  const changeColor = isPositive ? "text-green-600" : "text-red-600"
  const ChangeIcon = isPositive ? ArrowUp : ArrowDown

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Patrimonio neto</CardTitle>
          <Wallet className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(totalBalance)}</div>
          <div className={`flex items-center gap-1 text-xs ${changeColor}`}>
            <ChangeIcon className="size-3" />
            <span>
              {isPositive ? "+" : ""}
              {formatCurrency(Math.abs(dailyChange))} ({Math.abs(dailyChangePercent).toFixed(1)}%)
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Gastos del Mes</CardTitle>
          <TrendingDown className="size-4 text-red-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600">-{formatCurrency(monthlySpending)}</div>
          <p className="text-xs text-muted-foreground">Este mes</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Ingresos del Mes</CardTitle>
          <TrendingUp className="size-4 text-green-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">+{formatCurrency(monthlyIncome)}</div>
          <p className="text-xs text-muted-foreground">Este mes</p>
        </CardContent>
      </Card>

      <Link href="/dashboard/transactions?filter=needs_review">
        <Card
          className={`transition-colors hover:border-orange-300 ${reviewCount > 0 ? "border-orange-200 bg-orange-50" : ""}`}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Necesitan Revisión</CardTitle>
            <AlertCircle className={`size-4 ${reviewCount > 0 ? "text-orange-500" : "text-muted-foreground"}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reviewCount}</div>
            <p className="text-xs text-muted-foreground">Transacciones pendientes</p>
          </CardContent>
        </Card>
      </Link>
    </div>
  )
}
