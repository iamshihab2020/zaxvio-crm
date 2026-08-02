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
 */
const STEPS = [
  {
    at: "0:00",
    title: "Create the account",
    description:
      "An email and a password is the whole of it. No card, no sales call, and no demo to sit through first.",
  },
  {
    at: "0:02",
    title: "Add your services and hours",
    description:
      "What you do, what you charge, and when you work. Bring your customer list over from a spreadsheet if you have one.",
  },
  {
    at: "0:10",
    title: "Book the first job",
    description:
      "Put a job on the board yourself, or send your booking link and let the customer put it there for you.",
  },
] as const;

export function HowItWorksSection() {
  return (
    <Section surface="base" labelledBy="how-it-works-heading">
      <SectionHeading
        id="how-it-works-heading"
        title="Up and running in ten minutes."
        lede="No onboarding call and no training. If you can use a phone, you can use Zaxvio."
      />

      {/*
        A ruled sequence on a left time rail, not three equal cards.

        Three sections on this page were rendering the same `md:grid-cols-3`
        card grid, which is the layout family a reader recognises fastest and
        the one the page could least afford to repeat. This one gives it up
        most naturally: the steps are ordered and timed, and a vertical rail
        with the clock running down it shows that, where three side-by-side
        cards actively hid it. It also drops the card chrome from a section
        that never needed elevation to separate three items.
      */}
      <ol role="list" className="mt-10 sm:mt-12">
        {STEPS.map((step, i) => (
          <Reveal
            as="li"
            key={step.at}
            delay={i * 90}
            className="group grid grid-cols-[3.25rem_1fr] gap-x-4 sm:grid-cols-[4.5rem_1fr] sm:gap-x-6"
          >
            <div className="flex flex-col items-start">
              <span className="tnum py-1 font-mono text-sm font-medium text-brand">
                {step.at}
              </span>
              {/* The rail stops at the last step rather than trailing into
                  whitespace below it. */}
              <span
                aria-hidden="true"
                className="w-px flex-1 bg-border group-last:hidden"
              />
            </div>

            <div className="pb-8 group-last:pb-0">
              <h3 className="font-heading text-lg font-semibold text-ink">
                {step.title}
              </h3>
              <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground text-pretty">
                {step.description}
              </p>
            </div>
          </Reveal>
        ))}
      </ol>
    </Section>
  );
}
