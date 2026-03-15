import type { Metadata } from "next";
import { Navbar } from "@/components/landing/navbar";
import { Footer } from "@/components/landing/footer";
import { HeroSection } from "@/components/landing/hero-section";
import { FeaturesSection } from "@/components/landing/features-section";
import { HowItWorksSection } from "@/components/landing/how-it-works-section";
import { PricingSection } from "@/components/landing/pricing-section";
import { TestimonialsSection } from "@/components/landing/testimonials-section";
import { FaqSection } from "@/components/landing/faq-section";
import { FinalCtaSection } from "@/components/landing/final-cta-section";

export const metadata: Metadata = {
  title: "Zaxvio — HVAC Field Service Management for Solo Contractors",
  description:
    "Scheduling, invoicing, and customer management built for solo HVAC contractors in Texas & Florida. Replace phone & paper workflows for $49/mo.",
  openGraph: {
    title: "Zaxvio — Ditch the Clipboard. Run Your HVAC Business from Your Phone.",
    description:
      "Digital scheduling, invoicing, and customer management for solo HVAC contractors. $49/mo, no contracts.",
    type: "website",
  },
};

export default function LandingPage() {
  return (
    <>
      <Navbar />
      <main>
        <HeroSection />
        <FeaturesSection />
        <HowItWorksSection />
        <PricingSection />
        <TestimonialsSection />
        <FaqSection />
        <FinalCtaSection />
      </main>
      <Footer />
    </>
  );
}
