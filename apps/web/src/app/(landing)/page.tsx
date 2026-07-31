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
    "Scheduling, quotes, invoicing and customer history for HVAC, plumbing, electrical, cleaning and landscaping businesses. One plan, $49/mo.",
  openGraph: {
    title: "Zaxvio — Run the whole day from one screen",
    description:
      "Scheduling, quotes, invoicing and customer history in one app. $49/mo, no contracts.",
    type: "website",
  },
};

/**
 * Section surfaces alternate strictly: base → alt → base → alt, closing on the
 * dark slab that the footer continues. That ordering is set here and enforced
 * by the `surface` prop on `Section`; the previous page repeated the same
 * background across three adjacent pairs, so those sections ran together with
 * ~200px of empty space and no visible boundary.
 */
export default function LandingPage() {
  return (
    <>
      <JsonLd />
      <Navbar />
      <main id="main">
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
