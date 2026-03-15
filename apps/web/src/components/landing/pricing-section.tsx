import Link from "next/link";
import { IconCheck } from "@tabler/icons-react";
import { SectionReveal } from "./section-reveal";

const FEATURES = [
  "Unlimited jobs & customers",
  "Customer self-booking portal",
  "Digital invoicing & payments",
  "Quote builder with PDF export",
  "Job Kanban dashboard",
  "KPI & revenue analytics",
  "Equipment tracking",
  "Maintenance contracts",
  "Checklist templates",
  "Email notifications",
  "Mobile-friendly design",
  "Priority support",
] as const;

export function PricingSection() {
  return (
    <section
      id="pricing"
      aria-labelledby="pricing-heading"
      className="bg-surface py-24"
    >
      <div className="mx-auto max-w-3xl px-6">
        <SectionReveal className="text-center">
          <h2
            id="pricing-heading"
            className="font-heading text-3xl font-bold tracking-tight text-ink sm:text-4xl"
          >
            Simple, honest pricing
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-ink/60">
            One plan. Everything included. No per-user fees, no surprise
            charges.
          </p>
        </SectionReveal>

        <SectionReveal delay={150}>
          <article className="relative mt-12 overflow-hidden rounded-2xl border border-border bg-card shadow-lg">
            {/* Top accent strip */}
            <div className="h-1.5 bg-brand" aria-hidden="true" />

            <div className="p-8 text-center sm:p-12">
              <p className="font-heading text-sm font-semibold uppercase tracking-wider text-brand">
                Everything Plan
              </p>
              <div className="mt-4 flex items-baseline justify-center gap-1">
                <span className="font-heading text-5xl font-bold tracking-tight text-ink sm:text-6xl">
                  $49
                </span>
                <span className="text-lg text-ink/40">/mo</span>
              </div>
              <p className="mt-2 text-sm text-ink/60">
                per business &middot; billed monthly
              </p>

              <ul className="mx-auto mt-8 grid max-w-md gap-3 text-left sm:grid-cols-2" role="list">
                {FEATURES.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-2 text-sm text-ink/80"
                  >
                    <IconCheck
                      size={18}
                      className="mt-0.5 shrink-0 text-brand"
                      stroke={2}
                    />
                    {feature}
                  </li>
                ))}
              </ul>

              <div className="mt-10">
                <Link
                  href="/signup"
                  className="inline-block rounded-lg bg-brand px-8 py-3.5 font-heading text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand/90"
                >
                  Start Your Free Trial
                </Link>
                <p className="mt-3 text-xs text-ink/40">
                  No credit card required &middot; Cancel anytime
                </p>
              </div>
            </div>
          </article>
        </SectionReveal>
      </div>
    </section>
  );
}
