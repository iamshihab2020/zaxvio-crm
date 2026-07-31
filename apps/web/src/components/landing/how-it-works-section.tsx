import { Card, CardContent } from "@/components/ui/card";
import { Reveal } from "./reveal";
import { Section, SectionHeading } from "./section";

/**
 * Steps are marked with elapsed time rather than 01 / 02 / 03.
 *
 * The section's claim is "ten minutes". Numbering the steps only tells you
 * there are three of them — something the eye already knows — whereas the
 * elapsed clock carries the claim itself and lets the reader check it: the
 * last marker reads 0:10, and it is the promise. It is also the page's own
 * material, since the product's unit of measure is time.
 */
const STEPS = [
  /* Descriptions are deliberately kept to a similar length. The cards stretch
     to a shared row height, so a short one leaves a visible hole under its
     text rather than sitting neatly beside its neighbours. */
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
        label="Getting started"
        title="Up and running in ten minutes."
        lede="No onboarding call and no training. If you can use a phone, you can use Zaxvio."
      />

      <ol role="list" className="mt-10 grid gap-5 sm:mt-12 md:grid-cols-3">
        {STEPS.map((step, i) => (
          /* flex column + flex-1 rather than `h-full` on the card: `h-full`
             resolves against the grid item's full height while the card also
             carries a top margin, so each card overhung its own list item by
             exactly that margin. */
          <Reveal as="li" key={step.at} delay={i * 90} className="flex flex-col">
            <div className="flex items-center gap-3">
              <span className="tnum font-mono text-sm font-medium text-brand">
                {step.at}
              </span>
              <span aria-hidden="true" className="h-px flex-1 bg-border" />
            </div>

            <Card className="mt-4 flex-1">
              <CardContent className="p-5 sm:p-6">
                <h3 className="font-heading text-lg font-semibold text-ink">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground text-pretty">
                  {step.description}
                </p>
              </CardContent>
            </Card>
          </Reveal>
        ))}
      </ol>
    </Section>
  );
}
