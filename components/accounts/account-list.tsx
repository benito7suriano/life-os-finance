"use client"

import React from "react"

import {
  Wallet,
  PiggyBank,
  CreditCard,
  Banknote,
  TrendingUp,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Skeleton } from "@/components/ui/skeleton"
import type { Account } from "@/lib/database.types"
import { useState } from "react"

const accountIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  checking: Wallet,
  savings: PiggyBank,
  credit: CreditCard,
  cash: Banknote,
  investment: TrendingUp,
}

const accountTypeLabels: Record<string, string> = {
  checking: "Cuenta Corriente",
  savings: "Ahorros",
  credit: "Tarjeta de Crédito",
  cash: "Efectivo",
  investment: "Inversión",
}

interface AccountListProps {
  accounts: Account[]
  accountBalances: Record<string, number>
  loading: boolean
  onEdit: (account: Account) => void
  onDelete: (accountId: string) => void
}

export function AccountList({ accounts, accountBalances, loading, onEdit, onDelete }: AccountListProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null)

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Skeleton className="size-12 rounded-full" />
                  <div>
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="mt-1 h-4 w-16" />
                  </div>
                </div>
              </div>
              <div className="mt-4">
                <Skeleton className="h-7 w-28" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (accounts.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <div className="rounded-full bg-muted p-3">
            <Wallet className="size-6 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">No tienes cuentas</h3>
          <p className="mt-1 text-center text-sm text-muted-foreground">
            Crea tu primera cuenta para comenzar a registrar transacciones
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {accounts.map((account) => {
          const Icon = accountIcons[account.type] || Wallet
          const isCredit = account.type === "credit"
          const balance = accountBalances[account.id] ?? account.balance ?? 0

          return (
            <Card key={account.id} className="overflow-hidden transition-shadow hover:shadow-md">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex size-12 items-center justify-center rounded-full"
                      style={{ backgroundColor: `${account.color || "#0f4c81"}20` }}
                    >
                      <Icon
                        className="size-6"
                        style={{ color: account.color || "#0f4c81" }}
                      />
                    </div>
                    <div>
                      <h3 className="font-semibold">{account.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {accountTypeLabels[account.type] || account.type}
                      </p>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-8">
                        <MoreHorizontal className="size-4" />
                        <span className="sr-only">Acciones</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEdit(account)}>
                        <Pencil className="mr-2 size-4" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setDeleteId(account.id)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="mr-2 size-4" />
                        Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="mt-4">
                  <p className="text-sm text-muted-foreground">
                    {isCredit ? "Saldo por pagar" : "Balance disponible"}
                  </p>
                  <p
                    className={`text-2xl font-bold ${
                      isCredit && balance > 0 ? "text-red-600" : ""
                    }`}
                  >
                    {isCredit && balance > 0 ? "-" : ""}$
                    {Math.abs(balance).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar cuenta</AlertDialogTitle>
            <AlertDialogDescription>
              Esta accion eliminara la cuenta y todas sus transacciones asociadas.
              Esta accion no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteId) onDelete(deleteId)
                setDeleteId(null)
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
