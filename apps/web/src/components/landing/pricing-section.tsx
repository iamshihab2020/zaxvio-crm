"use client";

import Link from "next/link";
import {
  IconCheck,
  IconClipboard,
  IconPhone,
  IconTable,
  IconApps,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Fade } from "@/components/animate-ui/primitives/effects/fade";

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

const REPLACES = [
  { icon: IconClipboard, label: "Paper & clipboard", cost: "$0 but slow" },
  { icon: IconPhone, label: "Phone scheduling", cost: "Missed calls" },
  { icon: IconTable, label: "Spreadsheets", cost: "$10+/mo" },
  { icon: IconApps, label: "3+ separate apps", cost: "$150+/mo" },
] as const;

export function PricingSection() {
  return (
    <section
      id="pricing"
      aria-labelledby="pricing-heading"
      className="bg-surface py-24"
    >
      <div className="mx-auto max-w-3xl px-6">
        <Fade inView inViewOnce className="text-center">
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
        </Fade>

        {/* Gradient glow border pricing card */}
        <Fade inView inViewOnce delay={150}>
          <div className="relative mt-12">
            {/* Glow effect */}
            <div
              className="pointer-events-none absolute -inset-1 rounded-[28px] bg-gradient-to-b from-brand/40 via-brand/10 to-transparent opacity-60 blur-sm"
              aria-hidden="true"
            />

            <div className="relative overflow-hidden rounded-3xl border border-brand/20 bg-card shadow-xl">
              {/* Badge */}
              <div className="flex justify-center pt-8">
                <Badge className="border-brand/20 bg-brand/10 text-brand">
                  Most Popular
                </Badge>
              </div>

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

                <ul
                  className="mx-auto mt-8 grid max-w-md gap-3 text-left sm:grid-cols-2"
                  role="list"
                >
                  {FEATURES.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2 text-sm text-ink/80"
                    >
                      <IconCheck
                        size={16}
                        className="mt-0.5 shrink-0 text-brand"
                        stroke={2.5}
                      />
                      {feature}
                    </li>
                  ))}
                </ul>

                <div className="mt-10">
                  <Button
                    asChild
                    size="lg"
                    className="h-12 rounded-xl bg-brand px-10 font-heading text-sm font-semibold text-brand-foreground shadow-lg shadow-brand/25 hover:bg-brand/90 hover:shadow-xl hover:shadow-brand/30 transition-all"
                  >
                    <Link href="/signup">Start Your Free Trial</Link>
                  </Button>
                  <p className="mt-3 text-xs text-ink/40">
                    No credit card required &middot; Cancel anytime
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Fade>

        {/* "What you're replacing" */}
        <Fade inView inViewOnce delay={300}>
          <div className="mt-12">
            <p className="mb-4 text-center text-sm font-semibold uppercase tracking-wider text-ink/40">
              What you&apos;re replacing
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {REPLACES.map((item) => (
                <div
                  key={item.label}
                  className="rounded-xl border border-border/50 bg-card/50 p-4 text-center"
                >
                  <item.icon
                    size={20}
                    className="mx-auto text-ink/50"
                    stroke={1.5}
                  />
                  <p className="mt-2 text-xs font-medium text-ink/60">
                    {item.label}
                  </p>
                  <p className="mt-0.5 text-[10px] text-ink/40 line-through">
                    {item.cost}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </Fade>
      </div>
    </section>
  );
}
