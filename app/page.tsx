import { getDictionary } from "@/lib/i18n/dictionaries"
import { HeroSection } from "@/components/landing/hero-section"
import { FeaturesSection } from "@/components/landing/features-section"
import { WaitlistSection } from "@/components/landing/waitlist-section"
import { Footer } from "@/components/landing/footer"
import { LandingHeader } from "@/components/landing/landing-header"

export default async function LandingPage() {
  const dict = await getDictionary("es")

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <LandingHeader dict={dict} />
      <main className="flex-1">
        <HeroSection dict={dict} />
        <FeaturesSection dict={dict} />
        <WaitlistSection dict={dict} />
      </main>
      <Footer dict={dict} />
    </div>
  )
}
