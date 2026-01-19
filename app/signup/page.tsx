import { SignupForm } from "@/components/auth/signup-form"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Waves } from "lucide-react"

export const metadata = {
  title: "Registrarse | Ledger",
  description: "Crea tu cuenta de Ledger",
}

export default async function SignupPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    redirect("/dashboard")
  }

  return (
    <div className="min-h-screen flex">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#0f4c81] p-12 flex-col justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
            <Waves className="w-6 h-6 text-white" />
          </div>
          <span className="text-2xl font-bold text-white">Ledger</span>
        </Link>

        <div className="space-y-6">
          <h1 className="text-4xl font-bold text-white leading-tight">Comienza tu viaje hacia el control financiero</h1>
          <p className="text-lg text-white/80">
            Únete a miles de salvadoreños que están tomando el control de sus finanzas con IA.
          </p>

          <div className="space-y-4 pt-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                <span className="text-white text-sm">1</span>
              </div>
              <span className="text-white/90">Crea tu cuenta gratis</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                <span className="text-white text-sm">2</span>
              </div>
              <span className="text-white/90">Conecta tus fuentes de datos</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                <span className="text-white text-sm">3</span>
              </div>
              <span className="text-white/90">Recibe insights personalizados</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 text-white/60 text-sm">
          <span>Sin tarjeta de crédito</span>
          <span className="w-1 h-1 rounded-full bg-white/40" />
          <span>Gratis para empezar</span>
        </div>
      </div>

      {/* Right side - Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile logo */}
          <div className="lg:hidden flex justify-center">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-lg bg-[#0f4c81] flex items-center justify-center">
                <Waves className="w-6 h-6 text-white" />
              </div>
              <span className="text-2xl font-bold text-[#0f4c81]">Ledger</span>
            </Link>
          </div>

          <div className="text-center lg:text-left">
            <h2 className="text-2xl font-bold text-slate-900">Crear Cuenta</h2>
            <p className="mt-2 text-slate-600">Regístrate para comenzar a rastrear tus finanzas.</p>
          </div>

          <SignupForm />

          <p className="text-center text-sm text-slate-600">
            ¿Ya tienes cuenta?{" "}
            <Link href="/login" className="font-medium text-[#0f4c81] hover:text-[#0f4c81]/80">
              Inicia sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
