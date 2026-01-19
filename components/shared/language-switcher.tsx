"use client"

import { Globe } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useI18n } from "@/lib/i18n/context"
import type { Locale } from "@/lib/i18n/dictionaries"
import { createClient } from "@/lib/supabase/client"

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n()
  const supabase = createClient()

  const handleLanguageChange = async (newLocale: Locale) => {
    setLocale(newLocale)
    
    // Update in database if user is logged in
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase
        .from("profiles")
        .update({ preferred_language: newLocale })
        .eq("id", user.id)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9">
          <Globe className="size-4" />
          <span className="sr-only">{t("settings.language")}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem 
          onClick={() => handleLanguageChange("es")}
          className={locale === "es" ? "bg-accent" : ""}
        >
          <span className="mr-2">🇪🇸</span>
          {t("settings.languages.es")}
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => handleLanguageChange("en")}
          className={locale === "en" ? "bg-accent" : ""}
        >
          <span className="mr-2">🇺🇸</span>
          {t("settings.languages.en")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
