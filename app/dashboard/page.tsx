import { createClient } from "@/lib/supabase/server"
import { BalanceCards } from "@/components/dashboard/balance-card"
import { SpendingChart } from "@/components/dashboard/spending-chart"
import { MonthlyTrendChart } from "@/components/dashboard/monthly-trend-chart"
import { RecentTransactions } from "@/components/dashboard/recent-transactions"
import { QuickActions } from "@/components/dashboard/quick-actions"
import { DashboardWelcome } from "@/components/dashboard/dashboard-welcome"

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Fetch accounts for total balance
  // Fetch user profile for welcome message
  const { data: profile } = await supabase.from("profiles").select("first_name").eq("id", user?.id).single()

  // Fetch accounts for total balance
  const { data: accounts } = await supabase.from("accounts").select("*").eq("user_id", user?.id)

  // Fetch ALL transactions to calculate real balance
  const { data: allTransactions } = await supabase
    .from("transactions")
    .select(
      `
      amount,
      category:categories(type)
    `,
    )
    .eq("user_id", user?.id)

  // Fetch recent transactions with relations
  const { data: transactions } = await supabase
    .from("transactions")
    .select(
      `
      *,
      category:categories(id, name, name_es, icon, color, type),
      account:accounts(id, name)
    `,
    )
    .eq("user_id", user?.id)
    .order("transaction_date", { ascending: false })
    .limit(5)

  // Fetch transactions needing review count
  const { count: reviewCount } = await supabase
    .from("transactions")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user?.id)
    .eq("needs_review", true)

  // Calculate real total balance from transactions (income - expenses)
  const totalIncome =
    allTransactions?.filter((t) => t.category?.type === "income").reduce((sum, t) => sum + Number(t.amount), 0) || 0

  const totalExpenses =
    allTransactions
      ?.filter((t) => t.category?.type === "expense")
      .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0) || 0

  const totalBalance = totalIncome - totalExpenses

  // Calculate yesterday's balance for daily change
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = today.toISOString().split("T")[0]

  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().split("T")[0]

  const { data: transactionsUntilYesterday } = await supabase
    .from("transactions")
    .select(
      `
      amount,
      category:categories(type)
    `,
    )
    .eq("user_id", user?.id)
    .lt("transaction_date", todayStr)

  const yesterdayIncome =
    transactionsUntilYesterday
      ?.filter((t) => t.category?.type === "income")
      .reduce((sum, t) => sum + Number(t.amount), 0) || 0

  const yesterdayExpenses =
    transactionsUntilYesterday
      ?.filter((t) => t.category?.type === "expense")
      .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0) || 0

  const yesterdayBalance = yesterdayIncome - yesterdayExpenses
  const dailyChange = totalBalance - yesterdayBalance
  const dailyChangePercent = yesterdayBalance !== 0 ? (dailyChange / Math.abs(yesterdayBalance)) * 100 : 0

  // Get current month and last 6 months data
  const now = new Date()
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0]
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString().split("T")[0]

  // Fetch current month transactions for spending breakdown
  const { data: monthlyTransactions } = await supabase
    .from("transactions")
    .select(
      `
      amount,
      category:categories(id, name, name_es, color, type)
    `,
    )
    .eq("user_id", user?.id)
    .gte("transaction_date", firstOfMonth)

  // Fetch last 6 months for trend chart
  const { data: trendTransactions } = await supabase
    .from("transactions")
    .select(
      `
      amount,
      transaction_date,
      category:categories(type)
    `,
    )
    .eq("user_id", user?.id)
    .gte("transaction_date", sixMonthsAgo)
    .order("transaction_date", { ascending: true })

  // Calculate monthly spending and income
  const monthlySpending =
    monthlyTransactions
      ?.filter((t) => t.category?.type === "expense")
      .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0) || 0

  const monthlyIncome =
    monthlyTransactions?.filter((t) => t.category?.type === "income").reduce((sum, t) => sum + Number(t.amount), 0) || 0

  // Group spending by category for pie chart
  const spendingByCategory = monthlyTransactions
    ?.filter((t) => t.category?.type === "expense")
    .reduce(
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

  const spendingChartData = Object.values(spendingByCategory || {}).sort((a, b) => b.amount - a.amount)

  // Group transactions by month for trend chart
  const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
  const trendData: { month: string; income: number; expenses: number }[] = []

  for (let i = 5; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
    const monthLabel = monthNames[date.getMonth()]

    const monthTransactions = trendTransactions?.filter((t) => t.transaction_date.startsWith(monthKey)) || []

    const income = monthTransactions
      .filter((t) => t.category?.type === "income")
      .reduce((sum, t) => sum + Number(t.amount), 0)

    const expenses = monthTransactions
      .filter((t) => t.category?.type === "expense")
      .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0)

    trendData.push({ month: monthLabel, income, expenses })
  }

  return (
    <div className="space-y-6">
      {/* Welcome Message with Actions */}
      <DashboardWelcome firstName={profile?.first_name} />

      {/* Stats Cards */}
      <BalanceCards
        totalBalance={totalBalance}
        monthlySpending={monthlySpending}
        monthlyIncome={monthlyIncome}
        reviewCount={reviewCount || 0}
        dailyChange={dailyChange}
        dailyChangePercent={dailyChangePercent}
      />

      {/* Charts Row */}
      <div className="grid gap-4 md:grid-cols-2">
        <SpendingChart data={spendingChartData} total={monthlySpending} />
        <MonthlyTrendChart data={trendData} />
      </div>

      {/* Bottom Row: Quick Actions + Recent Transactions */}
      <div className="grid gap-4 lg:grid-cols-3">
        <QuickActions />
        <RecentTransactions transactions={(transactions as any) || []} />
      </div>
    </div>
  )
}
