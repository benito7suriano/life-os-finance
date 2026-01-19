"use client"

import React from "react"

import { useState } from "react"
import { Loader2 } from "lucide-react"
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
import { createClient } from "@/lib/supabase/client"
import { ACCOUNT_COLORS } from "@/lib/constants"
import type { Account } from "@/lib/database.types"

const accountTypes = [
  { value: "checking", label: "Cuenta Corriente" },
  { value: "savings", label: "Ahorros" },
  { value: "credit", label: "Tarjeta de Crédito" },
  { value: "cash", label: "Efectivo" },
  { value: "investment", label: "Inversión" },
]

const colorOptions = [
  { value: "#3b82f6", label: "Azul" },
  { value: "#22c55e", label: "Verde" },
  { value: "#f97316", label: "Naranja" },
  { value: "#8b5cf6", label: "Morado" },
  { value: "#0f4c81", label: "Azul Océano" },
  { value: "#14b8a6", label: "Teal" },
  { value: "#ef4444", label: "Rojo" },
  { value: "#ec4899", label: "Rosa" },
]

interface AccountFormProps {
  account?: Account
  onSuccess: () => void
  onCancel: () => void
}

export function AccountForm({ account, onSuccess, onCancel }: AccountFormProps) {
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState(account?.name || "")
  const [type, setType] = useState(account?.type || "checking")
  const [balance, setBalance] = useState(account?.balance?.toString() || "0")
  const [color, setColor] = useState(
    account?.color || ACCOUNT_COLORS[type as keyof typeof ACCOUNT_COLORS] || "#0f4c81"
  )
  const supabase = createClient()

  const handleTypeChange = (newType: string) => {
    setType(newType)
    // Auto-set color based on type if not editing
    if (!account) {
      setColor(ACCOUNT_COLORS[newType as keyof typeof ACCOUNT_COLORS] || "#0f4c81")
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }

    const accountData = {
      name,
      type,
      balance: parseFloat(balance) || 0,
      color,
      currency: "USD",
      user_id: user.id,
    }

    let error

    if (account) {
      // Update existing account
      const result = await supabase
        .from("accounts")
        .update(accountData)
        .eq("id", account.id)
      error = result.error
    } else {
      // Create new account
      const result = await supabase
        .from("accounts")
        .insert(accountData)
      error = result.error
    }

    setLoading(false)

    if (error) {
      console.error(error)
    } else {
      onSuccess()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Nombre de la cuenta</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej: Banco Agricola, Efectivo"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="type">Tipo de cuenta</Label>
        <Select value={type} onValueChange={handleTypeChange}>
          <SelectTrigger id="type">
            <SelectValue placeholder="Selecciona un tipo" />
          </SelectTrigger>
          <SelectContent>
            {accountTypes.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="balance">
          {type === "credit" ? "Saldo por pagar" : "Balance inicial"}
        </Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            $
          </span>
          <Input
            id="balance"
            type="number"
            step="0.01"
            min="0"
            value={balance}
            onChange={(e) => setBalance(e.target.value)}
            className="pl-7"
            placeholder="0.00"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Color</Label>
        <div className="flex flex-wrap gap-2">
          {colorOptions.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setColor(c.value)}
              className={`size-8 rounded-full transition-transform hover:scale-110 ${
                color === c.value ? "ring-2 ring-offset-2 ring-[#0f4c81]" : ""
              }`}
              style={{ backgroundColor: c.value }}
              title={c.label}
            />
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={loading || !name}
          className="bg-[#0f4c81] hover:bg-[#0f4c81]/90"
        >
          {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
          {account ? "Guardar Cambios" : "Crear Cuenta"}
        </Button>
      </div>
    </form>
  )
}
