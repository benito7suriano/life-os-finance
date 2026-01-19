"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
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
import { MoreHorizontal, Pencil, Trash2, Calendar, AlertTriangle } from "lucide-react"
import { formatCurrency, formatDate, parseDateString } from "@/lib/utils/format"
import { useState } from "react"
import { Skeleton } from "@/components/ui/skeleton"

interface Budget {
  id: string
  category_id: string
  amount_limit: number
  period_type: string
  start_date: string
  end_date: string
  is_active: boolean
  category: {
    id: string
    name: string
    name_es: string
    icon: string
    color: string
    type: string
  }
}

interface BudgetListProps {
  budgets: Budget[]
  spending: Record<string, number>
  loading: boolean
  locale: string
  onEdit: (budget: Budget) => void
  onDelete: (budgetId: string) => void
}

const periodLabels: Record<string, { es: string; en: string }> = {
  weekly: { es: "Semanal", en: "Weekly" },
  monthly: { es: "Mensual", en: "Monthly" },
  yearly: { es: "Anual", en: "Yearly" },
  custom: { es: "Personalizado", en: "Custom" },
}

export function BudgetList({ budgets, spending, loading, locale, onEdit, onDelete }: BudgetListProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null)

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-2 w-full" />
              <Skeleton className="h-4 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (budgets.length === 0) {
    return (
      <Card className="p-8 text-center">
        <div className="mx-auto size-12 rounded-full bg-muted flex items-center justify-center mb-4">
          <Calendar className="size-6 text-muted-foreground" />
        </div>
        <h3 className="font-medium mb-1">
          {locale === "es" ? "No hay presupuestos" : "No budgets yet"}
        </h3>
        <p className="text-sm text-muted-foreground">
          {locale === "es"
            ? "Crea tu primer presupuesto para controlar tus gastos"
            : "Create your first budget to track your spending"}
        </p>
      </Card>
    )
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {budgets.map((budget) => {
          const spent = spending[budget.id] || 0
          const limit = Number(budget.amount_limit)
          const percentage = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0
          const remaining = limit - spent
          const isOverBudget = spent > limit
          const isNearLimit = percentage >= 80 && !isOverBudget
          const categoryName = locale === "es" ? budget.category.name_es : budget.category.name

          const today = new Date()
          const endDate = parseDateString(budget.end_date)
          const isExpired = endDate < today

          return (
            <Card key={budget.id} className={isExpired ? "opacity-60" : ""}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="size-8 rounded-full flex items-center justify-center text-white text-sm"
                      style={{ backgroundColor: budget.category.color }}
                    >
                      {categoryName.charAt(0)}
                    </div>
                    <div>
                      <CardTitle className="text-base">{categoryName}</CardTitle>
                      <Badge variant="outline" className="text-xs mt-0.5">
                        {periodLabels[budget.period_type]?.[locale as "es" | "en"] || budget.period_type}
                      </Badge>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-8">
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEdit(budget)}>
                        <Pencil className="size-4 mr-2" />
                        {locale === "es" ? "Editar" : "Edit"}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => setDeleteId(budget.id)}
                      >
                        <Trash2 className="size-4 mr-2" />
                        {locale === "es" ? "Eliminar" : "Delete"}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {locale === "es" ? "Gastado" : "Spent"}
                  </span>
                  <span className={isOverBudget ? "text-red-600 font-medium" : ""}>
                    {formatCurrency(spent)} / {formatCurrency(limit)}
                  </span>
                </div>

                <Progress
                  value={percentage}
                  className={`h-2 ${isOverBudget ? "[&>div]:bg-red-500" : isNearLimit ? "[&>div]:bg-yellow-500" : "[&>div]:bg-[#14b8a6]"}`}
                />

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="size-3" />
                    {formatDate(budget.start_date, locale)} - {formatDate(budget.end_date, locale)}
                  </span>
                  {isOverBudget ? (
                    <span className="flex items-center gap-1 text-red-600">
                      <AlertTriangle className="size-3" />
                      {locale === "es" ? "Excedido" : "Over budget"}
                    </span>
                  ) : isExpired ? (
                    <span className="text-muted-foreground">
                      {locale === "es" ? "Expirado" : "Expired"}
                    </span>
                  ) : (
                    <span className={remaining < 0 ? "text-red-600" : "text-green-600"}>
                      {formatCurrency(Math.abs(remaining))} {locale === "es" ? "restante" : "remaining"}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {locale === "es" ? "¿Eliminar presupuesto?" : "Delete budget?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {locale === "es"
                ? "Esta acción no se puede deshacer. El presupuesto será eliminado permanentemente."
                : "This action cannot be undone. The budget will be permanently deleted."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {locale === "es" ? "Cancelar" : "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => {
                if (deleteId) onDelete(deleteId)
                setDeleteId(null)
              }}
            >
              {locale === "es" ? "Eliminar" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
