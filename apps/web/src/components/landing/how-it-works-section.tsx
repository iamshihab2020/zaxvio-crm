"use client";

import { Fade } from "@/components/animate-ui/primitives/effects/fade";

const STEPS = [
  {
    number: "1",
    title: "Sign Up",
    description: "Create your account in under 2 minutes. No credit card required.",
  },
  {
    number: "2",
    title: "Set Up Your Business",
    description:
      "Add your services, pricing, and availability. Import existing customers.",
  },
  {
    number: "3",
    title: "Start Managing Jobs",
    description:
      "Schedule jobs, send invoices, and track everything from your phone.",
  },
] as const;

export function HowItWorksSection() {
  return (
    <section
      aria-labelledby="how-it-works-heading"
      className="bg-surface-alt py-24"
    >
      <div className="mx-auto max-w-5xl px-6">
        <Fade inView inViewOnce className="text-center">
          <h2
            id="how-it-works-heading"
            className="font-heading text-3xl font-bold tracking-tight text-ink sm:text-4xl"
          >
            Up and running in 10 minutes
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-ink/60">
            No training, no onboarding calls. If you can use a smartphone,
            you can use Zaxvio.
          </p>
        </Fade>

        <div className="relative mt-16 grid gap-8 md:grid-cols-3">
          {/* Connecting gradient line (desktop) */}
          <div
            className="pointer-events-none absolute left-[16.5%] right-[16.5%] top-10 hidden h-[2px] bg-gradient-to-r from-brand/20 via-brand/50 to-brand/20 md:block"
            aria-hidden="true"
          />

          {STEPS.map((step, i) => (
            <Fade key={step.number} inView inViewOnce delay={i * 150}>
              <div className="relative flex flex-col items-center text-center">
                {/* Large gradient number */}
                <div className="relative z-10 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-brand/70 font-heading text-3xl font-bold text-brand-foreground shadow-lg shadow-brand/20">
                  {step.number}
                </div>

                {/* Glass card */}
                <div className="mt-6 w-full rounded-2xl border border-border/50 bg-card/80 p-6 backdrop-blur-sm">
                  <h3 className="font-heading text-xl font-semibold text-ink">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink/60">
                    {step.description}
                  </p>
                </div>
              </div>
            </Fade>
          ))}
        </div>
      </div>
    </section>
  );
}
