"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { BudgetList } from "@/components/budgets/budget-list"
import { BudgetFormDialog } from "@/components/budgets/budget-form-dialog"
import { useI18n } from "@/lib/i18n/context"

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

export default function BudgetsPage() {
  const supabase = createClient()
  const { locale } = useI18n()
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [spending, setSpending] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null)

  const fetchData = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Fetch budgets with category info
    const { data: budgetsData } = await supabase
      .from("budgets")
      .select(`
        *,
        category:categories(id, name, name_es, icon, color, type)
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })

    // Fetch expense categories for the form
    const { data: categoriesData } = await supabase
      .from("categories")
      .select("*")
      .eq("type", "expense")
      .or(`user_id.eq.${user.id},is_system.eq.true`)

    // Calculate spending per category for active budgets
    if (budgetsData) {
      const spendingMap: Record<string, number> = {}
      
      for (const budget of budgetsData) {
        const { data: transactions } = await supabase
          .from("transactions")
          .select("amount")
          .eq("user_id", user.id)
          .eq("category_id", budget.category_id)
          .gte("transaction_date", budget.start_date)
          .lte("transaction_date", budget.end_date)

        spendingMap[budget.id] = transactions?.reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0) || 0
      }
      
      setSpending(spendingMap)
    }

    setBudgets(budgetsData || [])
    setCategories(categoriesData || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleEdit = (budget: Budget) => {
    setEditingBudget(budget)
    setDialogOpen(true)
  }

  const handleDelete = async (budgetId: string) => {
    await supabase.from("budgets").delete().eq("id", budgetId)
    fetchData()
  }

  const handleDialogClose = () => {
    setDialogOpen(false)
    setEditingBudget(null)
  }

  const handleSuccess = () => {
    handleDialogClose()
    fetchData()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {locale === "es" ? "Presupuestos" : "Budgets"}
          </h1>
          <p className="text-muted-foreground">
            {locale === "es" 
              ? "Establece límites de gasto por categoría" 
              : "Set spending limits by category"}
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="bg-[#0f4c81] hover:bg-[#0f4c81]/90">
          <Plus className="size-4 mr-2" />
          {locale === "es" ? "Nuevo Presupuesto" : "New Budget"}
        </Button>
      </div>

      <BudgetList
        budgets={budgets}
        spending={spending}
        loading={loading}
        locale={locale}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      <BudgetFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        budget={editingBudget}
        categories={categories}
        locale={locale}
        onSuccess={handleSuccess}
        onCancel={handleDialogClose}
      />
    </div>
  )
}
