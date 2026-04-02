"use client";

import {
  IconLayoutDashboard,
  IconReceipt,
  IconFileText,
  IconUsers,
  IconCalendarCheck,
  IconChartBar,
} from "@tabler/icons-react";
import { Fade } from "@/components/animate-ui/primitives/effects/fade";

/* ---------- Kanban Visual ---------- */
function KanbanVisual() {
  return (
    <div className="mt-6 flex gap-2.5">
      {[
        { label: "Scheduled", cards: ["Johnson AC", "Smith Heat"], dot: "bg-blue-400" },
        { label: "In Progress", cards: ["Park Office"], dot: "bg-brand" },
        { label: "Complete", cards: ["Rivera HVAC", "Chen Repair", "Lee Install"], dot: "bg-emerald-400" },
      ].map((col) => (
        <div key={col.label} className="flex-1">
          <div className="mb-2 flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${col.dot}`} />
            <span className="text-[10px] font-medium text-white/40">{col.label}</span>
            <span className="ml-auto text-[10px] text-white/25">{col.cards.length}</span>
          </div>
          <div className="space-y-1.5">
            {col.cards.map((card) => (
              <div
                key={card}
                className="rounded-lg bg-white/[0.07] px-2.5 py-2 text-[10px] font-medium text-white/50 border border-white/[0.05]"
              >
                {card}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------- Chart Visual ---------- */
function ChartVisual() {
  const bars = [35, 55, 45, 70, 50, 85, 65, 90, 60, 78, 92, 80];
  return (
    <div className="mt-6">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] font-medium text-white/40">Monthly Revenue</span>
        <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400">+18%</span>
      </div>
      <div className="flex items-end gap-[3px] h-24">
        {bars.map((h, i) => (
          <div
            key={i}
            className="flex-1 rounded-t-sm bg-gradient-to-t from-brand to-brand/20"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
    </div>
  );
}

/* ---------- Small feature card ---------- */
function FeatureCard({
  icon: Icon,
  title,
  description,
  delay,
}: {
  icon: typeof IconReceipt;
  title: string;
  description: string;
  delay: number;
}) {
  return (
    <Fade inView inViewOnce delay={delay}>
      <div className="group h-full rounded-2xl border border-border/50 bg-card p-6 transition-all duration-300 hover:border-brand/20 hover:shadow-lg hover:shadow-brand/5">
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand/15 to-brand/5 text-brand transition-transform duration-300 group-hover:scale-110">
          <Icon size={20} stroke={1.5} />
        </div>
        <h3 className="font-heading text-base font-semibold text-ink">{title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-ink/55">{description}</p>
      </div>
    </Fade>
  );
}

export function FeaturesSection() {
  return (
    <section
      id="features"
      aria-labelledby="features-heading"
      className="bg-surface py-24"
    >
      <div className="mx-auto max-w-6xl px-6">
        <Fade inView inViewOnce className="text-center">
          <h2
            id="features-heading"
            className="font-heading text-3xl font-bold tracking-tight text-ink sm:text-4xl"
          >
            Everything you need. Nothing you don&apos;t.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-ink/60">
            Purpose-built tools for service professionals who want to work
            smarter, not harder.
          </p>
        </Fade>

        <div className="mt-16 space-y-4">
          {/* Row 1: Hero card (dark bg) + 2 small cards */}
          <div className="grid gap-4 lg:grid-cols-5">
            {/* Hero: Job Dashboard — DARK background */}
            <Fade inView inViewOnce delay={0} className="lg:col-span-3">
              <div className="h-full rounded-2xl bg-midnight p-7 text-midnight-foreground">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-brand/20 text-brand">
                  <IconLayoutDashboard size={20} stroke={1.5} />
                </div>
                <h3 className="font-heading text-lg font-semibold">Job Dashboard</h3>
                <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-white/50">
                  Kanban board for every job — scheduled, in-progress, complete. Drag, drop, done.
                </p>
                <KanbanVisual />
              </div>
            </Fade>

            {/* 2 small cards stacked */}
            <div className="flex flex-col gap-4 lg:col-span-2">
              <FeatureCard
                icon={IconReceipt}
                title="Digital Invoicing"
                description="Generate and send professional invoices on-site. Get paid faster with online payments."
                delay={100}
              />
              <FeatureCard
                icon={IconFileText}
                title="Quote Builder"
                description="Build and send branded quotes in minutes. One click converts to a job."
                delay={200}
              />
            </div>
          </div>

          {/* Row 2: 2 small cards + Hero card (dark bg) */}
          <div className="grid gap-4 lg:grid-cols-5">
            {/* 2 small cards stacked */}
            <div className="flex flex-col gap-4 lg:col-span-2">
              <FeatureCard
                icon={IconUsers}
                title="Customer Database"
                description="Full history for every customer — equipment, past jobs, notes, and communication."
                delay={300}
              />
              <FeatureCard
                icon={IconCalendarCheck}
                title="Self-Booking Portal"
                description="Customers pick a time from your live availability. No more phone tag."
                delay={400}
              />
            </div>

            {/* Hero: KPI Analytics — DARK background */}
            <Fade inView inViewOnce delay={500} className="lg:col-span-3">
              <div className="h-full rounded-2xl bg-midnight p-7 text-midnight-foreground">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-brand/20 text-brand">
                  <IconChartBar size={20} stroke={1.5} />
                </div>
                <h3 className="font-heading text-lg font-semibold">KPI Analytics</h3>
                <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-white/50">
                  Revenue, completion rates, and job trends at a glance. Know your numbers.
                </p>
                <ChartVisual />
              </div>
            </Fade>
          </div>
        </div>
      </div>
    </section>
  );
}
