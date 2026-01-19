"use client"

import { useState } from "react"
import Link from "next/link"
import { Menu, X, Waves } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface LandingHeaderProps {
  dict: {
    common: { appName: string }
    auth: { login: string; signup: string }
  }
}

export function LandingHeader({ dict }: LandingHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0f4c81] text-white">
            <Waves className="h-5 w-5" />
          </div>
          <span className="text-xl font-bold text-foreground">{dict.common.appName}</span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-4">
          <Button variant="ghost" asChild>
            <Link href="/login">{dict.auth.login}</Link>
          </Button>
          <Button asChild className="bg-[#0f4c81] hover:bg-[#0f4c81]/90">
            <Link href="/signup">{dict.auth.signup}</Link>
          </Button>
        </nav>

        {/* Mobile Menu Button */}
        <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {/* Mobile Menu */}
      <div
        className={cn(
          "md:hidden border-t bg-background overflow-hidden transition-all duration-300",
          mobileMenuOpen ? "max-h-40" : "max-h-0",
        )}
      >
        <nav className="container mx-auto flex flex-col gap-2 p-4">
          <Button variant="ghost" asChild className="justify-start">
            <Link href="/login">{dict.auth.login}</Link>
          </Button>
          <Button asChild className="bg-[#0f4c81] hover:bg-[#0f4c81]/90">
            <Link href="/signup">{dict.auth.signup}</Link>
          </Button>
        </nav>
      </div>
    </header>
  )
}
