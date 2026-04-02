import type { Metadata } from "next";
import { Navbar } from "@/components/landing/navbar";
import { Footer } from "@/components/landing/footer";
import { JsonLd } from "@/components/landing/json-ld";
import { HeroSection } from "@/components/landing/hero-section";
import { TrustBar } from "@/components/landing/trust-bar";
import { FeaturesSection } from "@/components/landing/features-section";
import { IndustryShowcase } from "@/components/landing/industry-showcase";
import { HowItWorksSection } from "@/components/landing/how-it-works-section";
import { PricingSection } from "@/components/landing/pricing-section";
import { TestimonialsSection } from "@/components/landing/testimonials-section";
import { FaqSection } from "@/components/landing/faq-section";
import { BlogPreviewSection } from "@/components/landing/blog-preview-section";
import { FinalCtaSection } from "@/components/landing/final-cta-section";

export const metadata: Metadata = {
  title: "Zaxvio — Service Management Software for Field Service Businesses",
  description:
    "Scheduling, invoicing, and customer management for HVAC, plumbing, electrical, cleaning, and landscaping businesses. One plan, $49/mo.",
  openGraph: {
    title: "Zaxvio — Run Your Service Business from Your Phone",
    description:
      "Digital scheduling, invoicing, and customer management for any service business. $49/mo, no contracts.",
    type: "website",
  },
};

export default function LandingPage() {
  return (
    <>
      <JsonLd />
      <Navbar />
      <main>
        <HeroSection />
        <TrustBar />
        <FeaturesSection />
        <IndustryShowcase />
        <HowItWorksSection />
        <PricingSection />
        <TestimonialsSection />
        <FaqSection />
        <BlogPreviewSection />
        <FinalCtaSection />
      </main>
      <Footer />
    </>
  );
}
