import { createClient } from "@/lib/supabase/server"
import { redirect, notFound } from "next/navigation"
import { TransactionForm } from "@/components/transactions/transaction-form"

export default async function EditTransactionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  // Fetch the transaction
  const { data: transaction } = await supabase
    .from("transactions")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single()

  if (!transaction) {
    notFound()
  }

  // Fetch categories and accounts
  const [{ data: categories }, { data: accounts }] = await Promise.all([
    supabase.from("categories").select("*").or(`user_id.eq.${user.id},is_system.eq.true`),
    supabase.from("accounts").select("*").eq("user_id", user.id).eq("is_active", true),
  ])

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Editar Transaccion</h1>
        <p className="text-muted-foreground">
          Modifica los detalles de la transaccion
        </p>
      </div>

      <TransactionForm
        categories={categories || []}
        accounts={accounts || []}
        userId={user.id}
        transaction={transaction}
      />
    </div>
  )
}
