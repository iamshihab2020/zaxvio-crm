import { IconUserPlus, IconSettings, IconRocket } from "@tabler/icons-react";
import { SectionReveal } from "./section-reveal";

const STEPS = [
  {
    icon: IconUserPlus,
    number: "1",
    title: "Sign Up",
    description: "Create your account in under 2 minutes. No credit card required.",
  },
  {
    icon: IconSettings,
    number: "2",
    title: "Set Up Your Business",
    description:
      "Add your services, pricing, and availability. Import existing customers.",
  },
  {
    icon: IconRocket,
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
        <SectionReveal className="text-center">
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
        </SectionReveal>

        <div className="relative mt-16 grid gap-8 md:grid-cols-3">
          {/* Connecting line (desktop) */}
          <div
            className="pointer-events-none absolute left-0 right-0 top-14 hidden h-0.5 bg-border md:block"
            aria-hidden="true"
          />

          {STEPS.map((step, i) => (
            <SectionReveal key={step.number} delay={i * 150}>
              <div className="relative flex flex-col items-center text-center">
                <div className="relative z-10 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-brand-foreground shadow-md">
                  <step.icon size={24} stroke={1.5} />
                </div>
                <span className="mt-2 font-heading text-xs font-bold uppercase tracking-widest text-brand">
                  Step {step.number}
                </span>
                <h3 className="mt-3 font-heading text-xl font-semibold text-ink">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-ink/60">
                  {step.description}
                </p>
              </div>
            </SectionReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
