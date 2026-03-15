import Link from "next/link";
import { Badge } from "@/components/ui/badge";

const STATS = [
  { value: "15–30 min", label: "saved per job" },
  { value: "TX & FL", label: "built for" },
  { value: "$49/mo", label: "flat pricing" },
] as const;

export function HeroSection() {
  return (
    <section
      aria-labelledby="hero-heading"
      className="relative flex min-h-screen items-center overflow-hidden bg-midnight"
    >
      {/* Radial glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 30% 50%, hsl(var(--brand) / 0.08) 0%, transparent 70%)",
        }}
      />

      <div className="relative z-10 mx-auto grid max-w-7xl gap-12 px-6 py-32 md:grid-cols-2 md:items-center md:py-24 lg:gap-16">
        {/* Left column */}
        <div className="max-w-xl animate-fade-in-up">
          <Badge variant="brand" className="mb-6">
            Built for Solo HVAC Contractors
          </Badge>

          <h1
            id="hero-heading"
            className="font-heading text-4xl font-bold leading-tight tracking-tight text-midnight-foreground sm:text-5xl lg:text-6xl"
          >
            Ditch the Clipboard.{" "}
            <span className="text-brand">Run Your HVAC Business</span> from
            Your Phone.
          </h1>

          <p className="mt-6 text-lg leading-relaxed text-midnight-foreground/70">
            Scheduling, invoicing, and customer management in one app — so
            you can spend less time on paperwork and more time on the job.
          </p>

          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/signup"
              className="rounded-lg bg-brand px-6 py-3 font-heading text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand/90"
            >
              Start Your Free Trial
            </Link>
            <a
              href="#features"
              className="rounded-lg border border-midnight-foreground/20 px-6 py-3 font-heading text-sm font-semibold text-midnight-foreground transition-colors hover:bg-midnight-foreground/5"
            >
              See How It Works
            </a>
          </div>

          {/* Stats bar */}
          <dl className="mt-12 flex flex-wrap gap-8 border-t border-midnight-foreground/10 pt-8">
            {STATS.map((stat) => (
              <div key={stat.label}>
                <dt className="text-xs uppercase tracking-wider text-midnight-foreground/40">
                  {stat.label}
                </dt>
                <dd className="mt-1 font-heading text-2xl font-bold text-brand">
                  {stat.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Right column — mock dashboard card */}
        <div
          className="hidden animate-scale-in md:block"
          style={{ animationDelay: "300ms" }}
          aria-hidden="true"
        >
          <div className="rounded-2xl border border-midnight-foreground/10 bg-midnight-light p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-heading text-sm font-semibold text-midnight-foreground/60">
                Today&apos;s Overview
              </h2>
              <span className="rounded-full bg-brand/20 px-3 py-1 text-xs font-medium text-brand">
                Live
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: "Jobs Today", value: "6" },
                { label: "Revenue (MTD)", value: "$12,480" },
                { label: "Open Invoices", value: "3" },
                { label: "Completion Rate", value: "94%" },
              ].map((kpi) => (
                <div
                  key={kpi.label}
                  className="rounded-xl bg-midnight/60 p-4"
                >
                  <p className="text-xs text-midnight-foreground/40">
                    {kpi.label}
                  </p>
                  <p className="mt-1 font-heading text-2xl font-bold text-midnight-foreground">
                    {kpi.value}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-2">
              {[
                { time: "9:00 AM", customer: "Johnson Residence", type: "AC Repair" },
                { time: "11:30 AM", customer: "Oak Park Office", type: "Maintenance" },
                { time: "2:00 PM", customer: "Rivera Home", type: "Installation" },
              ].map((job) => (
                <div
                  key={job.time}
                  className="flex items-center justify-between rounded-lg bg-midnight/40 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-midnight-foreground">
                      {job.customer}
                    </p>
                    <p className="text-xs text-midnight-foreground/40">
                      {job.type}
                    </p>
                  </div>
                  <span className="text-xs font-medium text-brand">
                    {job.time}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
