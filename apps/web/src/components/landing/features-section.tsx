import {
  IconCalendarCheck,
  IconLayoutDashboard,
  IconReceipt,
  IconUsers,
  IconFileText,
  IconChartBar,
} from "@tabler/icons-react";
import { SectionReveal } from "./section-reveal";

const FEATURES = [
  {
    icon: IconCalendarCheck,
    title: "Customer Self-Booking",
    description:
      "Customers pick a time that works from your live availability. No more phone tag.",
  },
  {
    icon: IconLayoutDashboard,
    title: "Job Dashboard",
    description:
      "Kanban board for every job — scheduled, in-progress, complete. Drag and drop.",
  },
  {
    icon: IconReceipt,
    title: "Digital Invoicing",
    description:
      "Generate and send professional invoices on-site. Get paid faster with online payments.",
  },
  {
    icon: IconUsers,
    title: "Customer Database",
    description:
      "Full history for every customer — equipment, past jobs, notes, and communication.",
  },
  {
    icon: IconFileText,
    title: "Quote Builder",
    description:
      "Build and send branded quotes in minutes. One click converts to a job.",
  },
  {
    icon: IconChartBar,
    title: "KPI Dashboard",
    description:
      "Revenue, completion rates, and job trends at a glance. Know your numbers.",
  },
] as const;

export function FeaturesSection() {
  return (
    <section
      id="features"
      aria-labelledby="features-heading"
      className="bg-surface py-24"
    >
      <div className="mx-auto max-w-7xl px-6">
        <SectionReveal className="text-center">
          <h2
            id="features-heading"
            className="font-heading text-3xl font-bold tracking-tight text-ink sm:text-4xl"
          >
            Everything you need. Nothing you don&apos;t.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-ink/60">
            Purpose-built tools for HVAC contractors who want to work smarter,
            not harder.
          </p>
        </SectionReveal>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, i) => (
            <SectionReveal key={feature.title} delay={i * 100}>
              <article className="group rounded-2xl border border-border bg-card p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-light text-brand">
                  <feature.icon size={24} stroke={1.5} />
                </div>
                <h3 className="font-heading text-lg font-semibold text-ink">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-ink/60">
                  {feature.description}
                </p>
              </article>
            </SectionReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
