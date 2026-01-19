import type React from "react"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { DashboardShell } from "@/components/layout/dashboard-shell"
import { getDictionary, type Locale } from "@/lib/i18n/dictionaries"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    redirect("/login")
  }

  // Fetch user profile
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single()

  // Get user's preferred locale or default to Spanish
  const locale = (profile?.preferred_language as Locale) || "es"
  const dictionary = await getDictionary(locale)

  return (
    <DashboardShell user={user} profile={profile} locale={locale} dictionary={dictionary}>
      {children}
    </DashboardShell>
  )
}
