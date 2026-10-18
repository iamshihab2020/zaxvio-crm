import type { Metadata } from "next";
import { Navbar } from "@/components/landing/navbar";
import { Footer } from "@/components/landing/footer";
import { JsonLd } from "@/components/landing/json-ld";
import { HeroSection } from "@/components/landing/hero-section";
import { TrustBar } from "@/components/landing/trust-bar";
import { JobFlowSection } from "@/components/landing/job-flow-section";
import { DifferentiatorsSection } from "@/components/landing/differentiators-section";
import { IndustryShowcase } from "@/components/landing/industry-showcase";
import { HowItWorksSection } from "@/components/landing/how-it-works-section";
import { PricingSection } from "@/components/landing/pricing-section";
import { FaqSection } from "@/components/landing/faq-section";
import { BlogPreviewSection } from "@/components/landing/blog-preview-section";
import { FinalCtaSection } from "@/components/landing/final-cta-section";
import { SkipLink } from "@/components/landing/skip-link";
import { MotionProvider } from "@/components/motion-provider";

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
 * Section surfaces alternate strictly, and every section differs from its
 * neighbours:
 *
 *   Hero         base   (plain surface, a faint dot grid)
 *   Trades       alt    (bordered strip)
 *   Booking→paid base   #features
 *   Why switch   alt    #why-zaxvio
 *   Industries   base   #industries
 *   Up & running alt
 *   Pricing      base   #pricing
 *   FAQ          alt    #faq
 *   Blog         base
 *   Closing      alt    (one large card), then the footer's navy
 *
 * That ordering is set here and enforced by the `surface` prop on `Section`.
 * The page ends on neutral surfaces and the navy footer is its only dark foot:
 * the closing band used to be a navy slab, and the user rejected the saturated
 * band. `#features` moved from the old six-card bento to Booking→paid, so the
 * navbar's Features link, the footer's `/#features` and the hero's "See what's
 * included" still land on it.
 *
 * There is no testimonials section, on purpose (LAND-01). The three quotes that
 * sat between Pricing and FAQ were invented people at invented businesses, and
 * PRODUCT.md records that no customer evidence exists yet. Bring the section
 * back only with real customers who agreed to be quoted, and re-check the
 * alternation when you do.
 */
export default function LandingPage() {
  return (
    <MotionProvider>
      <JsonLd />
      <SkipLink />
      <Navbar />
      <main id="main">
        <HeroSection />
        <TrustBar />
        <JobFlowSection />
        <DifferentiatorsSection />
        <IndustryShowcase />
        <HowItWorksSection />
        <PricingSection />
        <FaqSection />
        <BlogPreviewSection />
        <FinalCtaSection />
      </main>
      <Footer />
    </MotionProvider>
  );
}
