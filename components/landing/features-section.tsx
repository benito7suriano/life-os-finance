import { MessageSquare, Sparkles, BarChart3, Shield, Zap, Globe } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

interface FeaturesSectionProps {
  dict: {
    landing: {
      features: {
        title: string
        whatsapp: { title: string; description: string }
        ai: { title: string; description: string }
        insights: { title: string; description: string }
      }
    }
  }
}

const additionalFeatures = [
  {
    icon: Shield,
    titleEs: "Seguro y Privado",
    descEs: "Tus datos están encriptados y nunca compartidos con terceros.",
    color: "#0f4c81",
  },
  {
    icon: Zap,
    titleEs: "Rápido y Fácil",
    descEs: "Configura tu cuenta en minutos y empieza a rastrear hoy.",
    color: "#f97316",
  },
  {
    icon: Globe,
    titleEs: "Hecho para El Salvador",
    descEs: "Diseñado específicamente para el contexto financiero local.",
    color: "#14b8a6",
  },
]

export function FeaturesSection({ dict }: FeaturesSectionProps) {
  const mainFeatures = [
    {
      icon: MessageSquare,
      title: dict.landing.features.whatsapp.title,
      description: dict.landing.features.whatsapp.description,
      color: "#25D366",
    },
    {
      icon: Sparkles,
      title: dict.landing.features.ai.title,
      description: dict.landing.features.ai.description,
      color: "#f97316",
    },
    {
      icon: BarChart3,
      title: dict.landing.features.insights.title,
      description: dict.landing.features.insights.description,
      color: "#14b8a6",
    },
  ]

  return (
    <section id="features" className="py-24 bg-muted/30">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="mx-auto max-w-2xl text-center mb-16">
          <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl mb-4">
            {dict.landing.features.title}
          </h2>
          <p className="text-muted-foreground text-lg">Herramientas poderosas para simplificar tu vida financiera</p>
        </div>

        {/* Main Features */}
        <div className="grid gap-8 md:grid-cols-3 mb-16">
          {mainFeatures.map((feature, index) => (
            <Card
              key={index}
              className="relative overflow-hidden border-none bg-card shadow-lg hover:shadow-xl transition-shadow"
            >
              <CardContent className="p-6">
                <div
                  className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `${feature.color}15` }}
                >
                  <feature.icon className="h-6 w-6" style={{ color: feature.color }} />
                </div>
                <h3 className="mb-2 text-xl font-semibold text-foreground">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </CardContent>
              {/* Decorative corner */}
              <div
                className="absolute -bottom-8 -right-8 h-24 w-24 rounded-full opacity-10"
                style={{ backgroundColor: feature.color }}
              />
            </Card>
          ))}
        </div>

        {/* Additional Features Grid */}
        <div className="grid gap-6 md:grid-cols-3">
          {additionalFeatures.map((feature, index) => (
            <div key={index} className="flex items-start gap-4 rounded-lg border bg-card p-4">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                style={{ backgroundColor: `${feature.color}15` }}
              >
                <feature.icon className="h-5 w-5" style={{ color: feature.color }} />
              </div>
              <div>
                <h4 className="font-medium text-foreground">{feature.titleEs}</h4>
                <p className="text-sm text-muted-foreground">{feature.descEs}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
