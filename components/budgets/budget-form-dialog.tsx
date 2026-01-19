"use client"

import React from "react"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

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

interface Category {
  id: string
  name: string
  name_es: string
  icon: string
  color: string
  type: string
}

interface BudgetFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  budget: Budget | null
  categories: Category[]
  locale: string
  onSuccess: () => void
  onCancel: () => void
}

const periodOptions = [
  { value: "weekly", labelEs: "Semanal", labelEn: "Weekly" },
  { value: "monthly", labelEs: "Mensual", labelEn: "Monthly" },
  { value: "yearly", labelEs: "Anual", labelEn: "Yearly" },
  { value: "custom", labelEs: "Personalizado", labelEn: "Custom" },
]

export function BudgetFormDialog({
  open,
  onOpenChange,
  budget,
  categories,
  locale,
  onSuccess,
  onCancel,
}: BudgetFormDialogProps) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [categoryId, setCategoryId] = useState("")
  const [amountLimit, setAmountLimit] = useState("")
  const [periodType, setPeriodType] = useState("monthly")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")

  const isEditing = !!budget

  // Calculate end date based on period type
  const calculateEndDate = (start: string, period: string) => {
    if (!start) return ""
    const startD = new Date(start)
    
    switch (period) {
      case "weekly":
        startD.setDate(startD.getDate() + 6)
        break
      case "monthly":
        startD.setMonth(startD.getMonth() + 1)
        startD.setDate(startD.getDate() - 1)
        break
      case "yearly":
        startD.setFullYear(startD.getFullYear() + 1)
        startD.setDate(startD.getDate() - 1)
        break
      default:
        return endDate // Keep custom end date
    }
    
    return startD.toISOString().split("T")[0]
  }

  useEffect(() => {
    if (budget) {
      setCategoryId(budget.category_id)
      setAmountLimit(String(budget.amount_limit))
      setPeriodType(budget.period_type)
      setStartDate(budget.start_date)
      setEndDate(budget.end_date)
    } else {
      // Default to current month
      const today = new Date()
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0)
      
      setCategoryId("")
      setAmountLimit("")
      setPeriodType("monthly")
      setStartDate(firstDay.toISOString().split("T")[0])
      setEndDate(lastDay.toISOString().split("T")[0])
    }
  }, [budget, open])

  useEffect(() => {
    if (periodType !== "custom" && startDate) {
      setEndDate(calculateEndDate(startDate, periodType))
    }
  }, [periodType, startDate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!categoryId || !amountLimit || !startDate || !endDate) {
      toast.error(locale === "es" ? "Por favor completa todos los campos" : "Please fill all fields")
      return
    }

    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      toast.error(locale === "es" ? "Sesión expirada" : "Session expired")
      setLoading(false)
      return
    }

    const budgetData = {
      user_id: user.id,
      category_id: categoryId,
      amount_limit: parseFloat(amountLimit),
      period_type: periodType,
      start_date: startDate,
      end_date: endDate,
      is_active: true,
    }

    let error

    if (isEditing) {
      const result = await supabase
        .from("budgets")
        .update(budgetData)
        .eq("id", budget.id)
      error = result.error
    } else {
      const result = await supabase.from("budgets").insert(budgetData)
      error = result.error
    }

    setLoading(false)

    if (error) {
      toast.error(locale === "es" ? "Error al guardar el presupuesto" : "Error saving budget")
      console.error(error)
      return
    }

    toast.success(
      isEditing
        ? locale === "es" ? "Presupuesto actualizado" : "Budget updated"
        : locale === "es" ? "Presupuesto creado" : "Budget created"
    )
    onSuccess()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing
              ? locale === "es" ? "Editar Presupuesto" : "Edit Budget"
              : locale === "es" ? "Nuevo Presupuesto" : "New Budget"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="category">
              {locale === "es" ? "Categoría" : "Category"}
            </Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder={locale === "es" ? "Selecciona una categoría" : "Select a category"} />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className="size-3 rounded-full"
                        style={{ backgroundColor: cat.color }}
                      />
                      {locale === "es" ? cat.name_es : cat.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">
              {locale === "es" ? "Límite de Gasto ($)" : "Spending Limit ($)"}
            </Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0"
              value={amountLimit}
              onChange={(e) => setAmountLimit(e.target.value)}
              placeholder="0.00"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="period">
              {locale === "es" ? "Período" : "Period"}
            </Label>
            <Select value={periodType} onValueChange={setPeriodType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {periodOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {locale === "es" ? opt.labelEs : opt.labelEn}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">
                {locale === "es" ? "Fecha Inicio" : "Start Date"}
              </Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">
                {locale === "es" ? "Fecha Fin" : "End Date"}
              </Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={periodType !== "custom"}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={onCancel}>
              {locale === "es" ? "Cancelar" : "Cancel"}
            </Button>
            <Button type="submit" disabled={loading} className="bg-[#0f4c81] hover:bg-[#0f4c81]/90">
              {loading && <Loader2 className="size-4 mr-2 animate-spin" />}
              {isEditing
                ? locale === "es" ? "Guardar" : "Save"
                : locale === "es" ? "Crear" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
