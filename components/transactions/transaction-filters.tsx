"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
import { Search, X, CalendarIcon, Filter } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import type { Category, Account } from "@/lib/database.types"

interface TransactionFiltersProps {
  categories: Category[]
  accounts: Account[]
  currentFilters: {
    search: string
    categoryId: string
    accountId: string
    source: string
    needsReview: boolean
    startDate: string
    endDate: string
  }
}

export function TransactionFilters({
  categories,
  accounts,
  currentFilters,
}: TransactionFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [search, setSearch] = useState(currentFilters.search)

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      if (search !== currentFilters.search) {
        updateFilter("search", search)
      }
    }, 300)

    return () => clearTimeout(delayDebounce)
  }, [search])

  const updateFilter = (key: string, value: string | boolean) => {
    const params = new URLSearchParams(searchParams.toString())

    if (value === "" || value === false) {
      params.delete(key)
    } else {
      params.set(key, String(value))
    }

    // Reset to page 1 when filters change
    params.delete("page")

    router.push(`/dashboard/transactions?${params.toString()}`)
  }

  const clearAllFilters = () => {
    router.push("/dashboard/transactions")
    setSearch("")
  }

  const activeFiltersCount = [
    currentFilters.categoryId,
    currentFilters.accountId,
    currentFilters.source,
    currentFilters.needsReview,
    currentFilters.startDate,
    currentFilters.endDate,
  ].filter(Boolean).length

  const sourceLabels: Record<string, string> = {
    manual: "Manual",
    whatsapp: "WhatsApp",
    email: "Email",
    dtes: "DTE",
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por descripcion o comercio..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Select
            value={currentFilters.categoryId || "all"}
            onValueChange={(v) => updateFilter("category", v === "all" ? "" : v)}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las categorias</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name_es}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={currentFilters.accountId || "all"}
            onValueChange={(v) => updateFilter("account", v === "all" ? "" : v)}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Cuenta" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las cuentas</SelectItem>
              {accounts.map((acc) => (
                <SelectItem key={acc.id} value={acc.id}>
                  {acc.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={currentFilters.source || "all"}
            onValueChange={(v) => updateFilter("source", v === "all" ? "" : v)}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Fuente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las fuentes</SelectItem>
              <SelectItem value="manual">Manual</SelectItem>
              <SelectItem value="whatsapp">WhatsApp</SelectItem>
              <SelectItem value="email">Email</SelectItem>
              <SelectItem value="dtes">DTE</SelectItem>
            </SelectContent>
          </Select>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[140px] bg-transparent">
                <CalendarIcon className="mr-2 size-4" />
                {currentFilters.startDate ? "Fechas" : "Fecha"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                locale={es}
                selected={{
                  from: currentFilters.startDate ? new Date(currentFilters.startDate) : undefined,
                  to: currentFilters.endDate ? new Date(currentFilters.endDate) : undefined,
                }}
                onSelect={(range) => {
                  if (range?.from) {
                    updateFilter("startDate", format(range.from, "yyyy-MM-dd"))
                  } else {
                    updateFilter("startDate", "")
                  }
                  if (range?.to) {
                    updateFilter("endDate", format(range.to, "yyyy-MM-dd"))
                  } else {
                    updateFilter("endDate", "")
                  }
                }}
              />
            </PopoverContent>
          </Popover>

          <Button
            variant={currentFilters.needsReview ? "default" : "outline"}
            onClick={() => updateFilter("needsReview", !currentFilters.needsReview)}
          >
            <Filter className="mr-2 size-4" />
            Por revisar
          </Button>
        </div>
      </div>

      {/* Active Filters */}
      {activeFiltersCount > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Filtros activos:</span>

          {currentFilters.categoryId && (
            <Badge variant="secondary" className="gap-1">
              {categories.find((c) => c.id === currentFilters.categoryId)?.name_es}
              <button onClick={() => updateFilter("category", "")}>
                <X className="size-3" />
              </button>
            </Badge>
          )}

          {currentFilters.accountId && (
            <Badge variant="secondary" className="gap-1">
              {accounts.find((a) => a.id === currentFilters.accountId)?.name}
              <button onClick={() => updateFilter("account", "")}>
                <X className="size-3" />
              </button>
            </Badge>
          )}

          {currentFilters.source && (
            <Badge variant="secondary" className="gap-1">
              {sourceLabels[currentFilters.source]}
              <button onClick={() => updateFilter("source", "")}>
                <X className="size-3" />
              </button>
            </Badge>
          )}

          {currentFilters.needsReview && (
            <Badge variant="secondary" className="gap-1">
              Por revisar
              <button onClick={() => updateFilter("needsReview", false)}>
                <X className="size-3" />
              </button>
            </Badge>
          )}

          {currentFilters.startDate && (
            <Badge variant="secondary" className="gap-1">
              Desde: {format(new Date(currentFilters.startDate), "dd/MM/yyyy")}
              <button onClick={() => updateFilter("startDate", "")}>
                <X className="size-3" />
              </button>
            </Badge>
          )}

          {currentFilters.endDate && (
            <Badge variant="secondary" className="gap-1">
              Hasta: {format(new Date(currentFilters.endDate), "dd/MM/yyyy")}
              <button onClick={() => updateFilter("endDate", "")}>
                <X className="size-3" />
              </button>
            </Badge>
          )}

          <Button variant="ghost" size="sm" onClick={clearAllFilters}>
            Limpiar todo
          </Button>
        </div>
      )}
    </div>
  )
}
