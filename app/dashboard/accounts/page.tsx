"use client"

import { useEffect, useState } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AccountList } from "@/components/accounts/account-list"
import { AccountForm } from "@/components/accounts/account-form"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { createClient } from "@/lib/supabase/client"
import type { Account } from "@/lib/database.types"
import { toast } from "sonner"

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)
  const supabase = createClient()

  const fetchAccounts = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase
      .from("accounts")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })

    if (error) {
      toast.error("Error al cargar las cuentas")
      console.error(error)
    } else {
      setAccounts(data || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchAccounts()
  }, [])

  const handleCreateSuccess = () => {
    setIsCreateOpen(false)
    fetchAccounts()
    toast.success("Cuenta creada exitosamente")
  }

  const handleEditSuccess = () => {
    setEditingAccount(null)
    fetchAccounts()
    toast.success("Cuenta actualizada exitosamente")
  }

  const handleDelete = async (accountId: string) => {
    const { error } = await supabase
      .from("accounts")
      .delete()
      .eq("id", accountId)

    if (error) {
      toast.error("Error al eliminar la cuenta")
      console.error(error)
    } else {
      fetchAccounts()
      toast.success("Cuenta eliminada exitosamente")
    }
  }

  // Calculate total balance
  const totalBalance = accounts.reduce((sum, account) => {
    if (account.type === "credit") {
      return sum - (account.balance || 0)
    }
    return sum + (account.balance || 0)
  }, 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cuentas</h1>
          <p className="text-muted-foreground">
            Administra tus cuentas bancarias, tarjetas y efectivo
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#0f4c81] hover:bg-[#0f4c81]/90">
              <Plus className="mr-2 size-4" />
              Nueva Cuenta
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Crear Nueva Cuenta</DialogTitle>
            </DialogHeader>
            <AccountForm onSuccess={handleCreateSuccess} onCancel={() => setIsCreateOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Total Balance Card */}
      <div className="rounded-xl border bg-gradient-to-br from-[#0f4c81] to-[#14b8a6] p-6 text-white">
        <p className="text-sm font-medium text-white/80">Balance Total</p>
        <p className="mt-1 text-3xl font-bold">
          ${totalBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
        </p>
        <p className="mt-1 text-sm text-white/70">
          {accounts.length} {accounts.length === 1 ? "cuenta" : "cuentas"} activas
        </p>
      </div>

      {/* Accounts List */}
      <AccountList
        accounts={accounts}
        loading={loading}
        onEdit={setEditingAccount}
        onDelete={handleDelete}
      />

      {/* Edit Dialog */}
      <Dialog open={!!editingAccount} onOpenChange={(open) => !open && setEditingAccount(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Editar Cuenta</DialogTitle>
          </DialogHeader>
          {editingAccount && (
            <AccountForm
              account={editingAccount}
              onSuccess={handleEditSuccess}
              onCancel={() => setEditingAccount(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
