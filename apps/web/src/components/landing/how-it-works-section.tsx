import { Reveal } from "./reveal";
import { Section, SectionHeading } from "./section";

/**
 * Steps are marked with elapsed time rather than 01 / 02 / 03.
 *
 * The section's claim is "ten minutes". Numbering the steps only tells you
 * there are three of them, something the eye already knows, whereas the
 * elapsed clock carries the claim itself and lets the reader check it: the
 * last marker reads 0:10, and it is the promise. It is also the page's own
 * material, since the product's unit of measure is time.
 *
 * `iso` is the same duration for `<time>`, so a screen reader and a crawler get
 * "2 minutes" rather than a bare "0:02".
 */
const STEPS = [
  {
    at: "0:00",
    iso: "PT0M",
    title: "Create the account",
    description:
      "An email and a password is the whole of it. No card, no sales call, and no demo to sit through first.",
  },
  {
    at: "0:02",
    iso: "PT2M",
    title: "Add your services and hours",
    description:
      "What you do, what you charge, and when you work. Customers who book through your link are added for you.",
  },
  {
    at: "0:10",
    iso: "PT10M",
    title: "Book the first job",
    description:
      "Put a job on the board yourself, or send your booking link and let the customer put it there for you.",
  },
] as const;

export function HowItWorksSection() {
  return (
    <Section surface="alt" labelledBy="how-it-works-heading">
      <SectionHeading
        id="how-it-works-heading"
        title="Up and running in ten minutes."
        lede="No onboarding call and no training. If you can use a phone, you can use Zaxvio."
      />

      {/*
        Three columns from `lg`, each opened by a hairline and the clock reading
        set at display size, so the 0:10 at the end is the biggest claim on the
        row. On a phone they stack in the same order with the same rule.

        The earlier version was a vertical rail with the times in a narrow left
        gutter, which suited a three-line list but left the right two thirds of
        a wide screen empty. The steps are still ordered and timed; the clock
        reading is what says so, not the rail.
      */}
      <ol role="list" className="mt-14 grid gap-12 lg:mt-16 lg:grid-cols-3 lg:gap-x-12">
        {STEPS.map((step, i) => (
          <Reveal
            as="li"
            key={step.at}
            delay={i * 90}
            className="border-t border-border pt-6"
          >
            <time
              dateTime={step.iso}
              className="tnum block font-heading text-5xl font-bold tracking-tight text-brand-ink sm:text-6xl"
            >
              {step.at}
              <span className="sr-only"> elapsed</span>
            </time>
            <h3 className="mt-5 font-heading text-xl font-semibold tracking-tight text-ink">
              {step.title}
            </h3>
            <p className="mt-3 max-w-md text-base leading-relaxed text-muted-foreground text-pretty sm:text-lg">
              {step.description}
            </p>
          </Reveal>
        ))}
      </ol>
    </Section>
  );
}
