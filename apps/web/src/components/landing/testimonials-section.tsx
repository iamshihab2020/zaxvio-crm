import { SectionReveal } from "./section-reveal";

const TESTIMONIALS = [
  {
    quote:
      "I used to lose track of callbacks all the time. Now every job is on my dashboard and my customers book themselves. Game changer.",
    name: "Mike Torres",
    business: "Torres HVAC Services",
    location: "Houston, TX",
  },
  {
    quote:
      "Invoicing on the spot means I get paid the same day instead of chasing people for weeks. Worth every penny of the $49.",
    name: "Sarah Chen",
    business: "CoolBreeze Mechanical",
    location: "Tampa, FL",
  },
  {
    quote:
      "My wife used to do all the paperwork at night. Now the system handles scheduling, quotes, and invoices. We got our evenings back.",
    name: "James Whitfield",
    business: "Whitfield Heating & Air",
    location: "Dallas, TX",
  },
] as const;

export function TestimonialsSection() {
  return (
    <section
      aria-labelledby="testimonials-heading"
      className="bg-surface-alt py-24"
    >
      <div className="mx-auto max-w-7xl px-6">
        <SectionReveal className="text-center">
          <h2
            id="testimonials-heading"
            className="font-heading text-3xl font-bold tracking-tight text-ink sm:text-4xl"
          >
            Trusted by HVAC pros across Texas & Florida
          </h2>
        </SectionReveal>

        <div className="mt-16 grid gap-8 md:grid-cols-3">
          {TESTIMONIALS.map((t, i) => (
            <SectionReveal key={t.name} delay={i * 100}>
              <blockquote className="relative rounded-2xl border border-border bg-card p-6 shadow-sm">
                {/* Decorative quote mark */}
                <span
                  className="absolute -top-3 left-6 font-heading text-5xl font-bold leading-none text-brand/20"
                  aria-hidden="true"
                >
                  &ldquo;
                </span>
                <p className="relative z-10 text-sm leading-relaxed text-ink/80">
                  {t.quote}
                </p>
                <footer className="mt-4 border-t border-border pt-4">
                  <cite className="not-italic">
                    <p className="font-heading text-sm font-semibold text-ink">
                      {t.name}
                    </p>
                    <p className="text-xs text-ink/50">
                      {t.business} &middot; {t.location}
                    </p>
                  </cite>
                </footer>
              </blockquote>
            </SectionReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
