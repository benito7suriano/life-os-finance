import { ArrowRight, MessageSquare, Sparkles, BarChart3 } from "lucide-react"
import { Button } from "@/components/ui/button"

interface HeroSectionProps {
  dict: {
    landing: {
      hero: {
        title: string
        subtitle: string
        cta: string
        ctaSecondary: string
      }
    }
  }
}

export function HeroSection({ dict }: HeroSectionProps) {
  return (
    <section className="relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0f4c81]/5 via-transparent to-transparent" />

      {/* Decorative wave pattern */}
      <div className="absolute inset-0 opacity-[0.03]">
        <svg className="w-full h-full" viewBox="0 0 1440 800" preserveAspectRatio="xMidYMid slice">
          <path
            fill="currentColor"
            className="text-[#0f4c81]"
            d="M0,320L48,298.7C96,277,192,235,288,224C384,213,480,235,576,266.7C672,299,768,341,864,341.3C960,341,1056,299,1152,277.3C1248,256,1344,256,1392,256L1440,256L1440,800L1392,800C1344,800,1248,800,1152,800C1056,800,960,800,864,800C768,800,672,800,576,800C480,800,384,800,288,800C192,800,96,800,48,800L0,800Z"
          />
        </svg>
      </div>

      <div className="container relative mx-auto px-4 py-24 md:py-32 lg:py-40">
        <div className="mx-auto max-w-3xl text-center">
          {/* Badge */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#14b8a6]/30 bg-[#14b8a6]/10 px-4 py-1.5 text-sm text-[#14b8a6]">
            <Sparkles className="h-4 w-4" />
            <span>Impulsado por Inteligencia Artificial</span>
          </div>

          {/* Headline */}
          <h1 className="mb-6 text-4xl font-bold tracking-tight text-foreground md:text-5xl lg:text-6xl text-balance">
            {dict.landing.hero.title}
          </h1>

          {/* Subheadline */}
          <p className="mb-8 text-lg text-muted-foreground md:text-xl text-pretty max-w-2xl mx-auto">
            {dict.landing.hero.subtitle}
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" asChild className="w-full sm:w-auto bg-[#0f4c81] hover:bg-[#0f4c81]/90 text-white px-8">
              <a href="#waitlist">
                {dict.landing.hero.cta}
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </Button>
            <Button size="lg" variant="outline" asChild className="w-full sm:w-auto bg-transparent">
              <a href="#features">{dict.landing.hero.ctaSecondary}</a>
            </Button>
          </div>

          {/* Feature Pills */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
            <div className="flex items-center gap-2 rounded-full bg-muted px-4 py-2 text-sm text-muted-foreground">
              <MessageSquare className="h-4 w-4 text-[#25D366]" />
              <span>WhatsApp</span>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-muted px-4 py-2 text-sm text-muted-foreground">
              <Sparkles className="h-4 w-4 text-[#f97316]" />
              <span>IA Automática</span>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-muted px-4 py-2 text-sm text-muted-foreground">
              <BarChart3 className="h-4 w-4 text-[#14b8a6]" />
              <span>Análisis</span>
            </div>
          </div>
        </div>

        {/* Hero Image/Mockup */}
        <div className="mt-16 mx-auto max-w-4xl">
          <div className="relative rounded-xl border bg-card shadow-2xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent z-10" />
            <div className="aspect-[16/9] bg-gradient-to-br from-[#0f4c81]/10 via-background to-[#14b8a6]/10 p-8">
              {/* Dashboard Preview Mockup */}
              <div className="h-full rounded-lg border bg-background/50 backdrop-blur p-4 flex flex-col gap-4">
                {/* Header bar */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-[#0f4c81]" />
                    <div className="h-2 w-24 rounded bg-muted" />
                  </div>
                  <div className="flex gap-2">
                    <div className="h-6 w-16 rounded bg-muted" />
                    <div className="h-6 w-6 rounded bg-[#14b8a6]/20" />
                  </div>
                </div>

                {/* Content grid */}
                <div className="flex-1 grid grid-cols-3 gap-4">
                  {/* Balance card */}
                  <div className="col-span-2 rounded-lg border bg-card p-4">
                    <div className="h-2 w-20 rounded bg-muted mb-2" />
                    <div className="h-6 w-32 rounded bg-[#0f4c81]/20 mb-4" />
                    <div className="h-24 rounded bg-gradient-to-r from-[#14b8a6]/20 to-[#0f4c81]/20" />
                  </div>

                  {/* Side cards */}
                  <div className="flex flex-col gap-4">
                    <div className="flex-1 rounded-lg border bg-card p-3">
                      <div className="h-2 w-12 rounded bg-muted mb-2" />
                      <div className="h-4 w-16 rounded bg-[#22c55e]/20" />
                    </div>
                    <div className="flex-1 rounded-lg border bg-card p-3">
                      <div className="h-2 w-12 rounded bg-muted mb-2" />
                      <div className="h-4 w-16 rounded bg-[#f97316]/20" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
