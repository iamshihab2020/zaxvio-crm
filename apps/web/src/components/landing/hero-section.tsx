"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Fade } from "@/components/animate-ui/primitives/effects/fade";
import {
  RotatingTextContainer,
  RotatingText,
} from "@/components/animate-ui/primitives/texts/rotating";
import { IconStarFilled, IconPlayerPlay } from "@tabler/icons-react";
import { DeviceFrameset } from "react-device-frameset";
import "react-device-frameset/styles/marvel-devices.min.css";

const INDUSTRIES = ["HVAC", "Plumbing", "Electrical", "Cleaning", "Landscaping"];

/* ---------- Mini dashboard for inside MacBook ---------- */
function DashboardPreview() {
  return (
    <div className="flex h-full bg-midnight text-midnight-foreground">
      {/* Mini sidebar */}
      <div className="hidden w-11 shrink-0 flex-col items-center gap-3 border-r border-white/5 bg-midnight-light py-3 sm:flex">
        <div className="h-5 w-5 rounded-md bg-brand/30" />
        <div className="mt-2 h-4 w-4 rounded bg-white/10" />
        <div className="h-4 w-4 rounded bg-white/20" />
        <div className="h-4 w-4 rounded bg-white/10" />
        <div className="h-4 w-4 rounded bg-white/10" />
        <div className="h-4 w-4 rounded bg-white/10" />
        <div className="mt-auto h-4 w-4 rounded bg-white/10" />
      </div>

      <div className="flex-1">
        {/* Toolbar */}
        <div className="flex items-center gap-2 border-b border-white/5 bg-midnight-light px-3 py-1.5">
          <div className="flex gap-1.5">
            <span className="h-2 w-2 rounded-full bg-red-500/70" />
            <span className="h-2 w-2 rounded-full bg-yellow-500/70" />
            <span className="h-2 w-2 rounded-full bg-green-500/70" />
          </div>
          <div className="ml-2 flex-1 rounded bg-white/5 px-3 py-0.5 text-[9px] text-white/30">
            app.zaxvio.com/dashboard
          </div>
        </div>

        {/* Content */}
        <div className="p-3">
          {/* KPI row */}
          <div className="grid grid-cols-4 gap-1.5">
            {[
              { label: "Jobs Today", value: "6", change: "+2" },
              { label: "Revenue", value: "$12.4k", change: "+18%" },
              { label: "Open Invoices", value: "3", change: "-1" },
              { label: "Completion", value: "94%", change: "+3%" },
            ].map((kpi) => (
              <div key={kpi.label} className="rounded-md bg-white/5 p-2">
                <p className="text-[8px] text-white/40">{kpi.label}</p>
                <p className="font-heading text-xs font-bold text-white">{kpi.value}</p>
                <p className="text-[8px] text-emerald-400">{kpi.change}</p>
              </div>
            ))}
          </div>

          {/* Chart + Job list side by side */}
          <div className="mt-2.5 grid grid-cols-5 gap-2.5">
            {/* Chart */}
            <div className="col-span-2 rounded-md bg-white/5 p-2.5">
              <p className="mb-1.5 text-[8px] font-medium text-white/40">Revenue This Week</p>
              <div className="flex items-end gap-[2px] h-16">
                {[35, 55, 40, 70, 50, 85, 65].map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-t-sm bg-gradient-to-t from-brand/80 to-brand/30"
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>
            </div>

            {/* Job list */}
            <div className="col-span-3 space-y-1">
              <p className="text-[8px] font-medium text-white/40">Today&apos;s Schedule</p>
              {[
                { time: "9:00", customer: "Johnson Residence", type: "Emergency Repair", active: true },
                { time: "11:30", customer: "Oak Park Office", type: "Scheduled Service", active: false },
                { time: "2:00", customer: "Rivera Home", type: "New Installation", active: false },
                { time: "4:00", customer: "Chen Apartment", type: "AC Maintenance", active: false },
                { time: "5:30", customer: "Williams House", type: "Duct Cleaning", active: false },
              ].map((job) => (
                <div key={job.time} className="flex items-center justify-between rounded bg-white/5 px-2 py-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className={`h-1 w-1 rounded-full ${job.active ? "bg-emerald-400" : "bg-white/15"}`} />
                    <div>
                      <p className="text-[9px] font-medium text-white/70">{job.customer}</p>
                      <p className="text-[7px] text-white/25">{job.type}</p>
                    </div>
                  </div>
                  <span className="text-[8px] font-medium text-brand/80">{job.time}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent customers row */}
          <div className="mt-2.5 rounded-md bg-white/5 p-2.5">
            <p className="mb-1.5 text-[8px] font-medium text-white/40">Recent Customers</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { initials: "JR", name: "Johnson R.", color: "bg-blue-500/60" },
                { initials: "OP", name: "Oak Park", color: "bg-emerald-500/60" },
                { initials: "RH", name: "Rivera H.", color: "bg-violet-500/60" },
              ].map((c) => (
                <div key={c.initials} className="flex items-center gap-1.5">
                  <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[7px] font-bold text-white ${c.color}`}>
                    {c.initials}
                  </span>
                  <span className="text-[8px] text-white/50">{c.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function HeroSection() {
  return (
    <section
      aria-labelledby="hero-heading"
      className="aurora-bg relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 pt-28 pb-16"
    >
      {/* Content — centered */}
      <div className="relative z-10 mx-auto max-w-4xl text-center">
        {/* Badge */}
        <Fade inView inViewOnce delay={0}>
          <Badge
            variant="brand"
            className="mb-6 border border-brand/20 bg-brand/10 text-brand backdrop-blur"
          >
            Service Management for Every Industry
          </Badge>
        </Fade>

        {/* Headline */}
        <Fade inView inViewOnce delay={100}>
          <h1
            id="hero-heading"
            className="font-heading text-4xl font-bold leading-[1.1] tracking-tight text-midnight-foreground sm:text-5xl md:text-6xl lg:text-7xl"
          >
            Run Your{" "}
            <span className="relative inline-flex text-brand">
              <RotatingTextContainer
                text={INDUSTRIES}
                duration={2500}
                className="inline-block min-w-[3ch]"
              >
                <RotatingText className="inline-block" />
              </RotatingTextContainer>
            </span>
            <br className="hidden sm:block" />
            Business from Your Phone.
          </h1>
        </Fade>

        {/* Subtitle */}
        <Fade inView inViewOnce delay={200}>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-midnight-foreground/60 sm:text-xl">
            Scheduling, invoicing, and customer management in one app — built
            for service businesses that get work done.
          </p>
        </Fade>

        {/* CTAs */}
        <Fade inView inViewOnce delay={300}>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Button
              asChild
              size="lg"
              className="h-12 rounded-xl bg-brand px-8 font-heading text-sm font-semibold text-brand-foreground shadow-lg shadow-brand/25 hover:bg-brand/90 hover:shadow-xl hover:shadow-brand/30 transition-all"
            >
              <Link href="/signup">Start Your Free Trial</Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              size="lg"
              className="h-12 gap-2 rounded-xl font-heading text-sm font-semibold text-midnight-foreground/70 hover:text-midnight-foreground hover:bg-white/5"
            >
              <a href="#features">
                <IconPlayerPlay size={16} stroke={2} />
                See How It Works
              </a>
            </Button>
          </div>
        </Fade>

        {/* Social proof */}
        <Fade inView inViewOnce delay={400}>
          <div className="mt-8 flex items-center justify-center gap-2 text-sm text-midnight-foreground/50">
            <div className="flex gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <IconStarFilled
                  key={i}
                  size={14}
                  className="text-amber-400"
                />
              ))}
            </div>
            <span>
              Rated <span className="font-semibold text-midnight-foreground/70">4.9/5</span> by 500+ service businesses
            </span>
          </div>
        </Fade>
      </div>

      {/* MacBook Pro mockup */}
      <Fade inView inViewOnce delay={600}>
        <div className="relative z-10 mx-auto mt-12 w-full max-w-4xl">
          {/* Glow effect behind device */}
          <div
            className="pointer-events-none absolute -inset-8 rounded-3xl opacity-40 blur-3xl"
            style={{
              background:
                "radial-gradient(ellipse at center, hsl(var(--brand) / 0.2) 0%, transparent 70%)",
            }}
            aria-hidden="true"
          />

          {/* Device — hidden on small mobile */}
          <div className="hidden sm:block">
            <DeviceFrameset device="MacBook Pro">
              <DashboardPreview />
            </DeviceFrameset>
          </div>

          {/* Mobile fallback — simplified card */}
          <div className="sm:hidden">
            <div className="rounded-2xl border border-white/10 bg-midnight-light shadow-2xl overflow-hidden">
              <DashboardPreview />
            </div>
          </div>
        </div>
      </Fade>
    </section>
  );
}
