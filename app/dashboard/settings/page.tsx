"use client"

import { useState, useEffect } from "react"
import { User, Globe, Bell, Shield, Loader2, Check } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { useI18n } from "@/lib/i18n/context"
import type { Profile } from "@/lib/database.types"
import type { Locale } from "@/lib/i18n/dictionaries"

export default function SettingsPage() {
  const { locale, setLocale, t } = useI18n()
  const supabase = createClient()
  
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  // Form state
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [whatsappNumber, setWhatsappNumber] = useState("")
  
  // Notification preferences (stored in localStorage for now)
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [pushNotifications, setPushNotifications] = useState(false)
  const [weeklyReport, setWeeklyReport] = useState(true)

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single()
      
      if (data) {
        setProfile(data)
        setFirstName(data.first_name || "")
        setLastName(data.last_name || "")
        setWhatsappNumber(data.whatsapp_number || "")
      }
      setLoading(false)
    }
    
    loadProfile()
  }, [supabase])

  const handleSaveProfile = async () => {
    if (!profile) return
    
    setSaving(true)
    const { error } = await supabase
      .from("profiles")
      .update({
        first_name: firstName,
        last_name: lastName,
        whatsapp_number: whatsappNumber,
        preferred_language: locale,
      })
      .eq("id", profile.id)
    
    if (error) {
      toast.error(locale === "es" ? "Error al guardar" : "Error saving")
    } else {
      toast.success(locale === "es" ? "Perfil actualizado" : "Profile updated")
      setProfile({ ...profile, first_name: firstName, last_name: lastName, whatsapp_number: whatsappNumber })
    }
    setSaving(false)
  }

  const handleLanguageChange = async (newLocale: Locale) => {
    setLocale(newLocale)
    
    // Also update in database
    if (profile) {
      await supabase
        .from("profiles")
        .update({ preferred_language: newLocale })
        .eq("id", profile.id)
    }
    
    toast.success(newLocale === "es" ? "Idioma cambiado a Español" : "Language changed to English")
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("settings.title")}</h1>
        <p className="text-muted-foreground">
          {locale === "es" ? "Administra tu cuenta y preferencias" : "Manage your account and preferences"}
        </p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList>
          <TabsTrigger value="profile" className="gap-2">
            <User className="size-4" />
            {t("settings.profile")}
          </TabsTrigger>
          <TabsTrigger value="language" className="gap-2">
            <Globe className="size-4" />
            {t("settings.language")}
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="size-4" />
            {t("settings.notifications")}
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2">
            <Shield className="size-4" />
            {locale === "es" ? "Seguridad" : "Security"}
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>{t("settings.profile")}</CardTitle>
              <CardDescription>
                {locale === "es" 
                  ? "Actualiza tu información personal" 
                  : "Update your personal information"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="firstName">{t("auth.firstName")}</Label>
                  <Input
                    id="firstName"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder={locale === "es" ? "Tu nombre" : "Your first name"}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">{t("auth.lastName")}</Label>
                  <Input
                    id="lastName"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder={locale === "es" ? "Tu apellido" : "Your last name"}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">{t("auth.email")}</Label>
                <Input
                  id="email"
                  type="email"
                  value={profile?.id ? "" : ""}
                  disabled
                  className="bg-muted"
                  placeholder={locale === "es" ? "Correo no disponible" : "Email not available"}
                />
                <p className="text-xs text-muted-foreground">
                  {locale === "es" 
                    ? "El correo no se puede cambiar" 
                    : "Email cannot be changed"}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="whatsapp">{t("whatsapp.phoneNumber")}</Label>
                <Input
                  id="whatsapp"
                  value={whatsappNumber}
                  onChange={(e) => setWhatsappNumber(e.target.value)}
                  placeholder="+503 7123 4567"
                />
                <p className="text-xs text-muted-foreground">
                  {locale === "es" 
                    ? "Usado para la integración de WhatsApp" 
                    : "Used for WhatsApp integration"}
                </p>
              </div>

              <Separator />

              <div className="flex justify-end">
                <Button onClick={handleSaveProfile} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      {locale === "es" ? "Guardando..." : "Saving..."}
                    </>
                  ) : (
                    t("common.save")
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Language Tab */}
        <TabsContent value="language">
          <Card>
            <CardHeader>
              <CardTitle>{t("settings.language")}</CardTitle>
              <CardDescription>
                {locale === "es" 
                  ? "Selecciona tu idioma preferido" 
                  : "Select your preferred language"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => handleLanguageChange("es")}
                  className={`relative flex items-center gap-4 rounded-lg border-2 p-4 transition-colors hover:bg-accent ${
                    locale === "es" ? "border-primary bg-primary/5" : "border-border"
                  }`}
                >
                  <div className="flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-yellow-500 text-white text-lg font-bold">
                    ES
                  </div>
                  <div className="text-left">
                    <p className="font-medium">{t("settings.languages.es")}</p>
                    <p className="text-sm text-muted-foreground">Español</p>
                  </div>
                  {locale === "es" && (
                    <Check className="absolute right-4 size-5 text-primary" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => handleLanguageChange("en")}
                  className={`relative flex items-center gap-4 rounded-lg border-2 p-4 transition-colors hover:bg-accent ${
                    locale === "en" ? "border-primary bg-primary/5" : "border-border"
                  }`}
                >
                  <div className="flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-red-500 text-white text-lg font-bold">
                    EN
                  </div>
                  <div className="text-left">
                    <p className="font-medium">{t("settings.languages.en")}</p>
                    <p className="text-sm text-muted-foreground">English</p>
                  </div>
                  {locale === "en" && (
                    <Check className="absolute right-4 size-5 text-primary" />
                  )}
                </button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>{t("settings.notifications")}</CardTitle>
              <CardDescription>
                {locale === "es" 
                  ? "Configura cómo quieres recibir notificaciones" 
                  : "Configure how you want to receive notifications"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>{locale === "es" ? "Notificaciones por correo" : "Email notifications"}</Label>
                  <p className="text-sm text-muted-foreground">
                    {locale === "es" 
                      ? "Recibe alertas de transacciones por correo" 
                      : "Receive transaction alerts via email"}
                  </p>
                </div>
                <Switch
                  checked={emailNotifications}
                  onCheckedChange={setEmailNotifications}
                />
              </div>
              
              <Separator />
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>{locale === "es" ? "Notificaciones push" : "Push notifications"}</Label>
                  <p className="text-sm text-muted-foreground">
                    {locale === "es" 
                      ? "Notificaciones en tiempo real en tu navegador" 
                      : "Real-time notifications in your browser"}
                  </p>
                </div>
                <Switch
                  checked={pushNotifications}
                  onCheckedChange={setPushNotifications}
                />
              </div>
              
              <Separator />
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>{locale === "es" ? "Reporte semanal" : "Weekly report"}</Label>
                  <p className="text-sm text-muted-foreground">
                    {locale === "es" 
                      ? "Resumen semanal de tus finanzas" 
                      : "Weekly summary of your finances"}
                  </p>
                </div>
                <Switch
                  checked={weeklyReport}
                  onCheckedChange={setWeeklyReport}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>{locale === "es" ? "Seguridad" : "Security"}</CardTitle>
              <CardDescription>
                {locale === "es" 
                  ? "Administra la seguridad de tu cuenta" 
                  : "Manage your account security"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium">
                    {locale === "es" ? "Cambiar contraseña" : "Change password"}
                  </h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    {locale === "es" 
                      ? "Actualiza tu contraseña regularmente para mantener tu cuenta segura" 
                      : "Update your password regularly to keep your account secure"}
                  </p>
                  <Button variant="outline">
                    {locale === "es" ? "Cambiar contraseña" : "Change password"}
                  </Button>
                </div>
                
                <Separator />
                
                <div>
                  <h4 className="font-medium">
                    {locale === "es" ? "Sesiones activas" : "Active sessions"}
                  </h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    {locale === "es" 
                      ? "Administra los dispositivos donde has iniciado sesión" 
                      : "Manage devices where you're logged in"}
                  </p>
                  <Button variant="outline">
                    {locale === "es" ? "Ver sesiones" : "View sessions"}
                  </Button>
                </div>
                
                <Separator />
                
                <div>
                  <h4 className="font-medium text-destructive">
                    {locale === "es" ? "Zona de peligro" : "Danger zone"}
                  </h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    {locale === "es" 
                      ? "Eliminar permanentemente tu cuenta y todos tus datos" 
                      : "Permanently delete your account and all your data"}
                  </p>
                  <Button variant="destructive">
                    {locale === "es" ? "Eliminar cuenta" : "Delete account"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
