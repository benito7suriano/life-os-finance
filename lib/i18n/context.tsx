"use client"

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react"
import type { Locale } from "./dictionaries"

type Dictionary = Record<string, unknown>

interface I18nContextType {
  locale: Locale
  setLocale: (locale: Locale) => void
  dictionary: Dictionary
  t: (key: string) => string
}

const I18nContext = createContext<I18nContextType | null>(null)

interface I18nProviderProps {
  children: ReactNode
  initialLocale: Locale
  initialDictionary: Dictionary
}

export function I18nProvider({ children, initialLocale, initialDictionary }: I18nProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale)
  const [dictionary, setDictionary] = useState<Dictionary>(initialDictionary)

  const setLocale = useCallback(async (newLocale: Locale) => {
    const newDict = await import(`./locales/${newLocale}.json`).then((m) => m.default)
    setDictionary(newDict)
    setLocaleState(newLocale)
    // Store preference
    if (typeof window !== "undefined") {
      localStorage.setItem("ledger-locale", newLocale)
    }
  }, [])

  // Load saved locale preference
  useEffect(() => {
    const savedLocale = localStorage.getItem("ledger-locale") as Locale | null
    if (savedLocale && savedLocale !== locale) {
      setLocale(savedLocale)
    }
  }, [locale, setLocale])

  const t = useCallback(
    (key: string): string => {
      const keys = key.split(".")
      let value: unknown = dictionary

      for (const k of keys) {
        if (value && typeof value === "object" && k in value) {
          value = (value as Record<string, unknown>)[k]
        } else {
          return key // Return key if not found
        }
      }

      return typeof value === "string" ? value : key
    },
    [dictionary],
  )

  return <I18nContext.Provider value={{ locale, setLocale, dictionary, t }}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const context = useContext(I18nContext)
  if (!context) {
    throw new Error("useI18n must be used within an I18nProvider")
  }
  return context
}
