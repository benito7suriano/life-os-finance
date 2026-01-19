"use client"

import { useRouter } from "next/navigation"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
import { MoreHorizontal, Pencil, Trash, AlertCircle, MessageSquare, Mail, FileText, ChevronLeft, ChevronRight } from "lucide-react"
import { formatCurrency, formatDate } from "@/lib/utils/format"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { useState } from "react"
import type { TransactionWithRelations } from "@/lib/database.types"

interface TransactionListProps {
  transactions: TransactionWithRelations[]
  currentPage: number
  totalPages: number
  totalCount: number
}

export function TransactionList({
  transactions,
  currentPage,
  totalPages,
  totalCount,
}: TransactionListProps) {
  const router = useRouter()
  const supabase = createClient()
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    if (!deleteId) return

    setIsDeleting(true)
    const { error } = await supabase.from("transactions").delete().eq("id", deleteId)

    if (error) {
      toast.error("Error al eliminar la transacción")
    } else {
      toast.success("Transacción eliminada")
      router.refresh()
    }

    setIsDeleting(false)
    setDeleteId(null)
  }

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(window.location.search)
    params.set("page", String(page))
    router.push(`/dashboard/transactions?${params.toString()}`)
  }

  const getSourceIcon = (source: string | null) => {
    switch (source) {
      case "whatsapp":
        return <MessageSquare className="size-3 text-green-500" />
      case "email":
        return <Mail className="size-3 text-blue-500" />
      case "dtes":
        return <FileText className="size-3 text-orange-500" />
      default:
        return null
    }
  }

  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
        <div className="rounded-full bg-muted p-3">
          <FileText className="size-6 text-muted-foreground" />
        </div>
        <h3 className="mt-4 text-lg font-semibold">No hay transacciones</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Comienza agregando tu primera transacción o conecta WhatsApp para importar automáticamente.
        </p>
        <Button className="mt-4" onClick={() => router.push("/dashboard/transactions/new")}>
          Agregar transacción
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Cuenta</TableHead>
              <TableHead className="text-right">Monto</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((transaction) => (
              <TableRow key={transaction.id}>
                <TableCell className="whitespace-nowrap">
                  {formatDate(transaction.transaction_date)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {getSourceIcon(transaction.source)}
                    <div>
                      <p className="font-medium">
                        {transaction.merchant_name || transaction.description || "Sin descripción"}
                      </p>
                      {transaction.merchant_name && transaction.description && (
                        <p className="text-sm text-muted-foreground">{transaction.description}</p>
                      )}
                    </div>
                    {transaction.needs_review && (
                      <AlertCircle className="size-4 text-amber-500" title="Necesita revisión" />
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {transaction.category ? (
                    <Badge
                      variant="outline"
                      style={{
                        borderColor: transaction.category.color || undefined,
                        color: transaction.category.color || undefined,
                      }}
                    >
                      {transaction.category.name_es}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">
                      Sin categoría
                    </Badge>
                  )}
                  {transaction.ai_confidence !== null && transaction.ai_confidence < 0.7 && (
                    <span className="ml-1 text-xs text-amber-500">
                      ({Math.round(transaction.ai_confidence * 100)}%)
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  {transaction.account?.name || "—"}
                </TableCell>
                <TableCell className="text-right">
                  <span
                    className={
                      transaction.category?.type === "income"
                        ? "font-medium text-green-600"
                        : "font-medium text-red-600"
                    }
                  >
                    {transaction.category?.type === "income" ? "+" : "-"}
                    {formatCurrency(Math.abs(transaction.amount))}
                  </span>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => router.push(`/dashboard/transactions/${transaction.id}/edit`)}
                      >
                        <Pencil className="mr-2 size-4" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-red-600"
                        onClick={() => setDeleteId(transaction.id)}
                      >
                        <Trash className="mr-2 size-4" />
                        Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Mostrando {transactions.length} de {totalCount} transacciones
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage <= 1}
          >
            <ChevronLeft className="size-4" />
            Anterior
          </Button>
          <span className="text-sm">
            Página {currentPage} de {totalPages || 1}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
          >
            Siguiente
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar transacción</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. La transacción será eliminada permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
