"use client"

import type React from "react"
import type { User } from "@supabase/supabase-js"
import type { Database } from "@/lib/database.types"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { I18nProvider } from "@/lib/i18n/context"
import type { Locale } from "@/lib/i18n/dictionaries"

type Profile = Database["public"]["Tables"]["profiles"]["Row"]

interface DashboardShellProps {
  user: User
  profile: Profile | null
  locale: Locale
  dictionary: Record<string, unknown>
  children: React.ReactNode
}

export function DashboardShell({ user, profile, locale, dictionary, children }: DashboardShellProps) {
  return (
    <I18nProvider initialLocale={locale} initialDictionary={dictionary}>
      <SidebarProvider>
        <AppSidebar user={user} profile={profile} />
        <SidebarInset>
          <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </I18nProvider>
  )
}
