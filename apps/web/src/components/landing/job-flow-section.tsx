import {
  IconCalendarEvent,
  IconCalendarPlus,
  IconCash,
  IconChecklist,
  IconClock,
  IconFileText,
  IconLink,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { CheckBox, IconDisc, MiniCard, Pill } from "./example-ui";
import { Reveal } from "./reveal";
import { Section, SectionHeading } from "./section";

/* ── Example snippets ───────────────────────────────────────────────────
   One small, real-looking piece of the product per step, drawn with the
   page's tokens rather than screenshotted. They replace the old features
   bento, where four of six cards had no visual and "Revenue analytics" was
   an empty card. Every snippet is `aria-hidden` by its caller: what each one
   shows is also said in the step's sentence.

   The names and amounts are sample data and the section says so underneath.
   The same Williams House quote and Oak Park Office invoice appear in the
   hero, so the page tells one example through, not five.
   ──────────────────────────────────────────────────────────────────────── */

const SLOTS = ["08:00", "09:30", "11:00", "13:30", "15:00", "16:30"] as const;
const TAKEN = new Set<string>(["09:30", "15:00"]);

function BookedVisual() {
  return (
    <div className="space-y-2.5">
      <MiniCard className="p-3">
        <p className="text-xs font-medium text-muted-foreground">Open times</p>
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          {SLOTS.map((slot) => (
            <span
              key={slot}
              className={cn(
                "tnum rounded-md border px-1 py-1.5 text-center text-xs",
                TAKEN.has(slot)
                  ? "border-border bg-muted text-muted-foreground line-through"
                  : "border-brand/40 bg-brand/10 font-medium text-brand-ink",
              )}
            >
              {slot}
            </span>
          ))}
        </div>
      </MiniCard>

      {/* `<wbr>` after "book/" so the link wraps at the slash in a narrow
          column instead of being cut off mid-word. */}
      <div className="flex items-start gap-1.5 rounded-md border border-border bg-surface-alt px-2.5 py-2">
        <IconLink
          size={14}
          stroke={2}
          className="mt-0.5 shrink-0 text-brand-ink"
        />
        <span className="min-w-0 break-words text-xs font-medium leading-snug text-ink">
          zaxvio.com/book/
          <wbr />
          your-business
        </span>
      </div>
    </div>
  );
}

function ScheduledVisual() {
  return (
    <MiniCard>
      <p className="tnum text-xs text-muted-foreground">JOB-2026-0142</p>
      <p className="mt-1 text-sm font-semibold text-ink">Rivera Home</p>
      <p className="text-xs text-muted-foreground">New install, day 1</p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5 border-t border-border pt-3">
        <span className="tnum flex items-center gap-1 text-xs font-medium text-ink">
          <IconClock size={14} stroke={2} className="text-muted-foreground" />
          11:30
        </span>
        <Pill tone="brand">Scheduled</Pill>
      </div>
    </MiniCard>
  );
}

function QuotedVisual() {
  return (
    <MiniCard>
      <p className="tnum text-xs text-muted-foreground">Q-0042</p>
      <p className="mt-1 text-sm font-semibold text-ink">Williams House</p>
      <p className="text-xs text-muted-foreground">Duct inspection</p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5 border-t border-border pt-3">
        <span className="tnum text-sm font-bold text-ink">$1,280.00</span>
        <Pill tone="good" withCheck>
          Accepted
        </Pill>
      </div>
    </MiniCard>
  );
}

function DoneVisual() {
  const items = [
    { label: "Confirm the scope", done: true },
    { label: "Complete the work", done: true },
    { label: "Photograph the result", done: false },
  ] as const;

  return (
    <MiniCard>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">Checklist</p>
        <p className="tnum text-xs font-medium text-ink">2 of 3</p>
      </div>
      <ul role="list" className="mt-2.5 space-y-2.5">
        {items.map((item) => (
          <li key={item.label} className="flex items-start gap-2">
            <CheckBox checked={item.done} />
            <span
              className={cn(
                "text-xs leading-snug",
                item.done ? "text-muted-foreground" : "font-medium text-ink",
              )}
            >
              {item.label}
            </span>
          </li>
        ))}
      </ul>
    </MiniCard>
  );
}

function PaidVisual() {
  return (
    <MiniCard>
      <div className="flex items-center justify-between gap-2">
        <p className="tnum text-xs text-muted-foreground">INV-0318</p>
        <Pill tone="good" withCheck>
          Paid
        </Pill>
      </div>
      <p className="mt-1 text-sm font-semibold text-ink">Oak Park Office</p>
      <dl className="mt-3 space-y-1.5 border-t border-border pt-3 text-xs">
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Total</dt>
          <dd className="tnum font-medium text-ink">$412.00</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Balance due</dt>
          <dd className="tnum font-medium text-ink">$0.00</dd>
        </div>
      </dl>
    </MiniCard>
  );
}

/* ── Steps ──────────────────────────────────────────────────────────────── */

/*
 * Every sentence maps to PRODUCT.md → Built: the booking portal (customers are
 * added from it), jobs on a board and calendar with drag-to-reschedule, quotes
 * with PDF and online accept, checklists / photos / a running timer, and
 * invoices with manually recorded payments.
 *
 * "Paid" says the payment is RECORDED. There is no online payment and no
 * pay-from-email link (LAND-02): the owner records what the customer paid, and
 * the invoice closes. Do not soften that into "customers pay online".
 */
const STEPS = [
  {
    title: "Booked",
    icon: IconCalendarPlus,
    description:
      "Customers pick a slot from your real availability. They are added as customers for you.",
    Visual: BookedVisual,
  },
  {
    title: "Scheduled",
    icon: IconCalendarEvent,
    description:
      "The booking becomes a job on your board and calendar. Drag it if plans change.",
    Visual: ScheduledVisual,
  },
  {
    title: "Quoted",
    icon: IconFileText,
    description:
      "Send a branded quote as a PDF. Customers accept it online from the link.",
    Visual: QuotedVisual,
  },
  {
    title: "Done",
    icon: IconChecklist,
    description:
      "Tick off the checklist, run the timer and add photos. Completing the job stops the clock.",
    Visual: DoneVisual,
  },
  {
    title: "Paid",
    icon: IconCash,
    description:
      "Email the invoice as a PDF. When the customer pays, record the payment and the invoice closes.",
    Visual: PaidVisual,
  },
] as const;

/**
 * Booking to paid.
 *
 * Replaces the six-card features bento, and keeps its `id="features"` so the
 * navbar's "Features" link, the footer's `/#features` and the hero's "See
 * what's included" all still land here.
 *
 * The order is the product's core loop (PRODUCT.md → Operating Context), so
 * this is a real sequence and the layout says so: five columns joined by a
 * thin line from `lg`, two columns at `md`, and on a phone a vertical list
 * with the line running down beside the discs. The connector is a hairline
 * between discs, not a ruled page: it joins things that follow each other.
 */
export function JobFlowSection() {
  return (
    <Section id="features" surface="base" labelledBy="features-heading">
      <SectionHeading
        id="features-heading"
        title="From the first call to the paid invoice."
        lede="Five steps on one set of records. Nothing gets retyped between them."
      />

      <ol
        role="list"
        className="mt-14 grid gap-x-5 md:grid-cols-2 md:gap-x-8 md:gap-y-14 lg:mt-16 lg:grid-cols-5 lg:gap-x-5"
      >
        {STEPS.map((step, i) => (
          <Reveal
            as="li"
            key={step.title}
            delay={i * 70}
            className="group relative grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-4 md:block"
          >
            {/* The disc, plus the phone's vertical connector beneath it. */}
            <div className="flex flex-col items-center md:block">
              <IconDisc icon={step.icon} size="md" />
              <span
                aria-hidden="true"
                className="mt-2 w-px flex-1 bg-border group-last:hidden md:hidden"
              />
            </div>

            <div className="pb-10 group-last:pb-0 md:mt-5 md:pb-0">
              <h3 className="font-heading text-xl font-semibold tracking-tight text-ink">
                {step.title}
              </h3>
              <p className="mt-2 text-base leading-relaxed text-muted-foreground text-pretty">
                {step.description}
              </p>
              <div aria-hidden="true" className="mt-5">
                <step.Visual />
              </div>
            </div>

            {/* The line to the next disc, from `lg`. It starts 8px past this
                disc and stops 8px short of the next one (the column gap is
                20px). */}
            <span
              aria-hidden="true"
              className="absolute -right-3 left-12 top-5 hidden h-px bg-border group-last:hidden lg:block"
            />
          </Reveal>
        ))}
      </ol>

      <p className="mt-12 text-sm text-muted-foreground">
        Names, jobs and amounts in these examples are sample data.
      </p>
    </Section>
  );
}
