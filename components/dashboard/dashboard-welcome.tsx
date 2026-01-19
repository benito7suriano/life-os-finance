"use client"

import { Bell, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { LanguageSwitcher } from "@/components/shared/language-switcher"
import { useI18n } from "@/lib/i18n/context"

interface DashboardWelcomeProps {
  firstName?: string | null
}

export function DashboardWelcome({ firstName }: DashboardWelcomeProps) {
  const { locale, t } = useI18n()
  
  const greeting = locale === "es" 
    ? `Bienvenido de nuevo${firstName ? `, ${firstName}` : ""}`
    : `Welcome back${firstName ? `, ${firstName}` : ""}`
  
  const subtitle = locale === "es" 
    ? "Aquí está el resumen de tus finanzas"
    : "Here's your financial summary"

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{greeting}</h1>
        <p className="text-muted-foreground">{subtitle}</p>
      </div>
      
      <div className="flex items-center gap-2">
        <LanguageSwitcher />
        
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="size-4" />
          <span className="sr-only">{locale === "es" ? "Notificaciones" : "Notifications"}</span>
        </Button>

        <Button asChild size="sm" className="bg-[#0f4c81] hover:bg-[#0f4c81]/90">
          <Link href="/dashboard/transactions/new">
            <Plus className="size-4 mr-1" />
            <span className="hidden sm:inline">{t("transactions.new")}</span>
            <span className="sm:hidden">{locale === "es" ? "Nuevo" : "New"}</span>
          </Link>
        </Button>
      </div>
    </div>
  )
}
