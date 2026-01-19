import Link from "next/link"
import { Waves } from "lucide-react"

interface FooterProps {
  dict: {
    common: { appName: string }
  }
}

export function Footer({ dict }: FooterProps) {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="border-t bg-muted/30 py-12">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0f4c81] text-white">
              <Waves className="h-4 w-4" />
            </div>
            <span className="text-lg font-semibold text-foreground">{dict.common.appName}</span>
          </div>

          {/* Links */}
          <nav className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link href="#features" className="hover:text-foreground transition-colors">
              Funciones
            </Link>
            <Link href="#waitlist" className="hover:text-foreground transition-colors">
              Lista de Espera
            </Link>
            <Link href="/login" className="hover:text-foreground transition-colors">
              Iniciar Sesión
            </Link>
          </nav>

          {/* Copyright */}
          <p className="text-sm text-muted-foreground">© {currentYear} Ledger. Hecho en El Salvador.</p>
        </div>
      </div>
    </footer>
  )
}
