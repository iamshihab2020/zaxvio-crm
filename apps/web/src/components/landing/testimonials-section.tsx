"use client";

import { IconStarFilled } from "@tabler/icons-react";
import { Fade } from "@/components/animate-ui/primitives/effects/fade";

const TESTIMONIALS = [
  {
    quote:
      "I used to lose track of callbacks all the time. Now every job is on my dashboard and my customers book themselves. Game changer.",
    name: "Mike Torres",
    business: "Torres Home Services",
    location: "Houston, TX",
    initials: "MT",
    color: "bg-blue-500",
  },
  {
    quote:
      "Invoicing on the spot means I get paid the same day instead of chasing people for weeks. Worth every penny of the $49.",
    name: "Sarah Chen",
    business: "ClearFlow Plumbing",
    location: "Tampa, FL",
    initials: "SC",
    color: "bg-emerald-500",
  },
  {
    quote:
      "My wife used to do all the paperwork at night. Now the system handles scheduling, quotes, and invoices. We got our evenings back.",
    name: "James Whitfield",
    business: "BrightSpark Electrical",
    location: "Dallas, TX",
    initials: "JW",
    color: "bg-violet-500",
  },
] as const;

export function TestimonialsSection() {
  return (
    <section
      aria-labelledby="testimonials-heading"
      className="bg-surface-alt py-24"
    >
      <div className="mx-auto max-w-7xl px-6">
        <Fade inView inViewOnce className="text-center">
          <h2
            id="testimonials-heading"
            className="font-heading text-3xl font-bold tracking-tight text-ink sm:text-4xl"
          >
            Trusted by service professionals across the country
          </h2>
        </Fade>

        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {TESTIMONIALS.map((t, i) => (
            <Fade key={t.name} inView inViewOnce delay={i * 100}>
              <div className="relative h-full rounded-3xl border border-border/50 bg-card p-7 transition-all duration-300 hover:shadow-lg hover:shadow-black/5">
                {/* Stars */}
                <div className="mb-4 flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <IconStarFilled
                      key={j}
                      size={14}
                      className="text-amber-400"
                    />
                  ))}
                </div>

                {/* Quote */}
                <p className="text-sm leading-relaxed text-ink/70">
                  &ldquo;{t.quote}&rdquo;
                </p>

                {/* Author */}
                <div className="mt-6 flex items-center gap-3 border-t border-border/50 pt-5">
                  {/* Avatar */}
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${t.color}`}
                  >
                    {t.initials}
                  </div>
                  <div>
                    <p className="font-heading text-sm font-semibold text-ink">
                      {t.name}
                    </p>
                    <p className="text-xs text-ink/50">
                      {t.business} &middot; {t.location}
                    </p>
                  </div>
                </div>
              </div>
            </Fade>
          ))}
        </div>
      </div>
    </section>
  );
}
