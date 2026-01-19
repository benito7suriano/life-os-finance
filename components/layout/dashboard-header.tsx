"use client"

import type { User } from "@supabase/supabase-js"
import type { Database } from "@/lib/database.types"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage } from "@/components/ui/breadcrumb"
import { usePathname } from "next/navigation"
import { Bell, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { LanguageSwitcher } from "@/components/shared/language-switcher"
import { useI18n } from "@/lib/i18n/context"

type Profile = Database["public"]["Tables"]["profiles"]["Row"]

interface DashboardHeaderProps {
  user: User
  profile: Profile | null
}

const pathTitles: Record<string, { es: string; en: string }> = {
  "/dashboard": { es: "Panel", en: "Dashboard" },
  "/dashboard/transactions": { es: "Transacciones", en: "Transactions" },
  "/dashboard/transactions/new": { es: "Nueva Transacción", en: "New Transaction" },
  "/dashboard/accounts": { es: "Cuentas", en: "Accounts" },
  "/dashboard/whatsapp": { es: "WhatsApp", en: "WhatsApp" },
  "/dashboard/categories": { es: "Categorías", en: "Categories" },
  "/dashboard/settings": { es: "Configuración", en: "Settings" },
}

export function DashboardHeader({ user, profile }: DashboardHeaderProps) {
  const pathname = usePathname()
  const { locale, t } = useI18n()
  const pageTitle = pathTitles[pathname]?.[locale] || pathTitles[pathname]?.es || "Panel"

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage className="font-medium">{pageTitle}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="ml-auto flex items-center gap-2">
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
    </header>
  )
}
