import Link from "next/link";
import { IconArrowRight, IconStarFilled } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { DaySheet } from "./day-sheet";
import { Reveal } from "./reveal";

const INDUSTRIES = "HVAC · Plumbing · Electrical · Cleaning · Landscaping";

/**
 * Hero.
 *
 * The headline no longer carries a rotating industry word. That trick reflowed
 * the <h1> every 2.5 seconds — measurable layout shift on the page's largest
 * text — and left the heading's text content unstable for screen readers and
 * crawlers. The multi-industry claim is stated plainly in the eyebrow instead,
 * and the Industries section proves it properly.
 */
export function HeroSection() {
  return (
    <section
      aria-labelledby="hero-heading"
      className="relative overflow-hidden bg-surface pb-14 pt-24 sm:pb-16 sm:pt-28 lg:pb-20 lg:pt-32"
    >
      {/* Ruled texture + a single warm wash behind the headline. Replaces the
          animated aurora gradient: a nebula says "AI startup", ruled paper says
          "work order". */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="sheet-wash absolute inset-0 opacity-60" />
        <div
          className="absolute -top-40 left-1/2 h-[36rem] w-[68rem] -translate-x-1/2 rounded-full opacity-70 blur-3xl"
          style={{
            background:
              "radial-gradient(ellipse at center, hsl(var(--brand) / 0.14) 0%, transparent 65%)",
          }}
        />
      </div>

      <div className="relative mx-auto grid w-full max-w-6xl gap-12 px-5 sm:px-6 lg:grid-cols-12 lg:items-center lg:gap-10 lg:px-8">
        {/* Copy */}
        <div className="lg:col-span-6">
          <Reveal>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-brand">
              {INDUSTRIES}
            </p>
          </Reveal>

          <Reveal delay={60}>
            <h1
              id="hero-heading"
              className="mt-5 font-heading text-[2.5rem] font-bold leading-[1.05] tracking-tight text-ink text-balance sm:text-5xl lg:text-6xl"
            >
              Run the whole day from one screen.
            </h1>
          </Reveal>

          <Reveal delay={120}>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground text-pretty sm:text-lg">
              Zaxvio keeps your schedule, quotes, invoices and customer history
              in one place — so you can book a job, finish it, and get paid
              without going back to the office.
            </p>
          </Reveal>

          <Reveal delay={180}>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button
                asChild
                size="lg"
                className="h-12 w-full px-7 text-base font-semibold sm:w-auto"
              >
                <Link href="/signup">
                  Start free trial
                  <IconArrowRight className="!size-[18px]" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="h-12 w-full px-7 text-base sm:w-auto"
              >
                <a href="#features">See what&rsquo;s included</a>
              </Button>
            </div>
          </Reveal>

          <Reveal delay={240}>
            <div className="mt-7 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-0.5" aria-hidden="true">
                {Array.from({ length: 5 }).map((_, i) => (
                  <IconStarFilled key={i} size={13} className="text-amber-500" />
                ))}
              </span>
              <span>
                <span className="tnum font-mono font-medium text-ink">4.9</span> from
                500+ service businesses
              </span>
              {/* The divider only earns its place when both items sit on one
                  line; when the row wraps it strands a pipe at the end. */}
              <span aria-hidden="true" className="hidden text-border sm:inline">
                |
              </span>
              <span>No card to start</span>
            </div>
          </Reveal>
        </div>

        {/* Signature */}
        <Reveal delay={200} className="lg:col-span-6">
          <DaySheet />
        </Reveal>
      </div>
    </section>
  );
}
