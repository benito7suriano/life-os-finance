"use client"

import React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CalendarIcon, Sparkles, Loader2 } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { toast } from "sonner"
import type { Category, Account, Transaction } from "@/lib/database.types"

interface TransactionFormProps {
  categories: Category[]
  accounts: Account[]
  userId: string
  transaction?: Transaction
}

export function TransactionForm({
  categories,
  accounts,
  userId,
  transaction,
}: TransactionFormProps) {
  const router = useRouter()
  const supabase = createClient()
  const isEditing = !!transaction

  const [isLoading, setIsLoading] = useState(false)
  const [isCategorizing, setIsCategorizing] = useState(false)

  // Determine initial transaction type based on existing category or default to expense
  const existingCategory = transaction?.category_id
    ? categories.find((c) => c.id === transaction.category_id)
    : null
  const initialType = existingCategory?.type || "expense"

  const [transactionType, setTransactionType] = useState<"expense" | "income">(
    initialType as "expense" | "income"
  )
  const [amount, setAmount] = useState(transaction?.amount?.toString() || "")
  const [merchantName, setMerchantName] = useState(transaction?.merchant_name || "")
  const [description, setDescription] = useState(transaction?.description || "")
  const [categoryId, setCategoryId] = useState(transaction?.category_id || "")
  const [accountId, setAccountId] = useState(transaction?.account_id || "")
  const [transactionDate, setTransactionDate] = useState<Date>(
    transaction?.transaction_date ? new Date(transaction.transaction_date) : new Date()
  )
  const [aiConfidence, setAiConfidence] = useState<number | null>(
    transaction?.ai_confidence ?? null
  )

  const filteredCategories = categories.filter((c) => c.type === transactionType)

  const handleAICategorize = async () => {
    if (!merchantName && !description) {
      toast.error("Ingresa un comercio o descripcion para categorizar")
      return
    }

    setIsCategorizing(true)

    // Mock AI categorization - in production this would call the AI API
    await new Promise((resolve) => setTimeout(resolve, 1000))

    const searchText = (merchantName + " " + description).toLowerCase()

    // Simple keyword matching for demo
    let suggestedCategory: Category | undefined
    let confidence = 0.85

    if (searchText.includes("uber") || searchText.includes("taxi") || searchText.includes("gasolina")) {
      suggestedCategory = filteredCategories.find((c) => c.name.toLowerCase().includes("transport"))
      confidence = 0.92
    } else if (searchText.includes("restaurante") || searchText.includes("comida") || searchText.includes("cafe")) {
      suggestedCategory = filteredCategories.find((c) => c.name.toLowerCase().includes("food"))
      confidence = 0.88
    } else if (searchText.includes("supermercado") || searchText.includes("super") || searchText.includes("walmart")) {
      suggestedCategory = filteredCategories.find((c) => c.name.toLowerCase().includes("groceries"))
      confidence = 0.95
    } else if (searchText.includes("netflix") || searchText.includes("spotify") || searchText.includes("cine")) {
      suggestedCategory = filteredCategories.find((c) => c.name.toLowerCase().includes("entertainment"))
      confidence = 0.90
    } else if (searchText.includes("salario") || searchText.includes("nomina") || searchText.includes("sueldo")) {
      suggestedCategory = filteredCategories.find((c) => c.name.toLowerCase().includes("salary"))
      confidence = 0.98
    } else {
      // Default to "Other" category
      suggestedCategory = filteredCategories.find((c) => c.name.toLowerCase().includes("other"))
      confidence = 0.45
    }

    if (suggestedCategory) {
      setCategoryId(suggestedCategory.id)
      setAiConfidence(confidence)
      toast.success(`Categoria sugerida: ${suggestedCategory.name_es} (${Math.round(confidence * 100)}% confianza)`)
    } else {
      toast.info("No se pudo determinar una categoria automaticamente")
    }

    setIsCategorizing(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!amount || !accountId) {
      toast.error("Por favor completa los campos requeridos")
      return
    }

    setIsLoading(true)

    const transactionData = {
      user_id: userId,
      account_id: accountId,
      category_id: categoryId || null,
      amount: Number.parseFloat(amount),
      merchant_name: merchantName || null,
      description: description || null,
      transaction_date: format(transactionDate, "yyyy-MM-dd"),
      source: "manual" as const,
      ai_confidence: aiConfidence,
      needs_review: aiConfidence !== null && aiConfidence < 0.7,
      is_verified: aiConfidence === null || aiConfidence >= 0.7,
    }

    let error

    if (isEditing) {
      const result = await supabase
        .from("transactions")
        .update(transactionData)
        .eq("id", transaction.id)
      error = result.error
    } else {
      const result = await supabase.from("transactions").insert(transactionData)
      error = result.error
    }

    if (error) {
      toast.error(isEditing ? "Error al actualizar la transaccion" : "Error al crear la transaccion")
      console.error(error)
    } else {
      toast.success(isEditing ? "Transaccion actualizada" : "Transaccion creada")
      router.push("/dashboard/transactions")
      router.refresh()
    }

    setIsLoading(false)
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardContent className="pt-6 space-y-6">
          {/* Transaction Type Toggle */}
          <div className="space-y-2">
            <Label>Tipo de transaccion</Label>
            <Tabs
              value={transactionType}
              onValueChange={(v) => {
                setTransactionType(v as "expense" | "income")
                setCategoryId("") // Reset category when type changes
              }}
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="expense" className="data-[state=active]:bg-red-100 data-[state=active]:text-red-700">
                  Gasto
                </TabsTrigger>
                <TabsTrigger value="income" className="data-[state=active]:bg-green-100 data-[state=active]:text-green-700">
                  Ingreso
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <Label htmlFor="amount">Monto *</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                $
              </span>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pl-8"
                required
              />
            </div>
          </div>

          {/* Merchant Name */}
          <div className="space-y-2">
            <Label htmlFor="merchant">Comercio</Label>
            <Input
              id="merchant"
              placeholder="Ej: Walmart, Uber, Starbucks"
              value={merchantName}
              onChange={(e) => setMerchantName(e.target.value)}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Descripcion</Label>
            <Textarea
              id="description"
              placeholder="Detalles adicionales..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          {/* Category with AI suggestion */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="category">Categoria</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleAICategorize}
                disabled={isCategorizing}
              >
                {isCategorizing ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 size-4" />
                )}
                Sugerir con IA
              </Button>
            </div>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona una categoria" />
              </SelectTrigger>
              <SelectContent>
                {filteredCategories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className="size-3 rounded-full"
                        style={{ backgroundColor: category.color || "#94a3b8" }}
                      />
                      {category.name_es}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {aiConfidence !== null && (
              <p className="text-xs text-muted-foreground">
                Confianza de IA: {Math.round(aiConfidence * 100)}%
                {aiConfidence < 0.7 && " (requiere revision)"}
              </p>
            )}
          </div>

          {/* Account */}
          <div className="space-y-2">
            <Label htmlFor="account">Cuenta *</Label>
            <Select value={accountId} onValueChange={setAccountId} required>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona una cuenta" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {accounts.length === 0 && (
              <p className="text-sm text-amber-600">
                No tienes cuentas. Crea una cuenta primero.
              </p>
            )}
          </div>

          {/* Date */}
          <div className="space-y-2">
            <Label>Fecha</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal bg-transparent">
                  <CalendarIcon className="mr-2 size-4" />
                  {format(transactionDate, "PPP", { locale: es })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={transactionDate}
                  onSelect={(date) => date && setTransactionDate(date)}
                  locale={es}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Actions */}
          <div className="flex gap-4 pt-4">
            <Button
              type="button"
              variant="outline"
              className="flex-1 bg-transparent"
              onClick={() => router.back()}
            >
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={isLoading || accounts.length === 0}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  {isEditing ? "Guardando..." : "Creando..."}
                </>
              ) : (
                isEditing ? "Guardar cambios" : "Crear transaccion"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  )
}
