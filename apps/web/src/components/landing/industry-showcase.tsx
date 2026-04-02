"use client";

import { useState } from "react";
import {
  IconAirConditioning,
  IconDroplet,
  IconBolt,
  IconSpray,
  IconPlant2,
  IconTool,
  IconCheck,
} from "@tabler/icons-react";
import { Fade } from "@/components/animate-ui/primitives/effects/fade";
import { motion, AnimatePresence } from "motion/react";

const INDUSTRIES = [
  {
    id: "hvac",
    label: "HVAC",
    icon: IconAirConditioning,
    headline: "Built for HVAC Professionals",
    description:
      "From emergency AC repairs to routine maintenance, manage your entire HVAC operation from one dashboard. Track equipment, log refrigerants, and invoice on-site.",
    bullets: [
      "Equipment tracking & maintenance logs",
      "Refrigerant logging for compliance",
      "Emergency dispatch & scheduling",
      "On-site invoice generation",
    ],
  },
  {
    id: "plumbing",
    label: "Plumbing",
    icon: IconDroplet,
    headline: "Built for Plumbing Businesses",
    description:
      "Handle emergency callouts, document pipe systems, and convert quotes to jobs with a single tap. Your customers' plumbing history is always at your fingertips.",
    bullets: [
      "Emergency callout management",
      "Pipe system documentation",
      "Quote-to-job conversion",
      "Customer plumbing history",
    ],
  },
  {
    id: "electrical",
    label: "Electrical",
    icon: IconBolt,
    headline: "Built for Electricians",
    description:
      "Schedule inspections, track panel upgrades, and use safety checklists to ensure every job meets code. Invoice customers before you leave the site.",
    bullets: [
      "Inspection scheduling",
      "Panel upgrade tracking",
      "Safety checklist templates",
      "Field invoicing",
    ],
  },
  {
    id: "cleaning",
    label: "Cleaning",
    icon: IconSpray,
    headline: "Built for Cleaning Services",
    description:
      "Automate recurring bookings, assign team schedules, and track property-specific cleaning requirements. Your whole operation, organized.",
    bullets: [
      "Recurring booking automation",
      "Cleaning checklists",
      "Team schedule management",
      "Customer property profiles",
    ],
  },
  {
    id: "landscaping",
    label: "Landscaping",
    icon: IconPlant2,
    headline: "Built for Landscapers",
    description:
      "Plan seasonal work, manage long-term maintenance contracts, and document properties with photos. Send quotes and invoices from the field.",
    bullets: [
      "Seasonal job planning",
      "Maintenance contract tracking",
      "Property photo documentation",
      "Quote builder",
    ],
  },
  {
    id: "general",
    label: "Any Trade",
    icon: IconTool,
    headline: "Built for Any Service Business",
    description:
      "Zaxvio isn't locked to one industry. If you schedule jobs, serve customers, and send invoices — it fits your workflow. Customize everything.",
    bullets: [
      "Custom service categories",
      "Flexible checklist builder",
      "Universal job pipeline",
      "Works for any field service",
    ],
  },
];

export function IndustryShowcase() {
  const [active, setActive] = useState("hvac");
  const current = INDUSTRIES.find((i) => i.id === active) ?? INDUSTRIES[0];

  return (
    <section
      id="industries"
      aria-labelledby="industries-heading"
      className="bg-surface-alt py-24"
    >
      <div className="mx-auto max-w-6xl px-6">
        <Fade inView inViewOnce className="text-center">
          <h2
            id="industries-heading"
            className="font-heading text-3xl font-bold tracking-tight text-ink sm:text-4xl"
          >
            One platform. Every service industry.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-ink/60">
            See how Zaxvio adapts to your business.
          </p>
        </Fade>

        <Fade inView inViewOnce delay={150}>
          <div className="mt-12 grid gap-6 lg:grid-cols-12">
            {/* Left: Industry tabs — vertical on desktop, horizontal on mobile */}
            <div className="lg:col-span-4">
              <div className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
                {INDUSTRIES.map((industry) => {
                  const isActive = active === industry.id;
                  return (
                    <button
                      key={industry.id}
                      type="button"
                      onClick={() => setActive(industry.id)}
                      className={`group flex shrink-0 cursor-pointer items-center gap-3 rounded-2xl border px-5 py-4 text-left transition-all lg:w-full ${
                        isActive
                          ? "border-brand/30 bg-brand/5 shadow-md shadow-brand/10"
                          : "border-border/50 bg-card hover:border-border hover:bg-muted/50"
                      }`}
                    >
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors ${
                          isActive
                            ? "bg-brand text-brand-foreground"
                            : "bg-muted text-ink/40 group-hover:text-ink/60"
                        }`}
                      >
                        <industry.icon size={20} stroke={1.5} />
                      </div>
                      <span
                        className={`text-sm font-semibold transition-colors ${
                          isActive ? "text-brand" : "text-ink/60 group-hover:text-ink"
                        }`}
                      >
                        {industry.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right: Content panel */}
            <div className="lg:col-span-8">
              <div className="relative min-h-[360px]">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={current.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                    className="rounded-3xl border border-border/50 bg-card p-8 sm:p-10"
                  >
                    {/* Header */}
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand/20 to-brand/5 text-brand">
                        <current.icon size={24} stroke={1.5} />
                      </div>
                      <h3 className="font-heading text-xl font-bold text-ink sm:text-2xl">
                        {current.headline}
                      </h3>
                    </div>

                    {/* Description */}
                    <p className="mt-5 text-base leading-relaxed text-ink/60">
                      {current.description}
                    </p>

                    {/* Bullet grid */}
                    <div className="mt-8 grid gap-4 sm:grid-cols-2">
                      {current.bullets.map((bullet) => (
                        <div
                          key={bullet}
                          className="flex items-start gap-3 rounded-xl border border-border/30 bg-muted/30 p-4"
                        >
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand/10">
                            <IconCheck
                              size={14}
                              className="text-brand"
                              stroke={2.5}
                            />
                          </div>
                          <span className="text-sm font-medium text-ink/70">
                            {bullet}
                          </span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>
        </Fade>
      </div>
    </section>
  );
}
