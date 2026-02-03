import { LoginForm } from "@/components/auth/login-form"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Waves } from "lucide-react"

export const metadata = {
  title: "Iniciar Sesión | Ledger",
  description: "Inicia sesión en tu cuenta de Ledger",
}

export default async function LoginPage() {
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
          <h1 className="text-4xl font-bold text-white leading-tight">Toma el control de tus finanzas personales</h1>
          <p className="text-lg text-white/80">
            Conecta WhatsApp, rastrea gastos automáticamente y obtén insights con IA.
          </p>
        </div>

        <div className="flex items-center gap-4 text-white/60 text-sm">
          <span>Seguro</span>
          <span className="w-1 h-1 rounded-full bg-white/40" />
          <span>Privado</span>
          <span className="w-1 h-1 rounded-full bg-white/40" />
          <span>Inteligente</span>
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
            <h2 className="text-2xl font-bold text-slate-900">Iniciar Sesión</h2>
            <p className="mt-2 text-slate-600">Bienvenido de nuevo. Ingresa tus credenciales.</p>
          </div>

          <LoginForm />

          <p className="text-center text-sm text-slate-600">
            ¿No tienes cuenta?{" "}
            <Link href="/signup" className="font-medium text-[#0f4c81] hover:text-[#0f4c81]/80">
              Regístrate
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
