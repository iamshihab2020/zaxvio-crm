import Link from "next/link";
import {
  IconArrowRight,
  IconCheck,
  IconFileText,
  IconReceipt,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DaySheet } from "./day-sheet";
import { IconDisc, Pill } from "./example-ui";

/**
 * The three terms a reader needs before they click. Plain facts, each one true
 * (PRODUCT.md → Account lifecycle), laid out as a wrapping row with a check
 * each. They used to be a single "14 days · no card · $49" line, which is a
 * middle-dot meta string and read as fine print; here they carry equal weight.
 */
const FACTS = [
  "14-day free trial",
  "No card needed",
  "$49 a month per business",
] as const;

/**
 * Hero.
 *
 * Paints with the HTML. Nothing up here is wrapped in `<Reveal>`, and that is
 * the point (LAND-04): `.js .reveal` is `opacity: 0` from first paint until
 * React hydrates and an IntersectionObserver fires, so the headline (the
 * page's LCP element) used to wait on the whole client bundle, and an
 * `opacity: 0` element is not even an LCP candidate until it shows. Below the
 * fold that cost is invisible; on the first screen it is the load time. Do not
 * re-wrap anything in this component, and add no entrance animation: the
 * day sheet's now-marker is the one authored motion up here, and it mounts
 * after paint.
 *
 * The headline no longer carries a rotating industry word. That trick reflowed
 * the <h1> every 2.5 seconds, a measurable layout shift on the page's largest
 * text, and left the heading's text content unstable for screen readers and
 * crawlers.
 *
 * There is no eyebrow. It read "Field service software" in mono caps above the
 * headline, which said what the headline and the product already say, and an
 * eyebrow above a heading is a pattern this page has retired everywhere else.
 *
 * The rating row that sat under the CTAs is gone. It made the hero five text
 * elements deep, and the figure itself ("4.9 from 500+ service businesses") was
 * invented: there are no such reviews. It was also mirrored into JSON-LD as an
 * aggregateRating, which is a rich-results violation rather than a design
 * choice. The three facts under the CTAs replace it, and every one of them is
 * a term of the trial, not a claim about other people.
 *
 * The background is the page surface with a faint dot grid (`.dot-field`) that
 * fades out toward the copy. It replaced a radial blue wash behind the
 * headline, and before that an aurora: DESIGN.md rejects glow as decoration,
 * and a wash is a glow with a different name. The grid is texture, masked to
 * nothing at its edges, and carries no colour of its own.
 */
export function HeroSection() {
  return (
    <section
      aria-labelledby="hero-heading"
      className="relative overflow-hidden bg-surface pb-20 pt-28 sm:pt-32 lg:pb-28 lg:pt-36"
    >
      <div
        aria-hidden="true"
        className="dot-field pointer-events-none absolute inset-0"
      />

      <div className="relative mx-auto grid w-full max-w-[88rem] gap-14 px-5 sm:px-6 lg:grid-cols-12 lg:items-center lg:gap-x-12 lg:px-8">
        {/* Copy */}
        <div className="lg:col-span-6">
          <h1
            id="hero-heading"
            className="font-heading text-[2.75rem] font-bold leading-[1.02] tracking-tight text-ink text-balance sm:text-6xl lg:text-[4.25rem]"
          >
            Run the whole day from one screen.
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground text-pretty sm:text-xl">
            Your schedule, quotes, invoices and customer history in one place.
            Book a job, finish it, get paid.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
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

          <ul role="list" className="mt-8 flex flex-wrap gap-x-6 gap-y-2.5">
            {FACTS.map((fact) => (
              <li
                key={fact}
                className="flex items-center gap-2 text-base font-medium text-ink"
              >
                <IconCheck
                  size={18}
                  stroke={2.5}
                  className="shrink-0 text-brand-ink"
                  aria-hidden="true"
                />
                {fact}
              </li>
            ))}
          </ul>
        </div>

        {/* Signature */}
        <div className="lg:col-span-6">
          <HeroExample />
        </div>
      </div>
    </section>
  );
}

/**
 * The day sheet with the two things that happen around a day's work: a quote
 * accepted and an invoice paid.
 *
 * One composite, one figure, one visible caption. Everything in it is sample
 * data and says so (PRODUCT.md: demo data is labelled wherever it is shown).
 * The cards are real text, not decoration, so they stay in the accessibility
 * tree and the figure's caption describes them together.
 *
 * From `lg` the two cards overhang the sheet's right edge. They sit on the
 * right deliberately: a job block's customer and service text is left-aligned,
 * so a card there covers only empty block and a start time, never a name. Below
 * `lg` they would hang off a phone's edge, so they stack under the sheet as two
 * ordinary cards.
 */
function HeroExample() {
  return (
    <figure className="relative m-0">
      <DaySheet />

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:contents">
        <EventCard
          icon={IconFileText}
          title="Quote Q-0042"
          customer="Williams House"
          amount="$1,280.00"
          pill="Accepted"
          className="lg:absolute lg:-right-6 lg:top-[21%]"
        />
        <EventCard
          icon={IconReceipt}
          title="INV-0318"
          customer="Oak Park Office"
          amount="$412.00"
          pill="Paid"
          className="lg:absolute lg:-right-4 lg:bottom-[11%]"
        />
      </div>

      <figcaption className="mt-4 text-sm text-muted-foreground">
        Example data: a day on the schedule, a quote accepted and an invoice
        paid.
      </figcaption>
    </figure>
  );
}

function EventCard({
  icon,
  title,
  customer,
  amount,
  pill,
  className,
}: {
  icon: typeof IconReceipt;
  title: string;
  customer: string;
  amount: string;
  pill: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card p-3.5 text-card-foreground shadow-xl shadow-ink/5 lg:w-60",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <IconDisc icon={icon} size="sm" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">{title}</p>
          <p className="truncate text-xs text-muted-foreground">{customer}</p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3">
        <p className="tnum text-lg font-bold text-ink">{amount}</p>
        <Pill tone="good" withCheck>
          {pill}
        </Pill>
      </div>
    </div>
  );
}
