import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { TransactionForm } from "@/components/transactions/transaction-form"

export default async function NewTransactionPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  // Fetch categories and accounts
  const [{ data: categories }, { data: accounts }] = await Promise.all([
    supabase.from("categories").select("*").or(`user_id.eq.${user.id},is_system.eq.true`),
    supabase.from("accounts").select("*").eq("user_id", user.id).eq("is_active", true),
  ])

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Nueva Transacción</h1>
        <p className="text-muted-foreground">
          Agrega una nueva transacción manualmente
        </p>
      </div>

      <TransactionForm
        categories={categories || []}
        accounts={accounts || []}
        userId={user.id}
      />
    </div>
  )
}
