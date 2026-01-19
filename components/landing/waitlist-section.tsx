"use client"

import type React from "react"

import { useState } from "react"
import { Loader2, CheckCircle2, Waves } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"

interface WaitlistSectionProps {
  dict: {
    landing: {
      waitlist: {
        title: string
        subtitle: string
        namePlaceholder: string
        emailPlaceholder: string
        referralPlaceholder: string
        success: string
        error: string
      }
      hero: {
        cta: string
      }
    }
    common: {
      submit: string
    }
  }
}

const referralSources = [
  { value: "social_media", labelEs: "Redes Sociales" },
  { value: "friend", labelEs: "Recomendación de un amigo" },
  { value: "search", labelEs: "Búsqueda en Google" },
  { value: "advertisement", labelEs: "Anuncio" },
  { value: "other", labelEs: "Otro" },
]

export function WaitlistSection({ dict }: WaitlistSectionProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    referral_source: "",
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const supabase = createClient()
      const { error } = await supabase.from("waitlist").insert([
        {
          name: formData.name,
          email: formData.email,
          referral_source: formData.referral_source || null,
        },
      ])

      if (error) {
        if (error.code === "23505") {
          // Unique constraint violation - email already exists
          toast.error("Este correo ya está registrado en la lista de espera.")
        } else {
          throw error
        }
      } else {
        setIsSuccess(true)
        toast.success(dict.landing.waitlist.success)
        setFormData({ name: "", email: "", referral_source: "" })
      }
    } catch (error) {
      console.error("Waitlist error:", error)
      toast.error(dict.landing.waitlist.error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <section id="waitlist" className="py-24 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0f4c81]/5 to-[#14b8a6]/5" />

      <div className="container relative mx-auto px-4">
        <div className="mx-auto max-w-xl">
          {/* Section Header */}
          <div className="text-center mb-8">
            <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#0f4c81]/10">
              <Waves className="h-7 w-7 text-[#0f4c81]" />
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl mb-3">
              {dict.landing.waitlist.title}
            </h2>
            <p className="text-muted-foreground text-lg">{dict.landing.waitlist.subtitle}</p>
          </div>

          {/* Waitlist Form */}
          <Card className="border-none shadow-xl">
            <CardContent className="p-6 md:p-8">
              {isSuccess ? (
                <div className="text-center py-8">
                  <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-[#22c55e]/10">
                    <CheckCircle2 className="h-8 w-8 text-[#22c55e]" />
                  </div>
                  <h3 className="text-xl font-semibold text-foreground mb-2">¡Estás en la lista!</h3>
                  <p className="text-muted-foreground">Te contactaremos pronto con acceso anticipado.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Input
                      type="text"
                      placeholder={dict.landing.waitlist.namePlaceholder}
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      className="h-11"
                    />
                  </div>
                  <div>
                    <Input
                      type="email"
                      placeholder={dict.landing.waitlist.emailPlaceholder}
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                      className="h-11"
                    />
                  </div>
                  <div>
                    <Select
                      value={formData.referral_source}
                      onValueChange={(value) => setFormData({ ...formData, referral_source: value })}
                    >
                      <SelectTrigger className="h-11 w-full">
                        <SelectValue placeholder={dict.landing.waitlist.referralPlaceholder} />
                      </SelectTrigger>
                      <SelectContent>
                        {referralSources.map((source) => (
                          <SelectItem key={source.value} value={source.value}>
                            {source.labelEs}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="w-full h-11 bg-[#0f4c81] hover:bg-[#0f4c81]/90 text-white"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Registrando...
                      </>
                    ) : (
                      dict.landing.hero.cta
                    )}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>

          {/* Trust indicators */}
          <div className="mt-6 flex items-center justify-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-[#22c55e]" />
              <span>Sin spam</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-[#22c55e]" />
              <span>Datos seguros</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-[#22c55e]" />
              <span>Gratis</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
