import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { TransactionList } from "@/components/transactions/transaction-list"
import { TransactionFilters } from "@/components/transactions/transaction-filters"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import Link from "next/link"

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const params = await searchParams

  // Parse search params
  const page = Number(params.page) || 1
  const limit = 20
  const offset = (page - 1) * limit
  const search = typeof params.search === "string" ? params.search : ""
  const categoryId = typeof params.category === "string" ? params.category : ""
  const accountId = typeof params.account === "string" ? params.account : ""
  const source = typeof params.source === "string" ? params.source : ""
  const needsReview = params.needsReview === "true"
  const startDate = typeof params.startDate === "string" ? params.startDate : ""
  const endDate = typeof params.endDate === "string" ? params.endDate : ""

  // Build query
  let query = supabase
    .from("transactions")
    .select(`
      *,
      category:categories(*),
      account:accounts(*)
    `, { count: "exact" })
    .eq("user_id", user.id)
    .order("transaction_date", { ascending: false })
    .range(offset, offset + limit - 1)

  if (search) {
    query = query.or(`description.ilike.%${search}%,merchant_name.ilike.%${search}%`)
  }
  if (categoryId) {
    query = query.eq("category_id", categoryId)
  }
  if (accountId) {
    query = query.eq("account_id", accountId)
  }
  if (source) {
    query = query.eq("source", source)
  }
  if (needsReview) {
    query = query.eq("needs_review", true)
  }
  if (startDate) {
    query = query.gte("transaction_date", startDate)
  }
  if (endDate) {
    query = query.lte("transaction_date", endDate)
  }

  const { data: transactions, count } = await query

  // Fetch categories and accounts for filters
  const [{ data: categories }, { data: accounts }] = await Promise.all([
    supabase.from("categories").select("*").or(`user_id.eq.${user.id},is_system.eq.true`),
    supabase.from("accounts").select("*").eq("user_id", user.id).eq("is_active", true),
  ])

  const totalPages = Math.ceil((count || 0) / limit)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Transacciones</h1>
          <p className="text-muted-foreground">
            Administra y revisa todas tus transacciones
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/transactions/new">
            <Plus className="mr-2 size-4" />
            Nueva Transaccion
          </Link>
        </Button>
      </div>

      <TransactionFilters
        categories={categories || []}
        accounts={accounts || []}
        currentFilters={{
          search,
          categoryId,
          accountId,
          source,
          needsReview,
          startDate,
          endDate,
        }}
      />

      <TransactionList
        transactions={transactions || []}
        currentPage={page}
        totalPages={totalPages}
        totalCount={count || 0}
      />
    </div>
  )
}
